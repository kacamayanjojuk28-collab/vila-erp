import {readFileSync,existsSync,readdirSync,statSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const result={capturedAt:new Date().toISOString(),http:{},builds:{},source:{}};
for(const port of [3000,3100,3200]){try{const r=await fetch(`http://localhost:${port}/api/health`,{signal:AbortSignal.timeout(3000)});result.http[port]={status:r.status,body:await r.text()}}catch(e){result.http[port]={error:e.cause?.code||e.name,message:e.message}}}
function scripts(root){if(!existsSync(root))return [];return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scripts(root+'/'+e.name):e.name.endsWith('.js')?[root+'/'+e.name]:[])}
for(const directory of ['.next','.next-audit','.next-sprint']){
 const text=scripts(directory+'/server').map(p=>readFileSync(p,'utf8')).join('\n');
 result.builds[directory]={buildId:existsSync(directory+'/BUILD_ID')?readFileSync(directory+'/BUILD_ID','utf8').trim():null,markers:{summary:text.includes('monthlyPayments'),requiredKey:text.includes('Idempotency-Key başlığı gereklidir'),rls:text.includes('vila.tenant_id'),seo:text.includes('VILA_PUBLIC_ORIGIN')}};
}
for(const path of ['src/lib/db.ts','src/app/api/[...path]/route.ts','src/components/motion.ts','src/components/workspace.tsx','src/app/globals.css','prisma/schema.prisma','.env'])if(existsSync(path))result.source[path]={sha256:hash(path)};
writeFileSync('docs/verification/sprint-environment.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));


