export type CompanyContext = { company: string; user: string };
const key = "vila.tab.context";
let switching = false;
export function currentContext(): CompanyContext | null {
  const value = sessionStorage.getItem(key);
  return value ? JSON.parse(value) : null;
}
export function rememberContext(context: CompanyContext | null) {
  if (context) sessionStorage.setItem(key, JSON.stringify(context));
  else sessionStorage.removeItem(key);
}
export async function companyFetch(path: string, init: RequestInit = {}, target?: CompanyContext) {
  const before = sessionStorage.getItem(key);
  const expected = target ?? currentContext();
  if (switching || (!expected && path !== "me")) throw Error("Şirket seçimi gerekli.");
  const headers = new Headers(init.headers);
  if (expected) {
    headers.set("X-Vila-Company", expected.company);
    headers.set("X-Vila-User", expected.user);
  }
  let response: Response;
  try { response = await fetch("/api/"+path,{...init,headers,cache:"no-store"}); }
  catch { throw Error("Sunucuya ulaşılamıyor. Lütfen tekrar deneyin."); }
  const data = await response.json();
  if (switching || before !== sessionStorage.getItem(key)) throw Error("Şirket bağlamı değişti.");
  if (!response.ok) throw Object.assign(new Error(data.error || "İşlem başarısız."),{status:response.status});
  const company = response.headers.get("X-Vila-Company"), user = response.headers.get("X-Vila-User");
  if (!company || !user || (expected && (expected.company !== company || expected.user !== user)) ||
      (path === "me" && (company !== data.org.id || user !== data.user.id))) throw Error("Yanıtın şirket bağlamı doğrulanamadı.");
  if (!expected) rememberContext({company,user});
  return data;
}
export async function switchCompany(company: string) {
  const previous = currentContext();
  if (!previous) throw Error("Oturum açmanız gerekiyor.");
  const next = {...previous,company};
  await companyFetch("switch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orgId:company})},next);
  switching = true;
  rememberContext(next);
  window.location.reload();
}
