import { request } from "../company-request";
import { test, expect } from "@playwright/test";
import { randomBytes, scryptSync } from 'node:crypto';
import { db } from '../../src/lib/db';
import { hash } from '../../src/lib/security';
import { assertIsolated, tenantDb } from '../isolated';
const origin=process.env.VILA_TEST_ORIGIN!;
test.beforeAll(assertIsolated);
test.afterAll(()=>db.$disconnect());
test('RC read RBAC: API, dashboard, history, deliveries and UI across seven roles',async({browser})=>{
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 const email=`rbac-${Date.now()}@example.test`,password=randomBytes(20).toString('hex');
 try {
 expect((await api.post('/api/auth/register',{data:{email,password,name:'Release Test',company:'RC RBAC'}})).status()).toBe(200);
 const me=await(await api.get('/api/me')).json(), scoped=tenantDb(me.org.id);
 const contact=await scoped.record.create({data:{orgId:me.org.id,kind:'customers',name:'RC Contact',data:{}}});
 const warehouse=await scoped.record.create({data:{orgId:me.org.id,kind:'warehouses',name:'RC Warehouse',data:{}}});
 const docs:Record<string,string>={};
 for(const kind of ['sales','quotes','purchases','requests'])docs[kind]=(await scoped.document.create({data:{orgId:me.org.id,kind,name:'RC '+kind,contactId:contact.id,warehouseId:warehouse.id,total:0}})).id;
 const expected:Record<string,string[]>={OWNER:['finance','audit','sales','quotes','purchases','requests'],ADMIN:['finance','audit','sales','quotes','purchases','requests'],SALES:['sales','quotes'],WAREHOUSE:['purchases','requests'],FINANCE:['finance','sales','purchases'],MEMBER:[],VIEWER:[]};
 for(const [role,allowed]of Object.entries(expected)){
  await db.membership.update({where:{orgId_userId:{orgId:me.org.id,userId:me.user.id}},data:{role:role as any}});
  for(const scope of ['finance','audit','sales','quotes','purchases','requests']){
   expect((await api.get('/api/'+scope)).status(),role+':'+scope).toBe(allowed.includes(scope)?200:403);
   if(['sales','purchases'].includes(scope))expect((await api.get(`/api/${scope}/${docs[scope]}/deliveries`)).status(),role+':deliveries').toBe(allowed.includes(scope)?200:403);
  }
  for(const query of ['','?view=summary']){
   const d=await(await api.get('/api/dashboard'+query)).json();
   for(const field of ['income','expense','net','aging','overdue','receivable','payable',query?'monthlyPayments':'payments']){
    if(allowed.includes('finance'))expect(d).toHaveProperty(field);else expect(d).not.toHaveProperty(field);
   }
   if(!allowed.includes('audit'))expect(d.activities).toEqual([]);
   if(!query)expect(d.documents.map((x:any)=>x.kind).sort()).toEqual(allowed.filter(k=>Object.hasOwn(docs,k)).sort());
   expect(Object.keys(d.reports).sort()).toEqual(allowed.filter(k=>['sales','purchases'].includes(k)).sort());
  }
  const history=await(await api.get('/api/history/'+contact.id)).json();
  expect(history.documents.map((x:any)=>x.kind).sort()).toEqual(allowed.filter(k=>Object.hasOwn(docs,k)).sort());
  const c=await browser.newContext({baseURL:origin,storageState:await api.storageState(),reducedMotion:'reduce'}),p=await c.newPage();
  await p.goto('/');await expect(p.locator('.overview')).toBeVisible();
  await expect(p.getByRole('heading',{name:'Finansal durum',exact:true})).toHaveCount(allowed.includes('finance')?1:0);
  await expect(p.locator('.tabs').getByRole('button',{name:'Finans',exact:true})).toHaveCount(allowed.includes('finance')?1:0);
  await p.goto('/#finance');
  if(!allowed.includes('finance'))await expect(p.locator('main [role=alert]')).toContainText('yetkiniz yok');
  await c.close();
 }
 }finally{await api.dispose();}
});
test('RC login budgets: atomic concurrency, spoof resistance, success and account recovery; password change and historical hash',async()=>{
 const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 const email=`login-${Date.now()}@example.test`,password=randomBytes(20).toString('hex');
 const account=hash(email),pair='login-pair:'+hash('unverified:'+account),ip='login-ip:'+hash('unverified');
 try{
 expect((await api.post('/api/auth/register',{data:{email,password,name:'Login Test',company:'RC Login'}})).status()).toBe(200);
 const me=await(await api.get('/api/me')).json();
 // Verify an actual historical hash at the HTTP boundary.
 const salt='1234567890abcdef1234567890abcdef';await db.user.update({where:{id:me.user.id},data:{password:salt+':'+scryptSync(password,salt,64,{N:16384}).toString('hex')}});
 const login=(p=password,headers={})=>api.post('/api/auth/login',{data:{email,password:p},headers});
 for(let i=0;i<22;i++)expect((await login()).status()).toBe(200);
 expect((await db.rateLimit.findUnique({where:{key:pair}}))!.count).toBe(0);
 await db.$executeRaw`INSERT INTO "RateLimit" (key,count,until) VALUES (${'login-account:'+account},30,clock_timestamp()+interval '10 minutes') ON CONFLICT (key) DO UPDATE SET count=30,until=clock_timestamp()+interval '10 minutes'`;
 expect((await login('wrong-password-here')).status()).toBe(429);
 expect((await login()).status()).toBe(200); // Remote account-wide exhaustion cannot deny a correct password.
 await db.rateLimit.deleteMany({where:{key:{in:[pair,'login-account:'+account]}}});
 const attempts=await Promise.all(Array.from({length:25},(_,i)=>login('wrong-password-here',{'X-Forwarded-For':`192.0.2.${i+1}`})));
 expect(attempts.filter(r=>r.status()===401)).toHaveLength(20);
 expect(attempts.filter(r=>r.status()===429)).toHaveLength(5);
 expect((await db.rateLimit.findUnique({where:{key:pair}}))!.count).toBe(25);
 // Concurrent successes release only their own reservations, preserving failures.
 await db.rateLimit.deleteMany({where:{key:{in:[pair,'login-account:'+account]}}});
 const mixed=await Promise.all(Array.from({length:12},(_,i)=>login(i%2?password:'wrong-password-here')));
 expect(mixed.filter(r=>r.status()===200)).toHaveLength(6);
 expect(mixed.filter(r=>r.status()===401)).toHaveLength(6);
 expect((await db.rateLimit.findUnique({where:{key:pair}}))!.count).toBe(6);
 // Fixed window expiry permits recovery; success releases just its reservation.
 await db.rateLimit.update({where:{key:pair},data:{until:new Date(0)}});
 expect((await login()).status()).toBe(200);
 const changed=password+'new';expect((await api.post('/api/password',{data:{currentPassword:password,newPassword:changed}})).status()).toBe(200);
 expect((await login()).status()).toBe(401);expect((await login(changed)).status()).toBe(200);
 // An exhausted IP budget is independent of the account and cannot be spoofed.
 await db.rateLimit.update({where:{key:ip},data:{count:300}});
 expect((await login(changed,{'X-Forwarded-For':'203.0.113.50'})).status()).toBe(429);
 }finally{
  await db.rateLimit.deleteMany({where:{key:{in:[pair,'login-account:'+account,ip]}}});await api.dispose();
 }
});
