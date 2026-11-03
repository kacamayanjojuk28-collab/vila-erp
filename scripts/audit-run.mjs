import 'dotenv/config';
import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import pg from 'pg';import {randomBytes} from 'node:crypto';
const file='.local/audit-env.json';
if(process.argv[2]==='init'){
 const url=new URL(process.env.MIGRATION_DATABASE_URL);const dbname='vila_audit_'+Date.now();const c=new pg.Client({connectionString:url.toString()});await c.connect();await c.query('CREATE DATABASE "'+dbname+'"');await c.end();url.pathname='/'+dbname;const runtime=new URL(url);runtime.username='vila_audit_'+Date.now();runtime.password=randomBytes(32).toString('hex');writeFileSync(file,JSON.stringify({MIGRATION_DATABASE_URL:url.toString(),DATABASE_URL:runtime.toString(),APP_ORIGIN:'http://localhost:3100',VILA_TEST_ORIGIN:'http://localhost:3100',VILA_BUILD_DIR:'.next-audit',VILA_VISUAL_CREDENTIALS:'.local/audit-visual-credentials.json'}));console.log('Created isolated database '+dbname);
}else{const env={...process.env,...JSON.parse(readFileSync(file,'utf8'))};const args=process.argv.slice(2);const r=spawnSync(process.execPath,args,{stdio:'inherit',env});process.exit(r.status??1)}
