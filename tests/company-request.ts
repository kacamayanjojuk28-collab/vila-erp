import { request as playwrightRequest } from "@playwright/test";

// API clients remember their own selection just as browser tabs do.
export const request = {
 async newContext(options?: Parameters<typeof playwrightRequest.newContext>[0]) {
  const client = await playwrightRequest.newContext(options);
  let company: string | undefined;
  return new Proxy(client, {
   get(target, key) {
    const original = Reflect.get(target, key);
    if (!["get","post","put","patch","delete","fetch"].includes(String(key))) {
     return typeof original === "function" ? original.bind(target) : original;
    }
    return async (url: string, opts: any = {}) => {
     const path = new URL(url,process.env.VILA_TEST_ORIGIN).pathname;
     const selection = path === "/api/switch" ? opts.data.orgId : company;
     const headers = {...(selection ? {"X-Vila-Company":selection} : {}), ...opts.headers};
     const result = await original.call(target,url,{...opts,headers});
     if (result.ok()) {
      if (path === "/api/auth/register" || path === "/api/auth/login") {
       const me = await target.get(new URL("/api/me",process.env.VILA_TEST_ORIGIN).href);
       company = me.ok() ? (await me.json()).org.id : undefined;
      } else if (path === "/api/me" || path === "/api/switch") {
       company = result.headers()["x-vila-company"];
      }
     }
     return result;
    };
   }
  });
 }
};
