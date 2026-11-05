import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
test('Cashflow expansion stays inside viewport and restores grid size',async({browser})=>{

 for(const reducedMotion of ['reduce','no-preference'] as const){
 const ctx=await browser.newContext({baseURL:process.env.VILA_TEST_ORIGIN,viewport:{width:1440,height:1000},reducedMotion});
 const page=await ctx.newPage();
 const response=await ctx.request.post('/api/auth/register',{headers:{Origin:process.env.VILA_TEST_ORIGIN!},data:{email:'expand-'+randomUUID()+'@example.test',password:'Expand-test-'+randomUUID(),name:'Expand test',company:'Expand test'}});
 expect(response.status()).toBe(200);
 const fixtures=JSON.parse(readFileSync('.local/rc-visual-fixtures.json','utf8'));
 await page.route('**/api/dashboard-engine/widget?type=cashflow*',async route=>{
 const u=new URL(route.request().url());const fixture=fixtures[u.pathname+u.search];
 if(!fixture)throw Error('Missing cashflow visual fixture');
 const headers = route.request().headers();
 await route.fulfill({...fixture,headers:{...fixture.headers,"X-Vila-Company":headers["x-vila-company"],"X-Vila-User":headers["x-vila-user"]}});
 });
 await page.goto('/');
 await expect(page.locator('.widget-cashflow')).toBeVisible();
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});
 await expect(page.locator('.widget-body .skeleton')).toHaveCount(0);
 const card=page.locator('.widget-cashflow');
 await card.scrollIntoViewIfNeeded();
 // FLIP measures the starting rectangle. Finish the entrance animation first
 // so this regression isolates expansion and restoration of the settled card.
 await expect(card).toHaveCSS('transform','none');
 await expect(card).toHaveCSS('opacity','1');
 const original=await card.boundingBox();
 await page.getByRole('button',{name:'Genişlet Nakit akışı',exact:true}).click();
 await expect(card).toHaveAttribute('role','dialog');
 await expect(card).toHaveCSS('transform','none');
 await expect(card.locator('svg.chart')).toBeVisible();
 await expect.poll(()=>card.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs((r.left+r.right)/2-innerWidth/2);})).toBeLessThan(2);
 await expect.poll(()=>card.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})).toBe(true);
 const close=page.getByRole('button',{name:'Daralt Nakit akışı',exact:true});
 await expect(close).toBeInViewport();
 await expect.poll(()=>card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/cashflow-expanded-${width}-${reducedMotion}.png`});
 await page.keyboard.press('Escape');
 await expect(card).not.toHaveClass(/is-focus/);
 await expect.poll(async()=>Math.abs((await card.boundingBox())!.width-original!.width)).toBeLessThan(2);
 await expect(page.locator('.card-scrim')).toHaveCount(0);
 }
 await ctx.close();
 }
});
