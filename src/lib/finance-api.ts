import { setTimeout as delay } from "node:timers/promises";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, type Actor } from "./security";
import { idempotent } from "./idempotency";
import { transaction, audit } from "./service";
import { decimal } from "./domain";
import { day, dateValue, effectiveInput, positiveMoney } from "./finance-domain";
import { financePermission, lockFinance, inheritedPurpose, setFinanceClock, exampleChart, postJournal, reverseLines, type FinanceTx } from "./finance-ledger";
import { invoiceDraft, invoiceGet, invoiceOpen, approveInvoice, postInvoice, creditInvoice, takePayment, allocatePayment, reverseAllocation, reversePayment } from "./finance-engine";
import { financeReport } from "./finance-reports";
import { invoicePdf } from "./finance-pdf";

export async function handleFinanceCore(req:Request,path:string[],body:any,a:Actor,url:URL):Promise<Response> {
  financePermission(a);
  const [resource,id,action]=path;
  const readFinance=<T,>(fn:(tx:FinanceTx)=>Promise<T>)=>transaction(async tx=>{await setFinanceClock(tx);return fn(tx);});
  if(req.method==="GET") {
    if(path.length===1&&resource==="export"){
      financePermission(a,"export");
      const report=z.enum(["invoices","statement","open","aging","payments","advances","allocations","journals","ledger","trial","reconciliation","accounts","periods","tax-rules"]).parse(url.searchParams.get("report"));
      const result:any=await readFinance(tx=>financeReport(a,report,url,tx));
      const rows=result.rows??[result],keys=rows.length?Object.keys(rows[0]).filter(k=>!k.endsWith("Count")):[];
      const cell=(v:any)=>{let text=v==null?"":typeof v==="object"?JSON.stringify(v):String(v);if(/^[=+@-]/.test(text)&&!/^-[0-9.]+$/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
      const csv="\ufeff"+[keys.map(cell).join(","),...rows.map((row:any)=>keys.map(k=>cell(row[k])).join(","))].join("\r\n");
      return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="vila-${report}-page-${result.page}.csv"`,"Cache-Control":"private, no-store"}});
    }

    if(path.length===3&&resource==="invoices"&&action==="pdf") {
      financePermission(a,"export");const invoice=await readFinance(tx=>invoiceGet(tx,a,id));
      return new Response(new Uint8Array(await invoicePdf(invoice,a.org.name)),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${invoice.number}.pdf"`,"Cache-Control":"private, no-store"}});
    }
    if(path.length===2&&resource==="invoices")return NextResponse.json(await readFinance(tx=>invoiceOpen(tx,a,id)));
    if(path.length===2&&resource==="journals")return NextResponse.json(await readFinance(async tx=>{const j=await tx.journalEntry.findFirst({where:{orgId:a.orgId,id}});if(!j)throw new AppError("Fiş bulunamadı.",404);return {...j,lines:await tx.journalLine.findMany({where:{orgId:a.orgId,entryId:id}})};}));
    if(path.length!==1)throw new AppError("Finans adresi bulunamadı.",404);
    return NextResponse.json(await readFinance(tx=>financeReport(a,resource,url,tx)));
  }
  if(req.method!=="POST")throw new AppError("HTTP yöntemi desteklenmiyor.",405);
  const fn=async(tx:FinanceTx)=>{
    await lockFinance(tx,a);
    if(resource==="bootstrap"&&path.length===1){
      financePermission(a,"configure");const v=z.object({acknowledgeInternalPolicy:z.literal(true),startsOn:day,endsOn:day,name:z.string().trim().min(1).max(160)}).parse(body);
      if(v.startsOn>v.endsOn)throw new AppError("Dönem aralığı geçersiz.");
      if(await tx.ledgerAccount.count({where:{orgId:a.orgId}}))throw new AppError("Hesap planı zaten mevcut; otomatik değiştirilmedi.",409);
      for(const [code,name,category,purpose] of exampleChart)await tx.ledgerAccount.create({data:{orgId:a.orgId,code,name,category,purpose}});
      const period=await tx.accountingPeriod.create({data:{orgId:a.orgId,name:v.name,startsOn:dateValue(v.startsOn),endsOn:dateValue(v.endsOn)}});
      await audit(tx,a,"FINANCE INTERNAL CHART INITIALIZED",period.id,{policy:"INTERNAL_EXAMPLE_REQUIRES_ACCOUNTANT_REVIEW"});return {period,policy:"INTERNAL_EXAMPLE_REQUIRES_ACCOUNTANT_REVIEW"};
    }
    if(resource==="accounts"&&path.length===1){
      financePermission(a,"configure");const v=z.object({code:z.string().regex(/^\d{3}(?:[.\-]\d{1,12})*$/),name:z.string().trim().min(1).max(160),category:z.enum(["ASSET","LIABILITY","EQUITY","INCOME","EXPENSE"]),purpose:z.enum(["CASH","BANK","AR","AP","CUSTOMER_ADVANCE","SUPPLIER_ADVANCE","INVENTORY","EXPENSE","INPUT_TAX","OUTPUT_TAX","REVENUE","OPENING"]).optional(),parentId:z.string().optional(),partyId:z.string().optional()}).parse(body);
      if(v.parentId){const parent=await tx.ledgerAccount.findFirst({where:{orgId:a.orgId,id:v.parentId,category:v.category}});if(!parent)throw new AppError("Üst hesap bulunamadı/uyumsuz.",404);}
      if(v.partyId){
        if(!v.parentId||v.purpose)throw new AppError("Cari alt hesap, kontrol hesabı altında ve ayrı rol eşlemesi olmadan oluşturulmalı.");
        const purpose=await inheritedPurpose(tx,a,v.parentId);
        if(!["AR","AP","CUSTOMER_ADVANCE","SUPPLIER_ADVANCE"].includes(purpose??""))throw new AppError("Cari alt hesabı için kontrol hesabı seçin.");
        const p=await tx.record.findFirst({where:{orgId:a.orgId,id:v.partyId,archived:false,kind:["AR","CUSTOMER_ADVANCE"].includes(purpose??"")?"customers":"suppliers"}});if(!p)throw new AppError("Alt hesap carisi uyumsuz.",404);
      }
      const r=await tx.ledgerAccount.create({data:{orgId:a.orgId,...v}});await audit(tx,a,"FINANCE ACCOUNT CREATED",r.id);return r;
    }
    if(resource==="periods"&&path.length===1){
      financePermission(a,"configure");const v=z.object({name:z.string().trim().min(1).max(160),startsOn:day,endsOn:day}).parse(body);
      if(v.startsOn>v.endsOn||await tx.accountingPeriod.findFirst({where:{orgId:a.orgId,startsOn:{lte:dateValue(v.endsOn)},endsOn:{gte:dateValue(v.startsOn)}}}))throw new AppError("Dönem tarihleri çakışıyor/geçersiz.",409);
      const p=await tx.accountingPeriod.create({data:{orgId:a.orgId,name:v.name,startsOn:dateValue(v.startsOn),endsOn:dateValue(v.endsOn)}});await audit(tx,a,"FINANCE PERIOD CREATED",p.id);return p;
    }
    if(resource==="periods"&&path.length===3&&action==="close"){
      financePermission(a,"close");const p=await tx.accountingPeriod.findFirst({where:{orgId:a.orgId,id,status:"OPEN"}});if(!p)throw new AppError("Açık dönem bulunamadı.",404);
      await audit(tx,a,"FINANCE PERIOD CLOSED",id);return tx.accountingPeriod.update({where:{id},data:{status:"CLOSED",closedBy:a.userId,closedAt:new Date()}});
    }
    if(resource==="tax-rules"&&path.length===1){
      financePermission(a,"configure");const v=z.object({code:z.string().trim().min(1).max(40),classification:z.enum(["STANDARD","ZERO","EXEMPT"]),rate:z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).refine(v=>decimal(v).lte(100)),validFrom:day,validTo:day}).parse(body);
      if(v.validFrom>v.validTo||(v.classification!=="STANDARD"&&!decimal(v.rate).eq(0)))throw new AppError("Vergi kuralı geçersiz.");
      if(await tx.taxRule.findFirst({where:{orgId:a.orgId,code:v.code,validFrom:{lte:dateValue(v.validTo)},validTo:{gte:dateValue(v.validFrom)}}}))throw new AppError("Vergi kuralı geçerlilik tarihleri çakışıyor.",409);
      const r=await tx.taxRule.create({data:{...v,orgId:a.orgId,rate:decimal(v.rate),validFrom:dateValue(v.validFrom),validTo:dateValue(v.validTo)}});await audit(tx,a,"FINANCE TAX RULE CREATED",r.id);return r;
    }
    if(resource==="invoices") {
      if(path.length===1)return invoiceDraft(tx,a,body);
      if(path.length===3&&action==="approve")return approveInvoice(tx,a,id);
      if(path.length===3&&action==="post")return postInvoice(tx,a,id,body);
      if(path.length===3&&action==="credit")return creditInvoice(tx,a,id,body);
    }
    if(resource==="payments"){
      if(path.length===1)return takePayment(tx,a,body);
      if(path.length===3&&action==="reverse")return reversePayment(tx,a,id,body);
    }
    if(resource==="allocations"){
      if(path.length===1)return allocatePayment(tx,a,body);
      if(path.length===3&&action==="reverse")return reverseAllocation(tx,a,id,body);
    }
    if(resource==="journals"){
      if(path.length===1){
        const v=effectiveInput.extend({description:z.string().trim().min(3).max(500),opening:z.boolean().default(false),lines:z.array(z.object({accountId:z.string(),partyId:z.string().optional(),debit:z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),credit:z.string().regex(/^\d{1,12}(\.\d{1,2})?$/)})).min(2).max(100)}).parse(body);
        if(v.opening)financePermission(a,"configure");
        const sourceId=req.headers.get("Idempotency-Key")!;
        return postJournal(tx,a,{...v,sourceType:v.opening?"OPENING":"MANUAL",sourceId});
      }
      if(path.length===3&&action==="reverse"){
        const v=effectiveInput.parse(body),r=await reverseLines(tx,a,id);
        if(!v.reason||!["MANUAL","OPENING"].includes(r.original.sourceType)||dateValue(v.effectiveOn)<r.original.effectiveOn)throw new AppError("Bu kaynak kendi finansal işleminden ters çevrilmelidir.",409);
        return postJournal(tx,a,{...v,sourceType:"REVERSAL",sourceId:id,reversalOf:id,description:v.reason,lines:r.lines});
      }
    }
    if(resource==="reconciliation"&&path.length===1){const r:any=await financeReport(a,"reconciliation",url,tx);return tx.reconciliationRecord.create({data:{orgId:a.orgId,asOf:dateValue(r.asOf),knownAt:new Date(r.knownAt),status:r.status,debit:r.debit,credit:r.credit,partyDifference:r.partyDifference,invoiceDifference:r.invoiceDifference,createdBy:a.userId}});}
    throw new AppError("Finans işlemi bulunamadı.",404);
  };
  try {
    for(let attempt=0;attempt<6;attempt++) {
      try { return NextResponse.json(await idempotent(a,"finance-core:"+path.join("/"),req.headers.get("Idempotency-Key"),body,fn)); }
      catch(error) {
        const code=(error as any)?.cause?.code??(error as any)?.meta?.driverAdapterError?.cause?.code;
        const serialization=(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2034")||["40001","40P01"].includes(code);
        if(!serialization)throw error;
        if(attempt===5)throw new AppError("Finans işlemi yoğunluk nedeniyle tamamlanamadı; aynı işlem anahtarıyla tekrar deneyin.",503);
        await delay(Math.min(200,10*2**attempt)+Math.floor(Math.random()*20));
      }
    }
    throw new AppError("Finans işlemi tamamlanamadı.",503);
  } catch(error) {
    if((error instanceof Prisma.PrismaClientKnownRequestError && ["P2003","P2004"].includes(error.code)) || ["23503","23514","23505"].includes((error as any)?.cause?.code??(error as any)?.meta?.driverAdapterError?.cause?.code)) throw new AppError("Finansal bütünlük/ilişki kuralı işlemi reddetti.",409);
    throw error;
  }
}
