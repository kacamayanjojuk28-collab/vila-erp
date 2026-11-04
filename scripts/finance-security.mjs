import pg from 'pg';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {request} from '@playwright/test';import {randomUUID,randomBytes} from 'node:crypto';
const u=new URL(process.env.DATABASE_URL);if(u.hostname!=='127.0.0.1'||u.port!=='9543'||u.pathname!=='/vila_finance_v1')throw Error('Finance isolation required');
const fixture=JSON.parse(readFileSync('.local/finance-test-context.json','utf8')),origin=process.env.VILA_TEST_ORIGIN;
const api=await request.newContext({baseURL:origin,storageState:fixture.storage,extraHTTPHeaders:{Origin:origin}}),other=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
async function post(ctx,path,data){const r=await ctx.post('/api/'+path,{data,headers:{'Idempotency-Key':randomBytes(16).toString('hex')}});assert.equal(r.status(),200,await r.text());return r.json();}
const invoice=await(await api.get('/api/finance-core/invoices/'+fixture.invoiceId)).json(),accounts=await(await api.get('/api/finance-core/accounts?take=100')).json();
await post(api,'finance-core/payments',{partyId:invoice.partyId,accountId:accounts.rows.find(a=>a.purpose==='BANK').id,direction:'IN',amount:'1',effectiveOn:new Date().toLocaleDateString('sv-SE'),name:'RLS payment fixture',allocations:[{invoiceId:invoice.id,amount:'1'}]});await post(api,'finance-core/reconciliation',{});
await post(other,'auth/register',{email:`finance-security-${randomUUID()}@example.test`,password:randomBytes(20).toString('hex'),name:'Security owner',company:'Security B'});const me=await(await other.get('/api/me')).json();await post(other,'finance-core/bootstrap',{acknowledgeInternalPolicy:true,name:'Security year',startsOn:'2026-01-01',endsOn:'2026-12-31'});
const orgs=[fixture.orgId,me.org.id],tables=['LedgerAccount','AccountingPeriod','FinanceCounter','TaxRule','JournalEntry','JournalLine','FinancialInvoice','InvoiceLine','FinancePayment','PaymentAllocation','ReconciliationRecord'];
const admin=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await admin.connect();const foreign={};for(const table of tables){foreign[table]=(await admin.query(`SELECT * FROM "${table}" WHERE "orgId"=$1 LIMIT 1`,[orgs[0]])).rows[0];assert.ok(foreign[table],table+' fixture missing');}
const policies=(await admin.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)',[tables])).rows;assert.equal(policies.length,tables.length);for(const p of policies)assert.ok(p.relrowsecurity&&p.relforcerowsecurity);
const disabled=(await admin.query("SELECT count(*)::int n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND t.tgenabled='D'")).rows[0].n;assert.equal(disabled,0);await admin.end();
const pool=new pg.Pool({connectionString:u.href,max:2}),result={tables:[],policies,disabledTriggers:disabled,concurrentTransactions:0,clockReset:true};
const defaultClock=(await pool.query('SHOW TimeZone')).rows[0].TimeZone;
try{
 result.runtimeRole=(await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.deepEqual(result.runtimeRole,{rolsuper:false,rolbypassrls:false});
 const c=await pool.connect();try{
 for(const table of tables)assert.equal((await c.query(`SELECT * FROM "${table}"`)).rowCount,0);
 await c.query('BEGIN');await c.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[1]]);
 for(const table of tables){
 assert.equal((await c.query(`SELECT * FROM "${table}" WHERE "orgId"=$1`,[orgs[0]])).rowCount,0);
 await c.query('SAVEPOINT denied');const row=foreign[table],keys=Object.keys(row);let code;try{await c.query(`INSERT INTO "${table}" (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));}catch(e){code=e.code;}assert.ok(['42501','23514','23503'].includes(code),table+':'+code);await c.query('ROLLBACK TO SAVEPOINT denied');
 for(const method of ['UPDATE','DELETE']){await c.query('SAVEPOINT denied');let blocked=false;try{const sql=method==='UPDATE'?`UPDATE "${table}" SET "orgId"="orgId" WHERE "orgId"=$1`:`DELETE FROM "${table}" WHERE "orgId"=$1`;blocked=(await c.query(sql,[orgs[0]])).rowCount===0;}catch(e){blocked=e.code==='42501';}assert.ok(blocked,table+method);await c.query('ROLLBACK TO SAVEPOINT denied');}
 result.tables.push({table,noContextDeny:true,foreignReadDeny:true,foreignWriteDeny:true});
 }
 await c.query('ROLLBACK');assert.equal((await c.query('SELECT * FROM "JournalLine"')).rowCount,0);
 }finally{c.release();}
 await Promise.all(Array.from({length:100},async(_,i)=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[i%2]]);for(const table of ['LedgerAccount','JournalEntry','FinancialInvoice','PaymentAllocation']){const rows=(await c.query(`SELECT DISTINCT "orgId" FROM "${table}"`)).rows;assert.ok(rows.every(r=>r.orgId===orgs[i%2]));}await c.query(i%3?'COMMIT':'ROLLBACK');assert.equal((await c.query('SELECT * FROM "JournalLine"')).rowCount,0);assert.equal((await c.query('SHOW TimeZone')).rows[0].TimeZone,defaultClock);result.concurrentTransactions++;}finally{c.release();}}));
 const direct=await pool.connect();try{
 await direct.query('BEGIN');await direct.query("SET LOCAL TIME ZONE 'UTC'");await direct.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[0]]);
 const period=(await direct.query('SELECT id FROM "AccountingPeriod" WHERE "orgId"=$1 AND status=\'OPEN\' LIMIT 1',[orgs[0]])).rows[0].id;
 const bank=accounts.rows.find(a=>a.purpose==='BANK').id,id=randomUUID();
 await direct.query('INSERT INTO "JournalEntry" (id,"orgId",number,"periodId","effectiveOn","sourceType","sourceId",description,"createdBy") VALUES ($1,$2,$1,$3,(clock_timestamp() AT TIME ZONE \'Europe/Istanbul\')::date,\'MANUAL\',$1,\'Unbalanced negative probe\',$4)',[id,orgs[0],period,fixture.userId]);
 await direct.query('INSERT INTO "JournalLine" (id,"orgId","entryId","accountId",debit,credit,description) VALUES ($1,$2,$3,$4,10,0,\'probe\'),($5,$2,$3,$4,0,9,\'probe\')',[randomUUID(),orgs[0],id,bank,randomUUID()]);
 await direct.query('UPDATE "JournalEntry" SET status=\'POSTED\' WHERE id=$1',[id]);
 let code;try{await direct.query('COMMIT');}catch(e){code=e.code;await direct.query('ROLLBACK');}assert.equal(code,'23514');
 await direct.query('BEGIN');await direct.query("SELECT set_config('vila.tenant_id',$1,true)",[orgs[0]]);assert.equal((await direct.query('SELECT id FROM "JournalEntry" WHERE id=$1',[id])).rowCount,0);await direct.query('ROLLBACK');result.unbalancedCommitRollback=true;
 const immutable=[];for(const table of ['FinancePayment','PaymentAllocation','JournalLine','TaxRule','ReconciliationRecord']){const privileges=(await direct.query('SELECT has_table_privilege($1,\'UPDATE\') AS update,has_table_privilege($1,\'DELETE\') AS delete',['"'+table+'"'])).rows[0];assert.equal(privileges.update,false);assert.equal(privileges.delete,false);immutable.push({table,...privileges});}result.immutablePrivileges=immutable;
 }finally{direct.release();}
 writeFileSync('docs/verification/finance-security.json',JSON.stringify(result,null,2));console.log(result);
}finally{await pool.end();await api.dispose();await other.dispose();}
