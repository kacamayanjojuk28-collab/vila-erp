import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync('.local/finance-env.json','utf8'));
for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']){const u=new URL(config[key]);if(u.hostname!=='127.0.0.1'||u.port!=='9543'||u.pathname!=='/vila_finance_v1')throw Error('Finance isolation check failed');}
if(config.APP_ORIGIN!=='http://localhost:3400'||config.VILA_BUILD_DIR!=='.next-finance'||config.VILA_RLS!=='1')throw Error('Finance application guard failed');
const r=spawnSync(process.execPath,process.argv.slice(2),{stdio:'inherit',env:{...process.env,...config}});process.exit(r.status??1);
