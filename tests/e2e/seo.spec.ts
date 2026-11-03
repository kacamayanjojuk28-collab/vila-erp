import { assertIsolated, tenantDb } from "../isolated";
import {test,expect} from '@playwright/test';
import sharp from 'sharp';

test('Private shell metadata, crawl policy and unauthenticated API remain safe',async({page,request})=>{
  assertIsolated();
  const response=await page.goto('/');
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  await expect(page).toHaveTitle('VILA ERP — İşletme çalışma alanı');
  await expect(page.locator('html')).toHaveAttribute('lang','tr');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content','tr_TR');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/VILA ERP/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  const robots=await request.get('/robots.txt');
  expect(robots.status()).toBe(200);expect(await robots.text()).toContain('Allow: /');
  const sitemap=await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);expect(await sitemap.text()).not.toContain('<loc>');
  const me=await request.get('/api/me');expect(me.status()).toBe(401);
  expect(me.headers()['cache-control']).toContain('no-store');
  expect((await request.get('/this-route-does-not-exist')).status()).toBe(404);
});

test('Manifest and brand assets have real formats and dimensions',async({request})=>{
  const response=await request.get('/manifest.webmanifest');expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('manifest');
  const manifest=await response.json();expect(manifest.name).toBe('VILA ERP');expect(manifest.start_url).toBe('/');
  for(const item of manifest.icons){const response=await request.get(item.src);expect(response.status()).toBe(200);const meta=await sharp(await response.body()).metadata();expect(meta.format).toBe('png');expect(`${meta.width}x${meta.height}`).toBe(item.sizes)}
  for(const [name,size] of [['icon-16',16],['icon-32',32],['icon-48',48],['apple-touch-icon',180]] as const){const r=await request.get(`/brand/${name}.png`);expect(r.status()).toBe(200);expect(r.headers()['content-type']).toContain('image/png');const m=await sharp(await r.body()).metadata();expect(m.width).toBe(size);expect(m.height).toBe(size)}
  const og=await request.get('/brand/og.png');expect(og.status()).toBe(200);const image=await sharp(await og.body()).metadata();expect([image.width,image.height]).toEqual([1200,630]);
  const svg=await request.get('/brand/icon.svg');expect(svg.status()).toBe(200);expect(svg.headers()['content-type']).toContain('image/svg+xml');expect(await svg.text()).toContain('<path');
  const ico=await request.get('/brand/favicon.ico');expect(ico.status()).toBe(200);const bytes=await ico.body();expect(bytes.readUInt16LE(2)).toBe(1);expect(bytes.readUInt16LE(4)).toBe(3);
  for(let i=0;i<3;i++){const p=6+i*16,offset=bytes.readUInt32LE(p+12),length=bytes.readUInt32LE(p+8);const m=await sharp(bytes.subarray(offset,offset+length)).metadata();expect(m.width).toBe([16,32,48][i])}
});
