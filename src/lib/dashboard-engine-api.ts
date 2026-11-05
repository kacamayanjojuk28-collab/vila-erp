import { overview } from "./intelligence";
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from './db';
import { AppError,type Actor } from './security';
import { allowed,defaults,layoutSchema,settingsSchema,upgrade,widgetRegistry,type Settings } from './dashboard-registry';
import { financeReport } from './finance-reports';
import { setFinanceClock } from './finance-ledger';
type Tx=Prisma.TransactionClient;
const range=(s:Settings)=>{const now=new Date(),from=s.period==='30d'?new Date(now.getTime()-30*86400000):s.period==='month'?new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)):new Date('0001-01-01');return {gte:from,lte:now};};
const moneySum=(tx:Tx,a:Actor,s:Settings)=>tx.payment.groupBy({by:['direction'],where:{orgId:a.orgId,createdAt:range(s)},_sum:{amount:true}});
const documents=(kind:string)=>async(tx:Tx,a:Actor,s:Settings)=>({rows:await tx.document.groupBy({by:['status'],where:{orgId:a.orgId,kind,archived:false,createdAt:range(s)},_sum:{total:true,paid:true},_count:{_all:true}})});
const taskCounts=async(tx:Tx,a:Actor)=>{const rows=await tx.record.groupBy({by:['status'],where:{orgId:a.orgId,kind:'tasks',archived:false},_count:{_all:true}});const total=rows.reduce((n,r)=>n+r._count._all,0),done=rows.find(r=>r.status==='DONE')?._count._all??0;return {total,done,rate:total?Math.round(done/total*100):0};};
const financial=async(tx:Tx,a:Actor,s:Settings)=>{const rows=await tx.$queryRaw<any[]>(Prisma.sql`SELECT kind,coalesce(sum(total-paid),0)::text amount FROM "Document" WHERE "orgId"=${a.orgId} AND archived=false AND status<>'DRAFT' AND kind IN ('sales','purchases') AND "createdAt">=${range(s).gte} AND "createdAt"<=${range(s).lte} GROUP BY kind`);const payments=await moneySum(tx,a,s);const income=payments.find(p=>p.direction==='IN')?._sum.amount??new Prisma.Decimal(0),expense=payments.find(p=>p.direction==='OUT')?._sum.amount??new Prisma.Decimal(0);return {income:income.toString(),expense:expense.toString(),net:income.sub(expense).toString(),receivable:rows.find(r=>r.kind==='sales')?.amount??'0',payable:rows.find(r=>r.kind==='purchases')?.amount??'0',meaning:'Operasyonel kayıtlar'};};
export const widgetData:Record<string,(tx:Tx,a:Actor,s:Settings)=>Promise<any>>={
 income:async(tx,a,s)=>{const p=await moneySum(tx,a,s);return {value:p.find(r=>r.direction==='IN')?._sum.amount?.toString()??'0'};},
 receivable:async(tx,a,s)=>({value:(await financial(tx,a,s)).receivable}),
 completion:taskCounts,team:taskCounts,financial,
 cashflow:async(tx,a,s)=>{const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);start.setUTCMonth(start.getUTCMonth()-s.months+1);const from=range(s).gte>start?range(s).gte:start;return {rows:await tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char("createdAt",'YYYY-MM') AS "month",direction,sum(amount)::text amount FROM "Payment" WHERE "orgId"=${a.orgId} AND "createdAt">=${from} AND "createdAt"<=${new Date()} GROUP BY "month",direction ORDER BY "month"`)};},
 opportunities:async(tx,a,s)=>({rows:await tx.$queryRaw<any[]>(Prisma.sql`SELECT id,name,amount::text,data FROM "Record" WHERE "orgId"=${a.orgId} AND kind='deals' AND archived=false AND coalesce(data->>'stage','') NOT IN ('WON','LOST') ORDER BY ${s.sort==='amount'?Prisma.sql`amount DESC`:Prisma.sql`nullif(data->>'dueDate','') ASC NULLS LAST`},id LIMIT ${s.limit}`)}),
 sales:documents('sales'),purchases:documents('purchases'),
 pipeline:async(tx,a)=>({rows:await tx.$queryRaw<any[]>`SELECT coalesce(data->>'stage','NEW') name,count(*)::int count,sum(amount)::text amount FROM "Record" WHERE "orgId"=${a.orgId} AND kind='deals' AND archived=false GROUP BY 1 ORDER BY 1`}),
 balances:async(tx,a)=>{await setFinanceClock(tx);const r=await financeReport(a,'open',new URL('http://local/?take=1'),tx);return {rows:(r as any).totals??[],meaning:'Kesinleşmiş Finance Core faturaları'};},
 overdue:async(tx,a)=>{await setFinanceClock(tx);const r=await financeReport(a,'aging',new URL('http://local/'),tx);return {rows:(r as any).rows.filter((r:any)=>r.kind==='SALE'&&r.bucket!=='NOT_DUE'),meaning:'Muhasebeleştirilmiş, vadesi geçmiş satış faturaları'};},
 stock:async(tx,a,s)=>({rows:await tx.$queryRaw<any[]>(Prisma.sql`SELECT r.id,r.name,r.data->>'sku' sku,coalesce(sum(s.quantity),0)::text quantity FROM "Record" r LEFT JOIN "Stock" s ON s."orgId"=r."orgId" AND s."productId"=r.id WHERE r."orgId"=${a.orgId} AND r.kind='products' AND r.archived=false AND coalesce(r.data->>'unit','') NOT IN ('HIZMET','SAAT') GROUP BY r.id HAVING coalesce(sum(s.quantity),0)<= CASE WHEN r.data->>'minStock' ~ '^[0-9]+(\.[0-9]+)?$' THEN (r.data->>'minStock')::numeric ELSE 0 END ORDER BY r.name,r.id LIMIT ${s.limit}`)}),
 projects:async(tx,a,s)=>({rows:await tx.record.findMany({where:{orgId:a.orgId,kind:'projects',archived:false,...(s.status==='all'?{}:{status:s.status==='done'?'DONE':{not:'DONE'}})},select:{id:true,name:true,status:true,data:true},orderBy:[{updatedAt:'desc'},{id:'asc'}],take:s.limit})}),
 tasks:async(tx,a,s)=>({rows:await tx.$queryRaw<any[]>(Prisma.sql`SELECT id,name,status,data FROM "Record" WHERE "orgId"=${a.orgId} AND kind='tasks' AND archived=false ${s.status==='done'?Prisma.sql`AND status='DONE'`:s.status==='active'?Prisma.sql`AND status<>'DONE'`:Prisma.empty} ORDER BY nullif(data->>'dueDate','') ASC NULLS LAST,id LIMIT ${s.limit}`)}),
 activity:async(tx,a,s)=>({rows:await tx.audit.findMany({where:{orgId:a.orgId},select:{id:true,action:true,createdAt:true},orderBy:[{createdAt:'desc'},{id:'asc'}],take:s.limit})})
};
export async function handleDashboardEngine(req:Request,path:string[],body:unknown,a:Actor,url:URL){
 if(path.length!==1||!['preferences','widget','intelligence'].includes(path[0]))throw new AppError('Dashboard adresi bulunamadı.',404);
 if(path[0]==='intelligence'){
  if(req.method!=='POST')throw new AppError('Yöntem desteklenmiyor.',405);
  z.object({confirmExternalProcessing:z.literal(true)}).strict().parse(body);
  return NextResponse.json(await overview(a,true));
 }
 if(path[0]==='widget'){
  if(req.method!=='GET')throw new AppError('Yöntem desteklenmiyor.',405);const type=url.searchParams.get('type')??'';if(!Object.hasOwn(widgetRegistry,type))throw new AppError('Bilinmeyen widget.');if(!allowed(a.role,type))throw new AppError('Bu widget için yetkiniz yok.',403);
  if(type==='intelligence')return NextResponse.json(await overview(a));
  let raw;try{raw=JSON.parse(url.searchParams.get('settings')||'{}');}catch{throw new AppError('Geçersiz ayarlar.');}const settings=settingsSchema.parse(raw);
  return NextResponse.json(await db.$transaction(tx=>widgetData[type](tx,a,settings),{isolationLevel:'RepeatableRead',timeout:15000}),{headers:{'Cache-Control':'private, no-store'}});
 }
 const key={orgId:a.orgId,userId:a.userId,dashboardKey:'overview'};
 try{return await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT set_config('vila.user_id',${a.userId},true)`;
  const old=await tx.dashboardPreference.findUnique({where:{orgId_userId_dashboardKey:key}});
  const result=()=>({...(!old||old.isDefault?defaults(a.role):upgrade(old,a.role)),version:old?.version??0,isDefault:!old||old.isDefault});
  if(req.method==='GET')return NextResponse.json(result(),{headers:{'Cache-Control':'private, no-store'}});
  if(req.method!=='POST')throw new AppError('Yöntem desteklenmiyor.',405);
  const v=z.object({version:z.number().int().min(0),reset:z.boolean().default(false),document:layoutSchema.optional()}).strict().parse(body);
  if(v.version!==(old?.version??0))throw new AppError('Düzen başka bir sekmede değişti. Taslağınız korunuyor; güncel düzeni yükleyin.',409);
  const doc=v.reset?defaults(a.role):v.document;if(!doc)throw new AppError('Yerleşim zorunlu.');
  const previous=old?upgrade(old,a.role).widgets:[];
  for(const w of doc.widgets)if(!allowed(a.role,w.type)&&!previous.some(p=>p.id===w.id&&p.type===w.type))throw new AppError('Yetkisiz widget eklenemez.',403);
  const data={schemaVersion:2,version:v.version+1,isDefault:v.reset,widgets:doc.widgets as any,layout:doc.layout as any};
  if(old)await tx.dashboardPreference.update({where:{id:old.id},data});else await tx.dashboardPreference.create({data:{...key,...data}});
  return NextResponse.json({...doc,version:data.version,isDefault:v.reset});
 },{isolationLevel:'Serializable'});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))throw new AppError('Düzen eşzamanlı değiştirildi. Taslağınız korunuyor.',409);throw e;}
}
