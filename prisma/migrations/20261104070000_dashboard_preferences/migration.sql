CREATE TABLE "DashboardPreference" (
 "id" TEXT PRIMARY KEY,"orgId" TEXT NOT NULL,"userId" TEXT NOT NULL,"dashboardKey" TEXT NOT NULL DEFAULT 'overview',
 "schemaVersion" INTEGER NOT NULL DEFAULT 2,"version" INTEGER NOT NULL DEFAULT 1,"isDefault" BOOLEAN NOT NULL DEFAULT false,
 "layout" JSONB NOT NULL,"widgets" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "DashboardPreference_member_fkey" FOREIGN KEY ("orgId","userId") REFERENCES "Membership"("orgId","userId") ON DELETE CASCADE,
 CHECK ("dashboardKey"='overview' AND "schemaVersion" BETWEEN 1 AND 2 AND "version">0),
 CHECK (jsonb_typeof("layout")='object' AND jsonb_typeof("widgets")='array' AND jsonb_array_length("widgets")<=20 AND pg_column_size("layout")+pg_column_size("widgets")<=65536)
);
CREATE UNIQUE INDEX "DashboardPreference_identity_key" ON "DashboardPreference"("orgId","userId","dashboardKey");
ALTER TABLE "DashboardPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DashboardPreference" FORCE ROW LEVEL SECURITY;
CREATE POLICY dashboard_owner ON "DashboardPreference" USING ("orgId"=nullif(current_setting('vila.tenant_id',true),'') AND "userId"=nullif(current_setting('vila.user_id',true),'')) WITH CHECK ("orgId"=nullif(current_setting('vila.tenant_id',true),'') AND "userId"=nullif(current_setting('vila.user_id',true),''));
