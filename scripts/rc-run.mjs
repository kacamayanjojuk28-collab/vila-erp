import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(readFileSync('.local/rc-env.json','utf8'));
for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL']) {
 const u=new URL(config[key]);
 if(u.hostname!=='127.0.0.1'||u.port!=='8543'||u.pathname!=='/vila_rc_090')throw Error('RC DB isolation check failed');
}
if(config.APP_ORIGIN!=='http://localhost:3300'||config.VILA_BUILD_DIR!=='.next-rc')throw Error('RC application isolation check failed');
const result=spawnSync(process.execPath,process.argv.slice(2),{stdio:'inherit',env:{...process.env,...config}});
process.exit(result.status??1);
