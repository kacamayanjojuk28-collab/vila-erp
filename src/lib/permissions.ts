// Shared by API and navigation. Existing mutation roles remain unchanged.
export const writeScopes: Record<string, readonly string[]> = {
  OWNER: ["*"], ADMIN: ["*"],
  SALES: ["customers", "leads", "deals", "quotes", "sales", "activities"],
  WAREHOUSE: ["products", "warehouses", "stock", "purchases", "requests", "suppliers"],
  FINANCE: ["finance"], MEMBER: ["projects", "tasks", "activities"], VIEWER: [],
};
export function canWrite(role: string, scope: string) {
  return !!writeScopes[role]?.some(s => s === "*" || s === scope);
}
export function canRead(role: string, scope: string): boolean {
  if (!Object.hasOwn(writeScopes, role)) return false;
  if (scope === "audit") return canWrite(role, "settings");
  if (scope === "reports") return canRead(role, "sales") || canRead(role, "purchases");
  if (["finance", "quotes", "sales", "purchases", "requests"].includes(scope))
    return canWrite(role, scope) || (role === "FINANCE" && ["sales", "purchases"].includes(scope));
  return true;
}
