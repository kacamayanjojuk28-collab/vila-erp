import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
if(process.env.VILA_TEST_ORIGIN!=='http://localhost:3100')throw Error('Isolated origin required');
const browser=await chromium.launch({channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{
    window.__vitals={lcp:0,cls:0};
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__vitals.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__vitals.cls+=e.value}).observe({type:'layout-shift',buffered:true});
  });
  await page.goto(process.env.VILA_TEST_ORIGIN);
  await page.getByRole('button',{name:'Giriş yap',exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1500);
  const result=await page.evaluate(()=>({ ...window.__vitals,ttfb:performance.getEntriesByType('navigation')[0].responseStart,jsBytes:performance.getEntriesByType('resource').filter(e=>e.name.includes('.js')).reduce((n,e)=>n+e.transferSize,0),fontResources:performance.getEntriesByType('resource').filter(e=>e.name.includes('.woff')).length}));
  if (!result.lcp) result.lcp=null;
  result.scope='One local desktop login load; null LCP means no entry observed, not zero latency; no field p75, INP or Lighthouse claim';
  writeFileSync(`docs/verification/seo-performance-${process.argv[2]||'before'}.json`,JSON.stringify(result,null,2));
  console.log(result);
} finally {await browser.close()}
