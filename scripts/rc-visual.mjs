import {chromium,request,expect} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
if(process.env.VILA_TEST_ORIGIN!=='http://localhost:3300')throw Error('RC origin required');
const origin=process.env.VILA_TEST_ORIGIN,credentials=JSON.parse(readFileSync(process.env.VILA_VISUAL_CREDENTIALS,'utf8'));
const api=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
const login=await api.post('/api/auth/login',{data:credentials});if(!login.ok())throw Error('Visual fixture login failed');
const cache=new Map(),browser=await chromium.launch({channel:'msedge',args:['--disable-gpu']}),results=[];
mkdirSync('docs/verification/rc-visual',{recursive:true});
try{
for(const [width,height] of [[1440,1000],[390,844]])for(const theme of ['dark','light'])for(const view of ['overview','settings','customers','finance','projects','calendar']){
 const shots=[];
 for(const target of ['http://localhost:3200',origin]){
  const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await c.newPage();
  await p.addInitScript(t=>localStorage.setItem('vila-theme',t),theme);
  await p.clock.setFixedTime(new Date('2026-11-01T09:00:00Z'));
  await p.route('**/api/**',async route=>{
   const u=new URL(route.request().url()),key=u.pathname+u.search;
   if(!cache.has(key)){const r=await api.get(key);if(!r.ok())throw Error('Visual fixture '+key+' failed');cache.set(key,{status:r.status(),contentType:'application/json',body:await r.text()});}
   await route.fulfill(cache.get(key));
  });
  await p.goto(target+'/#'+view);await expect(p.locator('main')).toHaveAttribute('data-view',view);await expect(p.locator('.skeleton')).toHaveCount(0);await p.evaluate(()=>document.fonts.ready);
  await expect(p.locator('.top .brand')).toHaveText('VILA');
  await expect(p.locator('.nav-pill')).toHaveCSS('opacity',['settings','calendar'].includes(view)?'0':'1');
  shots.push(await p.screenshot({fullPage:true,animations:'disabled',mask:[p.locator('input[type=email]')]}));await c.close();
 }
 const name=`${view}-${theme}-${width}.png`,identical=shots[0].equals(shots[1]);
 writeFileSync('docs/verification/rc-visual/reference-'+name,shots[0]);writeFileSync('docs/verification/rc-visual/candidate-'+name,shots[1]);results.push({view,theme,width,height,identicalPng:identical});
}
writeFileSync('docs/verification/rc-visual-parity.json',JSON.stringify({reference:'Preserved 3200 approved VILA wordmark UI',method:'Identical RC API fixtures, fixed clock, fonts ready, reduced motion; no functional API mocks',results},null,2));
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.identicalPng))throw Error('RC visual parity failed');
// Update baseline only after every preserved-reference comparison passes.
const snapshots='tests/e2e/visual.spec.ts-snapshots/';
for(const r of results){const name=`${r.view}-${r.theme}-${r.width}`;writeFileSync(snapshots+name+'-win32.png',readFileSync('docs/verification/rc-visual/candidate-'+name+'.png'));}
for(const view of ['overview','settings','customers','finance','projects','calendar'])writeFileSync(snapshots+view+'-dark-win32.png',readFileSync(`docs/verification/rc-visual/candidate-${view}-dark-1440.png`));
writeFileSync(snapshots+'settings-light-win32.png',readFileSync('docs/verification/rc-visual/candidate-settings-light-1440.png'));
writeFileSync(snapshots+'settings-mobile-win32.png',readFileSync('docs/verification/rc-visual/candidate-settings-light-390.png'));
// Fixture is local-only: may contain authenticated demo responses. Never commit.
writeFileSync('.local/rc-visual-fixtures.json',JSON.stringify(Object.fromEntries(cache)));
}finally{await browser.close();await api.dispose();}
