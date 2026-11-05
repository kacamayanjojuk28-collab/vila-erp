import {request,chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {assertIsolated,tenantDb} from '../tests/isolated';
import {db} from '../src/lib/db';

async function verify(){
 assertIsolated();
 if(process.env.VILA_TEST_ORIGIN!=='http://localhost:3500')throw Error('Isolated dashboard required.');
 const origin='http://localhost:3501';
 const api=await request.newContext({baseURL:process.env.VILA_TEST_ORIGIN,extraHTTPHeaders:{Origin:process.env.VILA_TEST_ORIGIN!}});
 let server:ReturnType<typeof spawn>|undefined;
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try {
  const response=await api.post('/api/auth/register',{data:{name:'Provider test',company:'Provider integration test',email:randomUUID()+'@example.test',password:randomUUID()}});
  expect(response.status()).toBe(200);
  const {org:{id:orgId}}=await(await api.get('/api/me')).json();
  const tx=tenantDb(orgId);
  const customer=await tx.record.create({data:{orgId,kind:'customers',name:'Test customer',data:{}}});
  const warehouse=await tx.record.create({data:{orgId,kind:'warehouses',name:'Test warehouse',data:{}}});
  await tx.document.create({data:{orgId,kind:'sales',status:'CONFIRMED',contactId:customer.id,warehouseId:warehouse.id,name:'Test order',total:0}});
  server=spawn(process.execPath,['--require',resolve('tests/intelligence-provider-mock.cjs'),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3501'],{
   windowsHide:true,stdio:'inherit',env:{...process.env,APP_ORIGIN:origin,VILA_AI_APPROVED_TENANTS:orgId,VILA_AI_KEY:'isolated-test-credential',VILA_AI_MODEL:'mock',VILA_AI_INPUT_USD_PER_MTOK:'1',VILA_AI_OUTPUT_USD_PER_MTOK:'1',VILA_AI_DAILY_USD:'1'}});
  for(let i=0;i<80;i++){
   if(server.exitCode!==null)throw Error('Isolated mock server failed');
   if(await fetch(origin).then(r=>r.ok).catch(()=>false))break;
   await delay(150);
  }
  browser=await chromium.launch({channel:'msedge'});
  const ctx=await browser.newContext({baseURL:origin,storageState:await api.storageState(),reducedMotion:'reduce'});
  const page=await ctx.newPage(); await page.goto('/');
  await page.getByRole('button',{name:"Dashboard'u Özelleştir"}).click();
  await page.getByRole('button',{name:'Widget Ekle',exact:true}).click();await page.getByRole('button',{name:'VILA Intelligence ekle',exact:true}).click();
  await page.getByRole('button',{name:'Kapat',exact:true}).click();await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  const widget=page.locator('[data-widget-type="intelligence"]');
  page.once('dialog',dialog=>dialog.accept());
  await widget.getByRole('button',{name:'Analizi yenile'}).click();
  await expect(widget).toContainText('Açık satış siparişleri toplamı 1.');
  await page.reload();
  await expect(widget).toContainText('Son analiz');
  console.log('PASS: real sales record, explicit admin approval, HTTP adapter mock, validated widget output and cached reload.');
 }finally{
  await browser?.close();
  if(server && server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  await api.dispose();await db.$disconnect();
 }
}
verify().catch(e=>{console.error(e.message);process.exitCode=1;});
