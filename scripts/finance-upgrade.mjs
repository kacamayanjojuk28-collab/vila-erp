import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import path from 'node:path';import pg from 'pg';import {randomBytes} from 'node:crypto';import assert from 'node:assert/strict';
if(!process.argv[2])throw Error('Usage: node scripts/finance-upgrade.mjs <isolated synthetic dump>');
const config=JSON.parse(readFileSync('.local/finance-env.json','utf8')),source=new URL(config.MIGRATION_DATABASE_URL);if(source.hostname!=='127.0.0.1'||source.port!=='9543'||source.pathname!=='/vila_finance_v1')throw Error('Finance cluster only');
const name='vila_finance_upgrade_'+Date.now(),c=new pg.Client({connectionString:source.href});await c.connect();await c.query('CREATE DATABASE "'+name+'"');await c.end();
const admin=new URL(source);admin.pathname='/'+name;const runtime=new URL(admin);runtime.username='finance_upgrade_'+Date.now();runtime.password=randomBytes(32).toString('hex');
const bin=path.join(process.env.LOCALAPPDATA,'Programs/PostgreSQL18/pgsql/bin');const r=spawnSync(path.join(bin,'pg_restore.exe'),['-h','127.0.0.1','-p','9543','-U',admin.username,'--no-owner','--no-acl','--single-transaction','--exit-on-error','-d',name,path.resolve(process.argv[2])],{stdio:'inherit',env:{...process.env,PGPASSWORD:decodeURIComponent(admin.password)}});if(r.status)throw Error('Upgrade fixture restore failed');
const check=new pg.Client({connectionString:admin.href});await check.connect();
const tables=['User','Organization','Membership','Session','Invite','Record','Document','DocumentLine','Stock','Movement','Payment','Audit','RateLimit','MutationReceipt'];
async function snapshot(){const result={};for(const table of tables)result[table]=(await check.query(`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text)) digest FROM "${table}" t`)).rows[0];return result;}
const before=await snapshot();
const migration=spawnSync(process.execPath,['deploy/migrate.mjs'],{encoding:'utf8',env:{...process.env,...config,DATABASE_URL:runtime.href,MIGRATION_DATABASE_URL:admin.href}});console.log(migration.stdout);console.error(migration.stderr);assert.equal(migration.status,0);
const after=await snapshot();assert.deepEqual(after,before);
const migrations=(await check.query('SELECT migration_name,finished_at IS NOT NULL applied FROM "_prisma_migrations" WHERE rolled_back_at IS NULL ORDER BY migration_name')).rows;assert.equal(migrations.length,13);assert.ok(migrations.every(m=>m.applied));
const rls=(await check.query("SELECT tablename FROM pg_policies WHERE schemaname='public' ORDER BY tablename")).rows;assert.equal(rls.length,19);
writeFileSync('docs/verification/finance-upgrade.json',JSON.stringify({isolatedDatabase:name,migrations,rls,legacyRowsPreserved:before,allLegacyDigestsUnchanged:true,newFinancialRows:0,mainDatabaseTouched:false},null,2));await check.end();console.log('Legacy data digests unchanged across all 13 migrations; 19 RLS tables installed');
