import { test,expect,request,type APIRequestContext } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { randomUUID,randomBytes } from 'node:crypto';
import { db,withTenant } from '../../src/lib/db';
import { assertIsolated } from '../isolated';
import { decimal } from '../../src/lib/domain';
import { today } from '../../src/lib/finance-domain';
const origin=process.env.VILA_TEST_ORIGIN!,date=today(),year=date.slice(0,4),backdateReason='Isolated scenario verification';
let a:APIRequestContext,b:APIRequestContext,org:string,user:string,accounts:any[],tax:any;
const options={baseURL:origin,extraHTTPHeaders:{Origin:origin}};
const key=()=>randomBytes(16).toString('hex');
async function post(c:APIRequestContext,path:string,data:any,k=key()){const r=await c.post('/api/'+path,{data,headers:{'Idempotency-Key':k}});expect(r.ok(),`${path}: ${await r.text()}`).toBeTruthy();return r.json();}
async function get(c:APIRequestContext,path:string){const r=await c.get('/api/finance-core/'+path);expect(r.ok(),await r.text()).toBeTruthy();return r.json();}
async function customer(c=a,kind='customers'){return post(c,kind,{name:'Finance '+randomUUID(),status:'ACTIVE',data:{email:'finance@example.test',phone:'',company:'Test',notes:'',...(kind==='customers'?{segment:'SMB'}:{})}});}
async function invoice(partyId:string,amount='1000',kind='SALE',issuedOn=date,dueOn=issuedOn,c=a,rule=tax.id){return post(c,'finance-core/invoices',{kind,partyId,issuedOn,dueOn,lines:[{name:'Türkçe hizmet — İğüşöç',quantity:'1',unitPrice:amount,taxRuleId:rule}]});}
async function finalize(i:any,c=a,k=key()){await post(c,`finance-core/invoices/${i.id}/approve`,{});return post(c,`finance-core/invoices/${i.id}/post`,{effectiveOn:i.issuedOn.slice(0,10),backdateReason},k);}
const acct=(p:string)=>accounts.find(x=>x.purpose===p).id;
async function pay(partyId:string,amount:string,allocations:any[]=[],direction='IN',c=a){return post(c,'finance-core/payments',{partyId,amount,allocations,direction,accountId:acct('BANK'),effectiveOn:date,backdateReason,name:'Test tahsilat/ödeme'});}
async function allocate(paymentId:string,invoiceId:string,amount:string,c=a,k=key()){return post(c,'finance-core/allocations',{paymentId,invoiceId,amount,effectiveOn:date,backdateReason},k);}
async function reconciles(c=a){const r=await get(c,'reconciliation');expect(r.status).toBe('MATCH');expect(r.debit).toBe(r.credit);expect(decimal(r.partyDifference).toFixed(2)).toBe('0.00');expect(decimal(r.invoiceDifference).toFixed(2)).toBe('0.00');}
test.beforeAll(async()=>{
 assertIsolated();a=await request.newContext(options);b=await request.newContext(options);
 for(const [c,name]of [[a,'A'],[b,'B']] as const){await post(c,'auth/register',{email:`fc-${name}-${randomUUID()}@example.test`,password:randomBytes(20).toString('hex'),name:'Finance Owner '+name,company:'Finance test '+name});await post(c,'finance-core/bootstrap',{acknowledgeInternalPolicy:true,startsOn:year+'-01-01',endsOn:year+'-12-31',name:'Test year'});}
 const me=await(await a.get('/api/me')).json();org=me.org.id;user=me.user.id;accounts=(await get(a,'accounts?take=100')).rows;
 tax=await post(a,'finance-core/tax-rules',{code:'EXAMPLE20',classification:'STANDARD',rate:'20',validFrom:year+'-01-01',validTo:year+'-12-31'});
});
test.afterAll(async()=>{await a?.dispose();await b?.dispose();await db.$disconnect();});
test('FC01 full sale: posted invoice, full receipt, statement and trial balance reconcile',async()=>{
 const p=await customer(),i=await invoice(p.id);await finalize(i);await pay(p.id,'1200',[{invoiceId:i.id,amount:'1200'}]);const x=await get(a,'invoices/'+i.id);expect(x.open).toBe('0');expect((await get(a,'statement?partyId='+p.id)).balance).toBe('0.00');const trial=await get(a,'trial?take=100');expect(trial.totals.debit).toBe(trial.totals.credit);await reconciles();
});
test('FC02 partial receipt 1200-500=700; historical aging ignores later allocation',async()=>{
 const p=await customer(),i=await invoice(p.id,'1000','SALE',year+'-01-01',year+'-01-10');await finalize(i);await pay(p.id,'500',[{invoiceId:i.id,amount:'500'}]);expect((await get(a,'invoices/'+i.id)).open).toBe('700');
 const before=await get(a,`open?partyId=${p.id}&asOf=${year}-01-31`);expect(before.rows[0].open).toBe('1200.00');const aging=await get(a,`aging?partyId=${p.id}&asOf=${year}-01-31`);expect(aging.rows[0].bucket).toBe('1_30');expect(aging.rows[0].amount).toBe('1200.00');expect((await get(a,'statement?partyId='+p.id)).balance).toBe('700.00');await reconciles();
});
test('FC03 advance 300 is liability, later allocated once; linked allocation reversal preserves history',async()=>{
 const p=await customer(),payment=await pay(p.id,'300');const j=await get(a,'journals/'+payment.journalId);expect(j.lines.some((l:any)=>l.accountId===acct('REVENUE'))).toBe(false);expect(j.lines.find((l:any)=>l.accountId===acct('CUSTOMER_ADVANCE')).credit).toBe('300');
 const i=await invoice(p.id);await finalize(i);const allocation=await allocate(payment.id,i.id,'300');expect((await get(a,'invoices/'+i.id)).open).toBe('900');
 expect((await a.post('/api/finance-core/allocations',{data:{paymentId:payment.id,invoiceId:i.id,amount:'1',effectiveOn:date},headers:{'Idempotency-Key':key()}})).status()).toBe(409);
 await post(a,`finance-core/allocations/${allocation.id}/reverse`,{effectiveOn:date,backdateReason,reason:'Mahsup düzeltme'});expect((await get(a,'invoices/'+i.id)).open).toBe('1200');expect((await get(a,'advances?partyId='+p.id)).rows[0].available).toBe('300.00');await reconciles();
});
test('FC04 purchase receipt and two partial invoices do not double-post inventory; supplier partial payment',async()=>{
 const p=await customer(a,'suppliers'),warehouse=await post(a,'warehouses',{name:'Finance warehouse',data:{address:'Test'}}),product=await post(a,'products',{name:'Finance stock item',data:{sku:randomUUID(),category:'Test',unit:'ADET',price:'100',minStock:'0'}});
 const order=await post(a,'purchases',{name:'Finance purchase',contactId:p.id,warehouseId:warehouse.id,lines:[{productId:product.id,quantity:'4',price:'100',discount:0,tax:20}]});await post(a,`purchases/${order.id}/confirm`,{});await post(a,`purchases/${order.id}/fulfill`,{});
 const source=await withTenant(org,()=>db.documentLine.findFirst({where:{orgId:org,documentId:order.id}}));
 const make=()=>post(a,'finance-core/invoices',{kind:'PURCHASE',partyId:p.id,orderId:order.id,issuedOn:date,dueOn:date,lines:[{name:product.name,productId:product.id,sourceLineId:source!.id,quantity:'2',unitPrice:'100',taxRuleId:tax.id}]});
 const i1=await make(),i2=await make();await finalize(i1);await finalize(i2);await pay(p.id,'100',[{invoiceId:i1.id,amount:'100'}],'OUT');expect((await get(a,'invoices/'+i1.id)).open).toBe('140');
 const i3=await make();await post(a,`finance-core/invoices/${i3.id}/approve`,{});expect((await a.post(`/api/finance-core/invoices/${i3.id}/post`,{data:{effectiveOn:date,backdateReason},headers:{'Idempotency-Key':key()}})).status()).toBe(409);
 const stocks=await withTenant(org,()=>db.stock.findMany({where:{orgId:org,productId:product.id}}));expect(stocks[0].quantity.toString()).toBe('4');const trial=await get(a,'trial?take=100');expect(trial.rows.find((x:any)=>x.id===acct('INVENTORY')).closing).toBe('400.00');await reconciles();
});
test('FC05 payment across two invoices and concurrent over-allocation roll back atomically',async()=>{
 const p=await customer(),i1=await invoice(p.id,'500'),i2=await invoice(p.id,'500');await finalize(i1);await finalize(i2);const payment=await pay(p.id,'1000',[{invoiceId:i1.id,amount:'600'},{invoiceId:i2.id,amount:'400'}]);expect((await get(a,'invoices/'+i2.id)).open).toBe('200');
 const p2=await pay(p.id,'300');const payload={paymentId:p2.id,invoiceId:i2.id,amount:'200',effectiveOn:date,backdateReason};const rs=await Promise.all([a.post('/api/finance-core/allocations',{data:payload,headers:{'Idempotency-Key':key()}}),a.post('/api/finance-core/allocations',{data:payload,headers:{'Idempotency-Key':key()}})]);expect(rs.map(r=>r.status()).sort()).toEqual([200,409]);
 const bad=await a.post('/api/finance-core/payments',{data:{partyId:p.id,accountId:acct('BANK'),direction:'IN',amount:'1',effectiveOn:date,name:'Must rollback',allocations:[{invoiceId:i2.id,amount:'2'}]},headers:{'Idempotency-Key':key()}});expect(bad.status()).toBe(409);expect((await get(a,'invoices/'+i2.id)).open).toBe('0');await reconciles();
});
test('FC06 partial credit note and payment reversal retain originals; posted journals immutable',async()=>{
 const p=await customer(),i=await invoice(p.id);await finalize(i);const detail=await get(a,'invoices/'+i.id);
 await post(a,`finance-core/invoices/${i.id}/credit`,{effectiveOn:date,backdateReason,reason:'Kısmi iade',lines:[{lineId:detail.lines[0].id,quantity:'0.5'}]});expect((await get(a,'invoices/'+i.id)).open).toBe('600');
 const payment=await pay(p.id,'200');expect((await a.post(`/api/finance/${payment.id}/reverse`,{data:{reason:'legacy route must deny'}})).status()).toBe(409);
 const reversal=await post(a,`finance-core/payments/${payment.id}/reverse`,{effectiveOn:date,backdateReason,reason:'Ödeme düzeltmesi'});expect(reversal.reversalOf).toBe(payment.id);
 await expect(withTenant(org,()=>db.journalEntry.update({where:{id:detail.journalId},data:{description:'tamper'}}))).rejects.toThrow();await expect(withTenant(org,()=>db.journalLine.deleteMany({where:{orgId:org,entryId:detail.journalId}}))).rejects.toThrow();await reconciles();
});
test('FC07 tenant and role controls protect all finance resources and composite references',async()=>{
 const p=await customer(),i=await invoice(p.id);expect((await b.get('/api/finance-core/invoices/'+i.id)).status()).toBe(404);expect((await b.post(`/api/finance-core/invoices/${i.id}/approve`,{data:{},headers:{'Idempotency-Key':key()}})).status()).toBe(404);
 for(const role of ['SALES','WAREHOUSE','MEMBER','VIEWER','FINANCE']){
  await db.membership.update({where:{orgId_userId:{orgId:org,userId:user}},data:{role}});
  expect((await a.get('/api/finance-core/trial')).status()).toBe(role==='FINANCE'?200:403);
  if(role==='FINANCE')expect((await a.post('/api/finance-core/periods/nonexistent/close',{data:{},headers:{'Idempotency-Key':key()}})).status()).toBe(403);
 }
 await db.membership.update({where:{orgId_userId:{orgId:org,userId:user}},data:{role:'OWNER'}});
 const foreignAccount=(await get(b,'accounts')).rows[0].id;
 await expect(withTenant(org,()=>db.invoiceLine.create({data:{orgId:org,invoiceId:i.id,name:'foreign account',quantity:1,unitPrice:1,discountRate:0,taxRuleId:tax.id,taxRate:20,taxClassification:'STANDARD',accountId:foreignAccount,net:1,discount:0,tax:0.2,total:1.2}}))).rejects.toThrow();
});
test('FC08 parallel invoice posting idempotency: one source journal; different content rejected',async()=>{
 const p=await customer(),i=await invoice(p.id);await post(a,`finance-core/invoices/${i.id}/approve`,{});const k=key(),body={effectiveOn:date,backdateReason};const rs=await Promise.all(Array.from({length:6},()=>a.post(`/api/finance-core/invoices/${i.id}/post`,{data:body,headers:{'Idempotency-Key':k}})));for(const r of rs)expect(r.status(),await r.text()).toBe(200);
 expect(await withTenant(org,()=>db.journalEntry.count({where:{orgId:org,sourceType:'INVOICE',sourceId:i.id}}))).toBe(1);expect((await a.post(`/api/finance-core/invoices/${i.id}/post`,{data:{...body,reason:'changed'},headers:{'Idempotency-Key':k}})).status()).toBe(409);await reconciles();
});
test('FC09 periods reject unbalanced and closed posting; reversing in another open period is supported',async()=>{
 const c=await request.newContext(options);try{
 await post(c,'auth/register',{email:`fc-period-${randomUUID()}@example.test`,password:randomBytes(20).toString('hex'),name:'Period Owner',company:'Period test'});const boot=await post(c,'finance-core/bootstrap',{acknowledgeInternalPolicy:true,startsOn:year+'-01-01',endsOn:year+'-01-31',name:'January'});const ac=(await get(c,'accounts?take=100')).rows,bank=ac.find((x:any)=>x.purpose==='BANK').id,equity=ac.find((x:any)=>x.purpose==='OPENING').id;
 const body={effectiveOn:year+'-01-01',backdateReason,description:'Opening internal test',opening:true,lines:[{accountId:bank,debit:'100',credit:'0'},{accountId:equity,debit:'0',credit:'100'}]};const j=await post(c,'finance-core/journals',body);
 expect((await c.post('/api/finance-core/journals',{data:{...body,lines:[body.lines[0],{...body.lines[1],credit:'99'}]},headers:{'Idempotency-Key':key()}})).status()).toBe(409);
 await post(c,`finance-core/periods/${boot.period.id}/close`,{});expect((await c.post('/api/finance-core/journals',{data:body,headers:{'Idempotency-Key':key()}})).status()).toBe(409);
 await post(c,'finance-core/periods',{name:'Remaining year',startsOn:year+'-02-01',endsOn:year+'-12-31'});await post(c,`finance-core/journals/${j.id}/reverse`,{effectiveOn:date,backdateReason,reason:'Açık dönemde düzeltme'});await reconciles(c);
 }finally{await c.dispose();}
});

test('FC10 finance UI persists invoice, posts it and shows the same open balance on the statement',async({browser})=>{
 const p=await customer();const c=await browser.newContext({baseURL:origin,storageState:await a.storageState(),reducedMotion:'reduce'});try{
 const page=await c.newPage();await page.goto('/#finance-core');await expect(page.locator('main')).toHaveAttribute('data-view','finance-core');
 await page.getByRole('button',{name:'Fatura taslağı',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Cari',{exact:true}).selectOption(p.id);await dialog.getByLabel('Kalem adı 1',{exact:true}).fill('Gerçek arayüz hizmeti');await dialog.getByLabel('Birim fiyat 1',{exact:true}).fill('800');await dialog.getByLabel('Vergi kuralı 1',{exact:true}).selectOption(tax.id);await dialog.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(dialog).toHaveCount(0);
 const row=page.locator('tr').filter({hasText:p.name});await row.getByRole('button',{name:/Faturayı aç/}).click();await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('button',{name:'Muhasebeleştir',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Kesinleşmiş');
 await page.keyboard.press('Escape');await page.getByLabel('Görünüm',{exact:true}).selectOption('statement');await page.getByLabel('Cari',{exact:true}).selectOption(p.id);await expect(page.locator('main')).toContainText('960,00');
 await expect(page.getByRole('status')).toHaveCount(0,{timeout:7000});await page.screenshot({path:'.local/finance-ui-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/finance-ui-mobile.png',fullPage:true});expect(await page.locator('html').evaluate(e=>e.scrollWidth<=window.innerWidth+1)).toBeTruthy();await page.getByRole('button',{name:'Temayı değiştir',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.screenshot({path:'.local/finance-ui-mobile-light.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.local/finance-ui-desktop-light.png',fullPage:true});
 }finally{await c.close();}
});
test('FC11 Turkish invoice PDF and CSV exports enforce authorization and tenant scope',async()=>{
 const p=await customer(),i=await invoice(p.id);await finalize(i);const r=await a.get(`/api/finance-core/invoices/${i.id}/pdf`);expect(r.status(),await r.text()).toBe(200);expect(r.headers()['content-type']).toContain('application/pdf');const bytes=await r.body();expect(bytes.subarray(0,4).toString()).toBe('%PDF');writeFileSync('.local/finance-sample.pdf',bytes);
 expect((await b.get(`/api/finance-core/invoices/${i.id}/pdf`)).status()).toBe(404);
 const csv=await a.get('/api/finance-core/export?report=trial&take=100');expect(csv.status()).toBe(200);expect(await csv.text()).toContain('debit');expect(csv.headers()['cache-control']).toContain('no-store');
 await db.membership.update({where:{orgId_userId:{orgId:org,userId:user}},data:{role:'SALES'}});try{expect((await a.get(`/api/finance-core/invoices/${i.id}/pdf`)).status()).toBe(403);}finally{await db.membership.update({where:{orgId_userId:{orgId:org,userId:user}},data:{role:'OWNER'}});}
 writeFileSync('.local/finance-test-context.json',JSON.stringify({orgId:org,userId:user,storage:await a.storageState(),invoiceId:i.id}));
});

test('FC12 knowledge cutoff, expired original tax credit, supplier advance and temporal double-use rejection',async()=>{
 const p=await customer(),expired=await post(a,'finance-core/tax-rules',{code:'JAN-EXAMPLE20',classification:'STANDARD',rate:'20',validFrom:year+'-01-01',validTo:year+'-01-31'});
 const i=await invoice(p.id,'1000','SALE',year+'-01-01',year+'-01-10',a,expired.id);const beforePosting=new Date().toISOString();await finalize(i);
 expect((await get(a,`open?partyId=${p.id}&knownAt=${encodeURIComponent(beforePosting)}`)).total).toBe(0);
 const detail=await get(a,'invoices/'+i.id);await post(a,`finance-core/invoices/${i.id}/credit`,{effectiveOn:date,backdateReason,reason:'Kaynak oranıyla iade',lines:[{lineId:detail.lines[0].id,quantity:'0.1'}]});expect((await get(a,'invoices/'+i.id)).credits).toBe('120');
 const payment=await post(a,'finance-core/payments',{partyId:p.id,accountId:acct('BANK'),direction:'IN',amount:'100',effectiveOn:year+'-01-15',backdateReason,name:'Historical cash'});
 const allocation=await post(a,'finance-core/allocations',{paymentId:payment.id,invoiceId:i.id,amount:'100',effectiveOn:year+'-04-01',backdateReason});
 await post(a,`finance-core/allocations/${allocation.id}/reverse`,{effectiveOn:year+'-05-01',backdateReason,reason:'Tarihsel düzeltme'});
 const before=(await get(a,'allocations?take=100')).total;
 expect((await a.post('/api/finance-core/allocations',{data:{paymentId:payment.id,invoiceId:i.id,amount:'100',effectiveOn:year+'-03-01',backdateReason},headers:{'Idempotency-Key':key()}})).status()).toBe(409);
 expect((await get(a,'allocations?take=100')).total).toBe(before);
 const supplier=await customer(a,'suppliers'),advance=await pay(supplier.id,'300',[],'OUT'),purchase=await invoice(supplier.id,'400','PURCHASE');await finalize(purchase);await allocate(advance.id,purchase.id,'300');expect((await get(a,'invoices/'+purchase.id)).open).toBe('180');await reconciles();
});

test('FC13 concurrent internal numbers and payment idempotency create one cash/journal effect',async()=>{
 const p=await customer(),drafts=await Promise.all(Array.from({length:4},()=>invoice(p.id,'10')));expect(new Set(drafts.map(i=>i.number)).size).toBe(4);
 const k=key(),body={partyId:p.id,accountId:acct('BANK'),direction:'IN',amount:'25',effectiveOn:date,name:'Idempotent core cash'};
 const responses=await Promise.all(Array.from({length:6},()=>a.post('/api/finance-core/payments',{data:body,headers:{'Idempotency-Key':k}})));for(const r of responses)expect(r.status(),await r.text()).toBe(200);const rows=await Promise.all(responses.map(r=>r.json()));expect(new Set(rows.map(r=>r.id)).size).toBe(1);expect(await withTenant(org,()=>db.journalEntry.count({where:{orgId:org,sourceType:'PAYMENT',sourceId:rows[0].id}}))).toBe(1);
 expect((await a.post('/api/finance-core/payments',{data:{...body,amount:'26'},headers:{'Idempotency-Key':k}})).status()).toBe(409);await reconciles();
});

test('FC14 legacy cash stays explicit and unposted; compatibility and review references remain auditable',async()=>{
 const before=await withTenant(org,()=>db.journalEntry.count({where:{orgId:org}}));
 const legacy=await post(a,'finance',{name:'Legacy compatibility sample',direction:'IN',amount:'5'});
 const r=await get(a,'reconciliation');expect(r.scope).toBe('POSTED_FINANCE_CORE_ONLY');expect(r.legacyUnpostedPayments).toBe(1);expect(r.legacyIssues[0].entityId).toBe(legacy.id);
 await post(a,`finance/${legacy.id}/reverse`,{reason:'Legacy compatibility reversal'});
 expect(await withTenant(org,()=>db.journalEntry.count({where:{orgId:org}}))).toBe(before);expect((await get(a,'reconciliation')).legacyUnpostedPayments).toBe(2);
});
test('FC15 linked customer subaccount inherits control purpose and reconciles with the party statement',async()=>{
 const p=await customer(),child=await post(a,'finance-core/accounts',{code:'120.001',name:'Customer subaccount',category:'ASSET',parentId:acct('AR'),partyId:p.id});
 await post(a,'finance-core/journals',{opening:true,effectiveOn:date,backdateReason,description:'Verified fixture opening',lines:[{accountId:child.id,debit:'100',credit:'0'},{accountId:acct('OPENING'),debit:'0',credit:'100'}]});
 expect((await get(a,'statement?partyId='+p.id)).balance).toBe('100.00');expect((await get(a,'accounts?take=100')).rows.find((x:any)=>x.id===child.id).resolvedPurpose).toBe('AR');
 await expect(withTenant(org,()=>db.ledgerAccount.update({where:{id:child.id},data:{parentId:acct('BANK')}}))).rejects.toThrow();
 expect((await a.delete('/api/customers/'+p.id)).status()).toBe(409);await reconciles();
});
