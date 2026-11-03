import pg from 'pg';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const u=new URL(process.env.DATABASE_URL);if(u.port!=='7543'||u.pathname!=='/vila_sprint_01')throw Error('Sprint DB required');
const orgs=JSON.parse(readFileSync('.local/load-tenants.json','utf8')),tables=['Record','Document','DocumentLine','Stock','Movement','Payment','Audit','MutationReceipt'];
const admin=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await admin.connect();
for(const org of orgs){
 await admin.query('INSERT INTO "Audit" (id,"orgId","userId",action,"entityId") VALUES ($1,$2,\'sprint-probe\',\'SPRINT RLS PROBE\',\'probe\') ON CONFLICT DO NOTHING',['sprint-rls-'+org,org]);
 await admin.query('INSERT INTO "MutationReceipt" ("orgId",scope,key,"requestHash",result) VALUES ($1,\'sprint-probe\',\'probe\',\'probe\',\'{}\') ON CONFLICT DO NOTHING',[org]);
}
const foreign={};for(const t of tables)foreign[t]=(await admin.query(`SELECT * FROM "${t}" WHERE "orgId"=$1 LIMIT 1`,[orgs[1]])).rows[0];
const policies=(await admin.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)',[tables])).rows;await admin.end();
const pool=new pg.Pool({connectionString:u.href,max:2});const result={policies,tables:[],concurrentTransactions:0,contextReset:true};
try{
 const role=(await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);result.role=role;
 const c=await pool.connect();try{
  for(const t of tables)assert.equal((await c.query(`SELECT * FROM "${t}"`)).rowCount,0);
  await c.query('BEGIN');await c.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[0]]);
  for(const t of tables){
   const rows=(await c.query(`SELECT DISTINCT "orgId" FROM "${t}"`)).rows;assert.deepEqual(rows,[{orgId:orgs[0]}]);
   assert.equal((await c.query(`SELECT * FROM "${t}" WHERE "orgId"=$1`,[orgs[1]])).rowCount,0);
   await c.query('SAVEPOINT reject_write');const row=foreign[t],columns=Object.keys(row);let code;
   try{await c.query(`INSERT INTO "${t}" (${columns.map(k=>'"'+k+'"').join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(k=>row[k]))}catch(e){code=e.code}
   assert.equal(code,'42501');await c.query('ROLLBACK TO SAVEPOINT reject_write');
   await c.query('SAVEPOINT reject_update');let blocked=false;
   try{blocked=(await c.query(`UPDATE "${t}" SET "orgId"="orgId" WHERE "orgId"=$1`,[orgs[1]])).rowCount===0}catch(e){blocked=e.code==='42501'}
   assert.ok(blocked);await c.query('ROLLBACK TO SAVEPOINT reject_update');
   await c.query('SAVEPOINT reject_delete');let deleteBlocked=false;
   try{deleteBlocked=(await c.query(`DELETE FROM "${t}" WHERE "orgId"=$1`,[orgs[1]])).rowCount===0}catch(e){deleteBlocked=e.code==='42501'}
   assert.ok(deleteBlocked);await c.query('ROLLBACK TO SAVEPOINT reject_delete');
   result.tables.push({table:t,ownRead:true,foreignReadDenied:true,foreignInsertDenied:true,foreignUpdateDenied:true,foreignDeleteDenied:true});
  }
  await c.query('ROLLBACK');assert.equal((await c.query('SELECT * FROM "Record"')).rowCount,0);
  await c.query('BEGIN');await c.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[1]]);
  for(const t of tables)assert.deepEqual((await c.query(`SELECT DISTINCT "orgId" FROM "${t}"`)).rows,[{orgId:orgs[1]}]);
  await c.query('COMMIT');for(const t of tables)assert.equal((await c.query(`SELECT * FROM "${t}"`)).rowCount,0);
 }finally{c.release()}
 await Promise.all(Array.from({length:100},async(_,i)=>{const c=await pool.connect();try{
  assert.equal((await c.query('SELECT * FROM "Record"')).rowCount,0);
  await c.query('BEGIN');await c.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[i%2]]);
  assert.deepEqual((await c.query('SELECT DISTINCT "orgId" FROM "Record"')).rows,[{orgId:orgs[i%2]}]);
  await c.query(i%3?'COMMIT':'ROLLBACK');assert.equal((await c.query('SELECT * FROM "Record"')).rowCount,0);result.concurrentTransactions++;
 }finally{c.release()}}));
 // A single reused connection must also reset across success and failure.
 const single=new pg.Pool({connectionString:u.href,max:1});try{for(const org of orgs){await single.query('BEGIN');await single.query("SELECT set_config('vila.tenant_id',$1,true)",[org]);assert.deepEqual((await single.query('SELECT DISTINCT "orgId" FROM "Record"')).rows,[{orgId:org}]);await single.query('COMMIT');assert.equal((await single.query('SELECT * FROM "Record"')).rowCount,0)}}finally{await single.end()}
 writeFileSync('docs/verification/sprint-rls.json',JSON.stringify(result,null,2));console.log(result);
}finally{await pool.end()}
