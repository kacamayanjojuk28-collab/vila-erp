import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { AppError, type Actor } from "./security";
import { day, dateValue, today } from "./finance-domain";
import { decimal } from "./domain";

export function reportBounds(url:URL) {
  const from=day.parse(url.searchParams.get("from")||"0001-01-01"),asOf=day.parse(url.searchParams.get("asOf")||today());
  const knownAt=z.iso.datetime({offset:true}).parse(url.searchParams.get("knownAt")||new Date().toISOString());
  const page=z.coerce.number().int().min(1).max(1000000).parse(url.searchParams.get("page")||1),take=z.coerce.number().int().min(1).max(100).parse(url.searchParams.get("take")||25);
  if(from>asOf)throw new AppError("Başlangıç tarihi bitişten sonra olamaz.");
  return {from:dateValue(from),asOf:dateValue(asOf),knownAt:new Date(knownAt),page,take,skip:(page-1)*take};
}
export type Bounds=ReturnType<typeof reportBounds>;
const control=Prisma.sql`coalesce(a.purpose,vila_account_purpose(a."orgId",a.id)) IN ('AR','AP','CUSTOMER_ADVANCE','SUPPLIER_ADVANCE')`;
const snapshot=(orgId:string,b:Bounds)=>Prisma.sql`
WITH invoices AS (
 SELECT i.*,coalesce(p.paid,0) AS paid,coalesce(c.credits,0) AS credits,
 i.total-coalesce(p.paid,0)-coalesce(c.credits,0) AS open,
 (${b.asOf}::date-i."dueOn") AS age
 FROM "FinancialInvoice" i JOIN "JournalEntry" j ON j."orgId"=i."orgId" AND j.id=i."journalId"
 LEFT JOIN LATERAL (SELECT sum(amount) paid FROM "PaymentAllocation" x WHERE x."orgId"=i."orgId" AND x."invoiceId"=i.id AND x."effectiveOn"<=${b.asOf} AND x."createdAt"<=${b.knownAt}) p ON true
 LEFT JOIN LATERAL (SELECT sum(x.total) credits FROM "FinancialInvoice" x JOIN "JournalEntry" cj ON cj.id=x."journalId" AND cj."orgId"=x."orgId" WHERE x."orgId"=i."orgId" AND x."originalId"=i.id AND x.status='POSTED' AND x."issuedOn"<=${b.asOf} AND cj."createdAt"<=${b.knownAt}) c ON true
 WHERE i."orgId"=${orgId} AND i.status='POSTED' AND i.kind IN ('SALE','PURCHASE') AND i."issuedOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt}
)`;

export async function financeReport(a:Actor,resource:string,url:URL,client:Prisma.TransactionClient) {
  const b=reportBounds(url),orgId=a.orgId,partyId=url.searchParams.get("partyId"),accountId=url.searchParams.get("accountId");
  const q=(url.searchParams.get("q")||"").trim().slice(0,160);
  const meta={from:b.from.toISOString().slice(0,10),asOf:b.asOf.toISOString().slice(0,10),knownAt:b.knownAt.toISOString(),page:b.page,take:b.take,currency:"TRY"};
  const paged=async(model:any,where:any,orderBy:any)=>{const [rows,total]=await Promise.all([model.findMany({where,orderBy,take:b.take,skip:b.skip}),model.count({where})]);return {...meta,rows,total,pages:Math.ceil(total/b.take)};};
  if(resource==="accounts"){
    const r=await paged(client.ledgerAccount,{orgId,...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{code:{contains:q,mode:"insensitive"}}]}:{})},{code:"asc"});
    const purposes=await client.$queryRaw<{id:string;purpose:string|null}[]>(Prisma.sql`SELECT id,vila_account_purpose("orgId",id) purpose FROM "LedgerAccount" WHERE "orgId"=${orgId} AND id IN (${Prisma.join(r.rows.length?r.rows.map((x:any)=>x.id):["missing"])})`);
    r.rows=r.rows.map((a:any)=>({...a,resolvedPurpose:purposes.find(p=>p.id===a.id)?.purpose}));return r;
  }
  if(resource==="periods")return paged(client.accountingPeriod,{orgId},{startsOn:"desc"});
  if(resource==="tax-rules")return paged(client.taxRule,{orgId,...(q?{code:{contains:q,mode:"insensitive"}}:{})},[{code:"asc"},{validFrom:"desc"}]);
  if(resource==="parties")return paged(client.record,{orgId,...(q?{name:{contains:q,mode:"insensitive"}}:{}),kind:{in:["customers","suppliers"]},archived:false},{name:"asc"});
  if(resource==="source-orders") {
    const where={orgId,archived:false,contactId:partyId??"missing",kind:url.searchParams.get("kind")==="PURCHASE"?"purchases":"sales",status:{in:["CONFIRMED","PARTIAL","FULFILLED"]},...(q?{name:{contains:q,mode:"insensitive" as const}}:{})};
    const [rows,total]=await Promise.all([client.document.findMany({where,include:{lines:true},orderBy:{createdAt:"desc"},take:b.take,skip:b.skip}),client.document.count({where})]);return {...meta,rows,total};
  }
  if(resource==="invoices"){
    const result=await paged(client.financialInvoice,{orgId,...(partyId?{partyId}:{}),issuedOn:{gte:b.from,lte:b.asOf},createdAt:{lte:b.knownAt}},[{issuedOn:"desc"},{id:"asc"}]);
    const ids=result.rows.map((r:any)=>r.id);
    const [journals,approvals]=await Promise.all([
      client.journalEntry.findMany({where:{orgId,sourceType:"INVOICE",sourceId:{in:ids},createdAt:{lte:b.knownAt}},select:{sourceId:true}}),
      client.audit.findMany({where:{orgId,action:"FINANCE INVOICE APPROVED",entityId:{in:ids},createdAt:{lte:b.knownAt}},select:{entityId:true}}),
    ]);
    const posted=new Set(journals.map(r=>r.sourceId)),approved=new Set(approvals.map(r=>r.entityId));
    result.rows=result.rows.map((r:any)=>({...r,status:posted.has(r.id)?"POSTED":approved.has(r.id)?"APPROVED":"DRAFT",journalId:posted.has(r.id)?r.journalId:null}));return result;
  }
  if(resource==="journals")return paged(client.journalEntry,{orgId,status:"POSTED",effectiveOn:{gte:b.from,lte:b.asOf},createdAt:{lte:b.knownAt}},[{effectiveOn:"desc"},{id:"asc"}]);
  if(resource==="allocations")return paged(client.paymentAllocation,{orgId,effectiveOn:{gte:b.from,lte:b.asOf},createdAt:{lte:b.knownAt}},[{effectiveOn:"desc"},{id:"asc"}]);
  if(resource==="payments")return paged(client.financePayment,{orgId,...(partyId?{partyId}:{}),effectiveOn:{gte:b.from,lte:b.asOf},createdAt:{lte:b.knownAt}},[{effectiveOn:"desc"},{id:"asc"}]);
  if(resource==="open"||resource==="aging") {
    const filter=Prisma.sql`open>0 ${q?Prisma.sql`AND number ILIKE ${"%"+q+"%"}`:Prisma.empty} ${partyId?Prisma.sql`AND "partyId"=${partyId}`:Prisma.empty}`;
    if(resource==="aging"){
      const rows=await client.$queryRaw<any[]>(Prisma.sql`${snapshot(orgId,b)} SELECT kind,CASE WHEN age<=0 THEN 'NOT_DUE' WHEN age<=30 THEN '1_30' WHEN age<=60 THEN '31_60' WHEN age<=90 THEN '61_90' ELSE '90_PLUS' END bucket,count(*)::int count,sum(open)::text amount FROM invoices WHERE ${filter} GROUP BY kind,bucket ORDER BY kind,bucket`);
      return {...meta,rows,total:rows.length};
    }
    const rows=await client.$queryRaw<any[]>(Prisma.sql`${snapshot(orgId,b)} SELECT id,number,kind,"partyId","partyName","issuedOn","dueOn",total::text,paid::text,credits::text,open::text,age,count(*) OVER()::int AS "rowCount" FROM invoices WHERE ${filter} ORDER BY "dueOn",id LIMIT ${b.take} OFFSET ${b.skip}`);
    const totals=await client.$queryRaw<any[]>(Prisma.sql`${snapshot(orgId,b)} SELECT kind,sum(open)::text amount,count(*)::int count FROM invoices WHERE ${filter} GROUP BY kind`);
    return {...meta,rows,total:totals.reduce((s:number,r:any)=>s+r.count,0),totals};
  }
  if(resource==="trial") {
    const where=Prisma.sql`j."orgId"=${orgId} AND j.status='POSTED' AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt}`;
    const rows=await client.$queryRaw<any[]>(Prisma.sql`
      WITH amounts AS MATERIALIZED (SELECT l."accountId",sum(CASE WHEN j."effectiveOn"<${b.from} THEN l.debit-l.credit ELSE 0 END) opening,
      sum(CASE WHEN j."effectiveOn">=${b.from} THEN l.debit ELSE 0 END) debit,sum(CASE WHEN j."effectiveOn">=${b.from} THEN l.credit ELSE 0 END) credit,sum(l.debit-l.credit) closing
      FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" WHERE ${where} GROUP BY l."accountId")
      SELECT a.id,a.code,a.name,a.category,coalesce(x.opening,0)::text opening,coalesce(x.debit,0)::text debit,coalesce(x.credit,0)::text credit,coalesce(x.closing,0)::text closing,count(*) OVER()::int "rowCount"
      FROM "LedgerAccount" a LEFT JOIN amounts x ON x."accountId"=a.id WHERE a."orgId"=${orgId} ORDER BY a.code LIMIT ${b.take} OFFSET ${b.skip}`);
    const total=await client.ledgerAccount.count({where:{orgId}});
    const totals=await client.$queryRaw<any[]>(Prisma.sql`SELECT coalesce(sum(l.debit),0)::text debit,coalesce(sum(l.credit),0)::text credit FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" WHERE ${where} AND j."effectiveOn">=${b.from}`);
    return {...meta,rows,total,totals:totals[0]};
  }
  if(resource==="statement"||resource==="ledger") {
    if(resource==="statement"&&!partyId)throw new AppError("Cari seçimi zorunlu.");
    const filter=Prisma.sql`j."orgId"=${orgId} AND j.status='POSTED' AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt} ${partyId?Prisma.sql`AND l."partyId"=${partyId} AND ${control}`:Prisma.empty} ${accountId?Prisma.sql`AND l."accountId"=${accountId}`:Prisma.empty}`;
    const rows=await client.$queryRaw<any[]>(Prisma.sql`
      WITH all_lines AS (SELECT j.id,j.number,j."sourceType",j."sourceId",j."effectiveOn",j."createdAt",j.description,sum(l.debit) debit,sum(l.credit) credit FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" JOIN "LedgerAccount" a ON a.id=l."accountId" AND a."orgId"=l."orgId" WHERE ${filter} GROUP BY j.id),
      running AS (SELECT *,sum(debit-credit) OVER(ORDER BY "effectiveOn","createdAt",id) balance FROM all_lines)
      SELECT id,number,"sourceType","sourceId","effectiveOn",description,debit::text,credit::text,balance::text,count(*) OVER()::int "rowCount" FROM running WHERE "effectiveOn">=${b.from} ORDER BY "effectiveOn","createdAt",id LIMIT ${b.take} OFFSET ${b.skip}`);
    const totals=await client.$queryRaw<any[]>(Prisma.sql`SELECT coalesce(sum(CASE WHEN j."effectiveOn"<${b.from} THEN l.debit-l.credit ELSE 0 END),0)::text opening,coalesce(sum(l.debit-l.credit),0)::text balance,count(DISTINCT CASE WHEN j."effectiveOn">=${b.from} THEN j.id END)::int count FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" JOIN "LedgerAccount" a ON a.id=l."accountId" AND a."orgId"=l."orgId" WHERE ${filter}`);
    return {...meta,rows,total:totals[0].count,opening:totals[0].opening,balance:totals[0].balance};
  }
  if(resource==="advances") {
    const rows=await client.$queryRaw<any[]>(Prisma.sql`
      SELECT p.id,p."partyId",p."partyName",p.direction,p."effectiveOn",p.amount::text,(p.amount-coalesce(x.used,0))::text available,count(*) OVER()::int "rowCount"
      FROM "FinancePayment" p LEFT JOIN LATERAL (SELECT sum(amount) used FROM "PaymentAllocation" WHERE "orgId"=p."orgId" AND "paymentId"=p.id AND "effectiveOn"<=${b.asOf} AND "createdAt"<=${b.knownAt}) x ON true
      WHERE p."orgId"=${orgId} AND p."reversalOf" IS NULL AND p."effectiveOn"<=${b.asOf} AND p."createdAt"<=${b.knownAt}
      AND NOT EXISTS(SELECT 1 FROM "FinancePayment" r WHERE r."orgId"=p."orgId" AND r."reversalOf"=p.id AND r."effectiveOn"<=${b.asOf} AND r."createdAt"<=${b.knownAt})
      ${partyId?Prisma.sql`AND p."partyId"=${partyId}`:Prisma.empty} ORDER BY p."effectiveOn",p.id LIMIT ${b.take} OFFSET ${b.skip}`);
    return {...meta,rows,total:rows[0]?.rowCount??0};
  }
  if(resource==="reconciliation") {
    const totals=await client.$queryRaw<any[]>(Prisma.sql`SELECT coalesce(sum(l.debit),0)::text debit,coalesce(sum(l.credit),0)::text credit FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" WHERE j."orgId"=${orgId} AND j.status='POSTED' AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt}`);
    const partyDifference=await client.$queryRaw<any[]>(Prisma.sql`
      WITH expected_events AS (
        SELECT i."partyId",CASE WHEN i.kind IN ('SALE','PURCHASE_CREDIT') THEN i.total ELSE -i.total END amount FROM "FinancialInvoice" i JOIN "JournalEntry" j ON j.id=i."journalId" AND j."orgId"=i."orgId" WHERE i."orgId"=${orgId} AND i.status='POSTED' AND i."issuedOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt}
        UNION ALL SELECT "partyId",CASE WHEN direction='IN' THEN -amount ELSE amount END FROM "FinancePayment" WHERE "orgId"=${orgId} AND "effectiveOn"<=${b.asOf} AND "createdAt"<=${b.knownAt}
        UNION ALL SELECT l."partyId",l.debit-l.credit FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" WHERE l."orgId"=${orgId} AND l."partyId" IS NOT NULL AND j."sourceType" IN ('OPENING','MANUAL','REVERSAL') AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt}
      ), expected AS (SELECT "partyId",sum(amount) amount FROM expected_events GROUP BY "partyId"), actual AS (
        SELECT l."partyId",sum(l.debit-l.credit) amount FROM "JournalLine" l JOIN "JournalEntry" j ON j.id=l."entryId" AND j."orgId"=l."orgId" JOIN "LedgerAccount" a ON a.id=l."accountId" AND a."orgId"=l."orgId" WHERE l."orgId"=${orgId} AND ${control} AND j.status='POSTED' AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt} GROUP BY l."partyId"
      ), differences AS (SELECT coalesce(e."partyId",x."partyId") "entityId",coalesce(e.amount,0) expected,coalesce(x.amount,0) actual,coalesce(e.amount,0)-coalesce(x.amount,0) difference FROM expected e FULL JOIN actual x USING("partyId") WHERE coalesce(e.amount,0)<>coalesce(x.amount,0))
      SELECT coalesce(sum(abs(difference)),0)::text difference,count(*)::int count,
      coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM (SELECT "entityId",expected::text,actual::text,difference::text,'Cari alt defter / kontrol hesabı farkı' cause FROM differences ORDER BY "entityId" LIMIT ${b.take} OFFSET ${b.skip}) d),'[]'::jsonb) issues FROM differences`);
    const invoiceDifference=await client.$queryRaw<any[]>(Prisma.sql`WITH differences AS (
      SELECT i.id "entityId",i.number,i.total expected,coalesce(x.amount,0) actual,i.total-coalesce(x.amount,0) difference FROM "FinancialInvoice" i JOIN "JournalEntry" j ON j.id=i."journalId" AND j."orgId"=i."orgId" LEFT JOIN LATERAL (SELECT abs(sum(l.debit-l.credit)) amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id=l."accountId" AND a."orgId"=l."orgId" WHERE l."orgId"=i."orgId" AND l."entryId"=j.id AND l."partyId"=i."partyId" AND coalesce(a.purpose,vila_account_purpose(a."orgId",a.id)) IN ('AR','AP')) x ON true WHERE i."orgId"=${orgId} AND i.status='POSTED' AND i."issuedOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt} AND i.total<>coalesce(x.amount,0))
      SELECT coalesce(sum(abs(difference)),0)::text difference,count(*)::int count,coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM (SELECT "entityId",number,expected::text,actual::text,difference::text,'Fatura / muhasebe fişi farkı' cause FROM differences ORDER BY "entityId" LIMIT ${b.take} OFFSET ${b.skip}) d),'[]'::jsonb) issues FROM differences`);
    const journalDifference=await client.$queryRaw<any[]>(Prisma.sql`WITH differences AS (
      SELECT j.id "entityId",j.number,coalesce(sum(l.debit),0) expected,coalesce(sum(l.credit),0) actual,coalesce(sum(l.debit-l.credit),0) difference FROM "JournalEntry" j LEFT JOIN "JournalLine" l ON l."entryId"=j.id AND l."orgId"=j."orgId" WHERE j."orgId"=${orgId} AND j.status='POSTED' AND j."effectiveOn"<=${b.asOf} AND j."createdAt"<=${b.knownAt} GROUP BY j.id HAVING coalesce(sum(l.debit-l.credit),0)<>0 OR count(l.id)<2)
      SELECT coalesce(sum(abs(difference)),0)::text difference,count(*)::int count,coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM (SELECT "entityId",number,expected::text,actual::text,difference::text,'Fiş satır sayısı / borç-alacak dengesizliği' cause FROM differences ORDER BY "entityId" LIMIT ${b.take} OFFSET ${b.skip}) d),'[]'::jsonb) issues FROM differences`);
    const legacy=await client.$queryRaw<any[]>`SELECT count(*)::int count FROM "Payment" p WHERE p."orgId"=${orgId} AND NOT EXISTS(SELECT 1 FROM "FinancePayment" f WHERE f.id=p.id AND f."orgId"=p."orgId")`;
    const legacyIssues=await client.$queryRaw<any[]>(Prisma.sql`SELECT p.id "entityId",p.name,p.amount::text amount,p.direction,p."createdAt",'Muhasebe kaynağı eşlenmemiş eski ödeme: manuel inceleme' cause FROM "Payment" p WHERE p."orgId"=${orgId} AND NOT EXISTS(SELECT 1 FROM "FinancePayment" f WHERE f.id=p.id AND f."orgId"=p."orgId") ORDER BY p."createdAt",p.id LIMIT ${b.take} OFFSET ${b.skip}`);
    const result={...totals[0],partyDifference:partyDifference[0].difference,invoiceDifference:invoiceDifference[0].difference,journalDifference:journalDifference[0].difference};
    const status=decimal(result.debit).eq(result.credit)&&decimal(result.partyDifference).eq(0)&&decimal(result.invoiceDifference).eq(0)&&journalDifference[0].count===0?"MATCH":"MISMATCH";
    return {...meta,...result,status,scope:"POSTED_FINANCE_CORE_ONLY",issues:[...partyDifference[0].issues,...invoiceDifference[0].issues,...journalDifference[0].issues],legacyIssues,total:Math.max(partyDifference[0].count,invoiceDifference[0].count,journalDifference[0].count,legacy[0].count),legacyUnpostedPayments:legacy[0].count,warning:legacy[0].count?"Eski operasyonel ödemeler muhasebeleştirilmiş sayılmadı; manuel inceleme gerekir.":null};
  }
  throw new AppError("Finans raporu bulunamadı.",404);
}
