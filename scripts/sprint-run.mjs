import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync('.local/sprint-env.json','utf8'));
for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']) {
 const u=new URL(config[key]);
 if(u.hostname!=='127.0.0.1'||u.port!=='7543'||u.pathname!=='/vila_sprint_01')throw Error('Sprint DB isolation check failed');
}
if(config.APP_ORIGIN!=='http://localhost:3200'||config.VILA_BUILD_DIR!=='.next-sprint')throw Error('Sprint application isolation check failed');
const result=spawnSync(process.execPath,process.argv.slice(2),{stdio:'inherit',env:{...process.env,...config}});
process.exit(result.status??1);
