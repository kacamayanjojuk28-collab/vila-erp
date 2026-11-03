import 'dotenv/config';import pg from 'pg';import {writeFileSync,readFileSync} from 'node:fs';import {request} from '@playwright/test';
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
const checks={
 orphanProducts:'SELECT count(*)::int n FROM "DocumentLine" l LEFT JOIN "Record" r ON r.id=l."productId" WHERE r.id IS NULL',
 foreignLineTenant:'SELECT count(*)::int n FROM "DocumentLine" l JOIN "Document" d ON d.id=l."documentId" JOIN "Record" r ON r.id=l."productId" WHERE d."orgId"<>r."orgId"',
 negativeStock:'SELECT count(*)::int n FROM "Stock" WHERE quantity<0',
 stockLedgerMismatch:'SELECT count(*)::int n FROM "Stock" s WHERE s.quantity <> COALESCE((SELECT sum(m.quantity) FROM "Movement" m WHERE m."orgId"=s."orgId" AND m."productId"=s."productId" AND m."warehouseId"=s."warehouseId"),0)',
 overpaid:'SELECT count(*)::int n FROM "Document" WHERE paid<0 OR paid>total',
 orphanSource:'SELECT count(*)::int n FROM "Document" d LEFT JOIN "Document" s ON s.id=d."sourceId" WHERE d."sourceId" IS NOT NULL AND s.id IS NULL',
 lineBounds:'SELECT count(*)::int n FROM "DocumentLine" WHERE "fulfilledQuantity"<0 OR "fulfilledQuantity">quantity',
 totals:'SELECT count(*)::int n FROM "Document" d WHERE total<>(SELECT COALESCE(sum(l.total),0) FROM "DocumentLine" l WHERE l."documentId"=d.id)',
 sessionOrphans:'SELECT count(*)::int n FROM "Session" s LEFT JOIN "Membership" m ON m."orgId"=s."orgId" AND m."userId"=s."userId" WHERE m.id IS NULL'
};const results={};for(const [k,q]of Object.entries(checks))results[k]=(await c.query(q)).rows[0].n;
results.tables=(await c.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n;await c.end();
const creds=JSON.parse(readFileSync(process.env.VILA_VISUAL_CREDENTIALS,'utf8'));const api=await request.newContext({baseURL:process.env.VILA_TEST_ORIGIN,extraHTTPHeaders:{Origin:process.env.VILA_TEST_ORIGIN}});const login=await api.post('/api/auth/login',{data:{email:creds.email,password:creds.password}});if(!login.ok())throw Error('Login failed');const times=[];let bytes=0;for(let i=0;i<20;i++){const start=performance.now();const r=await api.get('/api/dashboard');if(!r.ok())throw Error('Dashboard failed');bytes=(await r.body()).length;times.push(performance.now()-start)}times.sort((a,b)=>a-b);results.dashboard={samples:20,p50ms:times[9],p95ms:times[18],bytes,scope:'single local demo tenant, sequential, not a load test'};await api.dispose();writeFileSync('docs/verification/audit-integrity-metrics.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
