import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const c=JSON.parse(readFileSync('.local/dashboard-env.json','utf8'));
for(const k of ['DATABASE_URL','MIGRATION_DATABASE_URL']){const u=new URL(c[k]);if(u.hostname!=='127.0.0.1'||u.port!=='9543'||u.pathname!=='/vila_dashboard_v1')throw Error('Dashboard isolated DB required');}
if(c.APP_ORIGIN!=='http://localhost:3500'||c.VILA_BUILD_DIR!=='.next-dashboard'||c.VILA_RLS!=='1')throw Error('Dashboard isolation mismatch');
const r=spawnSync(process.execPath,process.argv.slice(2),{stdio:'inherit',env:{...process.env,...c}});process.exit(r.status??1);
