import {request} from '@playwright/test';import {readFileSync,writeFileSync} from 'node:fs';
if(process.env.VILA_TEST_ORIGIN!=='http://localhost:3200')throw Error('Sprint origin required');
const creds=JSON.parse(readFileSync(process.env.VILA_VISUAL_CREDENTIALS,'utf8')),orgs=JSON.parse(readFileSync('.local/load-tenants.json','utf8'));
const clients=[];const results=[];
try{
 for(const orgId of orgs){const c=await request.newContext({baseURL:process.env.VILA_TEST_ORIGIN,extraHTTPHeaders:{Origin:process.env.VILA_TEST_ORIGIN}});clients.push(c);const login=await c.post('/api/auth/login',{data:creds});if(!login.ok())throw Error('Login '+login.status());if(!(await c.post('/api/switch',{data:{orgId}})).ok())throw Error('Switch failed')}
 for(const concurrency of [1,4,20]){
  const times=[],bytes=[],errors=[];let index=0;
  await Promise.all(Array.from({length:concurrency},async()=>{while(index<80){const i=index++,start=performance.now();try{
   const r=await clients[i%2].get('/api/dashboard?view=summary',{timeout:60000});times.push(performance.now()-start);bytes.push((await r.body()).length);
   if(!r.ok())errors.push({request:i,status:r.status()});else{const d=await r.json();if(d.expense!=='10000'||d.net!=='-10000'||d.payable!=='0'||d.records.some(x=>x.orgId!==orgs[i%2])||'documents'in d||'payments'in d)errors.push({request:i,error:'Totals/isolation/summary contract'})}
  }catch(e){times.push(performance.now()-start);errors.push({request:i,error:e.message})}}}));
  times.sort((a,b)=>a-b);const stage={concurrency,requests:80,p50ms:times[39],p95ms:times[75],p99ms:times[79],maxBytes:Math.max(...bytes),errors};results.push(stage);console.log(JSON.stringify(stage));
 }
 writeFileSync('docs/verification/sprint-load.json',JSON.stringify({scope:'240 HTTP requests, two tenant sessions, 10000 documents per tenant; 1/4/20 in-flight requests, not a sustained soak or 20 distinct users',results},null,2));
 if(results.some(x=>x.errors.length))process.exitCode=1;
}finally{await Promise.all(clients.map(c=>c.dispose()))}
