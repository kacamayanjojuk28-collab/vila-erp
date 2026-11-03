import pg from 'pg';import {writeFileSync} from 'node:fs';
const u=new URL(process.env.MIGRATION_DATABASE_URL);if(u.port!=='8543'||u.pathname!=='/vila_rc_090')throw Error('Sprint DB required');
const c=new pg.Client({connectionString:u.href});await c.connect();
try{
 const queries={negativeStock:'SELECT count(*)::int n FROM "Stock" WHERE quantity<0',stockMismatch:'SELECT count(*)::int n FROM "Stock" s WHERE s.quantity<>COALESCE((SELECT sum(m.quantity) FROM "Movement" m WHERE m."orgId"=s."orgId" AND m."productId"=s."productId" AND m."warehouseId"=s."warehouseId"),0)',foreignLines:'SELECT count(*)::int n FROM "DocumentLine" l JOIN "Document" d ON d.id=l."documentId" JOIN "Record" r ON r.id=l."productId" WHERE l."orgId"<>d."orgId" OR l."orgId"<>r."orgId"',overpaid:'SELECT count(*)::int n FROM "Document" WHERE paid<0 OR paid>total',lineBounds:'SELECT count(*)::int n FROM "DocumentLine" WHERE "fulfilledQuantity"<0 OR "fulfilledQuantity">quantity'};
 const result={};for(const [name,sql]of Object.entries(queries))result[name]=(await c.query(sql)).rows[0].n;
 result.documentTotalExceptions=(await c.query('SELECT name,total::text,(SELECT count(*)::int FROM "DocumentLine" l WHERE l."documentId"=d.id) AS lines FROM "Document" d WHERE total<>(SELECT COALESCE(sum(l.total),0) FROM "DocumentLine" l WHERE l."documentId"=d.id)')).rows;
 result.migrations=(await c.query('SELECT migration_name,finished_at IS NOT NULL AS applied FROM "_prisma_migrations" ORDER BY migration_name')).rows;
 writeFileSync('docs/verification/rc-integrity.json',JSON.stringify(result,null,2));console.log(result);
 if(Object.values(result).some(v=>typeof v==='number'&&v!==0))process.exitCode=1;
}finally{await c.end()}
