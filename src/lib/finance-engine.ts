import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { decimal } from "./domain";
import { AppError, type Actor } from "./security";
import { audit } from "./service";
import { account, inheritedPurpose, party, postJournal, reverseLines, nextNumber, type FinanceTx, type PostingLine } from "./finance-ledger";
import { dateValue, invoiceAmounts, invoiceInput, effectiveInput, positiveMoney } from "./finance-domain";

type PreparedLine=Omit<Prisma.InvoiceLineCreateManyInput,"invoiceId"|"net"|"tax"|"discount"|"total"> & ReturnType<typeof invoiceAmounts>;

export async function invoiceDraft(tx:FinanceTx,a:Actor,body:unknown) {
  const v=invoiceInput.parse(body),p=await party(tx,a,v.partyId,v.kind==="SALE"?"customers":"suppliers");
  if(v.dueOn<v.issuedOn)throw new AppError("Vade belge tarihinden önce olamaz.");
  const order=v.orderId?await tx.document.findFirst({where:{orgId:a.orgId,id:v.orderId,contactId:p.id,kind:v.kind==="SALE"?"sales":"purchases",archived:false,status:{in:["CONFIRMED","PARTIAL","FULFILLED"]}}}):null;
  if(v.orderId&&!order)throw new AppError("Geçerli kaynak sipariş bulunamadı.",404);
  if(v.movementId){const m=await tx.movement.findFirst({where:{orgId:a.orgId,id:v.movementId,reference:order?.id??"missing"}});if(!m)throw new AppError("Kaynak sevkiyat/mal kabulü uyumsuz.",409);}
  const lines:PreparedLine[]=[];const seen=new Set<string>();
  for(const l of v.lines){
    const rule=await tx.taxRule.findFirst({where:{orgId:a.orgId,id:l.taxRuleId,validFrom:{lte:dateValue(v.issuedOn)},validTo:{gte:dateValue(v.issuedOn)}}});
    if(!rule)throw new AppError("Belge tarihi için geçerli vergi kuralı yok.",409);
    const product=l.productId?await tx.record.findFirst({where:{orgId:a.orgId,id:l.productId,kind:"products",archived:false}}):null;
    if(l.productId&&!product)throw new AppError("Ürün bulunamadı.",404);
    if(order){
      if(!l.sourceLineId||seen.has(l.sourceLineId))throw new AppError("Kaynak sipariş satırları benzersiz olmalı.");
      const source=await tx.documentLine.findFirst({where:{orgId:a.orgId,id:l.sourceLineId,documentId:order.id}});
      if(!source||source.productId!==l.productId||decimal(l.quantity).gt(source.quantity))throw new AppError("Kaynak satır/miktar uyumsuz.",409);
      seen.add(l.sourceLineId);
    }else if(l.sourceLineId)throw new AppError("Siparişsiz fatura kaynak satırı taşıyamaz.");
    const purpose=v.kind==="SALE"?"REVENUE":product&&!['HIZMET','SAAT'].includes((product.data as any).unit)?"INVENTORY":"EXPENSE";
    const acct=l.accountId?await tx.ledgerAccount.findFirst({where:{id:l.accountId,orgId:a.orgId,active:true}}):await account(tx,a,purpose);
    if(!acct||!(v.kind==="SALE"?acct.category==="INCOME":(acct.category==="EXPENSE"||(acct.purpose??await inheritedPurpose(tx,a,acct.id))==="INVENTORY")))throw new AppError("Fatura satırı hesap eşlemesi geçersiz.");
    lines.push({orgId:a.orgId,name:l.name,productId:l.productId??null,sourceLineId:l.sourceLineId??null,quantity:decimal(l.quantity),unitPrice:decimal(l.unitPrice),discountRate:decimal(l.discountRate),taxRuleId:rule.id,taxRate:rule.rate,taxClassification:rule.classification,accountId:acct.id,...invoiceAmounts(l.quantity,l.unitPrice,l.discountRate,rule.rate.toString())});
  }
  const sum=(field:"net"|"discount"|"tax"|"total")=>lines.reduce((s,l)=>s.add(l[field]),decimal(0));
  if(sum("total").lte(0))throw new AppError("Fatura toplamı pozitif olmalı.");
  const i=await tx.financialInvoice.create({data:{orgId:a.orgId,number:await nextNumber(tx,a,v.kind==="SALE"?"SI":"PI"),kind:v.kind,partyId:p.id,partyName:p.name,issuedOn:dateValue(v.issuedOn),dueOn:dateValue(v.dueOn),orderId:order?.id,movementId:v.movementId,currency:"TRY",net:sum("net"),discount:sum("discount"),tax:sum("tax"),total:sum("total"),createdBy:a.userId}});
  await tx.invoiceLine.createMany({data:lines.map(l=>({...l,invoiceId:i.id}))});await audit(tx,a,"FINANCE INVOICE DRAFT",i.id);return i;
}
export async function invoiceGet(tx:FinanceTx,a:Actor,id:string) {
  const i=await tx.financialInvoice.findFirst({where:{orgId:a.orgId,id}});if(!i)throw new AppError("Fatura bulunamadı.",404);
  const lines=await tx.invoiceLine.findMany({where:{orgId:a.orgId,invoiceId:id},orderBy:{id:"asc"}});return {...i,lines};
}
export async function invoiceOpen(tx:FinanceTx,a:Actor,id:string) {
  const i=await invoiceGet(tx,a,id);
  const paid=(await tx.paymentAllocation.aggregate({where:{orgId:a.orgId,invoiceId:id},_sum:{amount:true}}))._sum.amount??decimal(0);
  const credits=(await tx.financialInvoice.aggregate({where:{orgId:a.orgId,originalId:id,status:"POSTED"},_sum:{total:true}}))._sum.total??decimal(0);
  return {...i,paid,credits,open:i.total.sub(paid).sub(credits)};
}
export async function approveInvoice(tx:FinanceTx,a:Actor,id:string) {
  const i=await invoiceGet(tx,a,id);if(i.status!=="DRAFT")throw new AppError("Yalnız taslak fatura onaylanır.",409);
  await audit(tx,a,"FINANCE INVOICE APPROVED",id);return tx.financialInvoice.update({where:{id},data:{status:"APPROVED"}});
}
export async function postInvoice(tx:FinanceTx,a:Actor,id:string,body:unknown) {
  const v=effectiveInput.parse(body),i=await invoiceGet(tx,a,id),sale=["SALE","SALES_CREDIT"].includes(i.kind),credit=i.kind.endsWith("CREDIT");
  if(i.status!=="APPROVED")throw new AppError("Yalnız onaylı fatura kesinleştirilir.",409);
  if(v.effectiveOn!==i.issuedOn.toISOString().slice(0,10))throw new AppError("Muhasebe tarihi fatura tarihi olmalı.");
  if(i.originalId){const original=await invoiceOpen(tx,a,i.originalId);if(original.status!=="POSTED"||i.total.gt(original.open))throw new AppError("Alacaklandırma açık tutarı aşamaz.",409);}
  for(const l of i.lines){if(!l.sourceLineId)continue;
    const source=await tx.documentLine.findFirst({where:{orgId:a.orgId,id:l.sourceLineId}});
    const used=await tx.$queryRaw<{quantity:any}[]>`SELECT coalesce(sum(CASE WHEN f.kind IN ('SALES_CREDIT','PURCHASE_CREDIT') THEN -l.quantity ELSE l.quantity END),0) AS quantity FROM "InvoiceLine" l JOIN "FinancialInvoice" f ON f.id=l."invoiceId" AND f."orgId"=l."orgId" WHERE l."orgId"=${a.orgId} AND l."sourceLineId"=${l.sourceLineId} AND f.status='POSTED'`;
    if(!source||(!credit&&decimal(used[0].quantity).add(l.quantity).gt(source.quantity)))throw new AppError("Faturalanabilir sipariş miktarı aşılıyor.",409);
  }
  const control=await account(tx,a,sale?"AR":"AP"),tax=await account(tx,a,sale?"OUTPUT_TAX":"INPUT_TAX");
  let lines:PostingLine[]=[{accountId:control.id,partyId:i.partyId,debit:sale?i.total:"0",credit:sale?"0":i.total}];
  for(const l of i.lines)if(l.net.gt(0))lines.push({accountId:l.accountId,debit:sale?"0":l.net,credit:sale?l.net:"0"});
  if(i.tax.gt(0))lines.push({accountId:tax.id,debit:sale?"0":i.tax,credit:sale?i.tax:"0"});
  if(credit)lines=lines.map(l=>({...l,debit:l.credit,credit:l.debit}));
  const j=await postJournal(tx,a,{...v,sourceType:"INVOICE",sourceId:id,description:i.number,lines});
  await audit(tx,a,"FINANCE INVOICE POSTED",id);return tx.financialInvoice.update({where:{id},data:{status:"POSTED",journalId:j.id}});
}
export async function creditInvoice(tx:FinanceTx,a:Actor,id:string,body:unknown) {
  const v=effectiveInput.extend({lines:z.array(z.object({lineId:z.string(),quantity:z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v=>decimal(v).gt(0))})).min(1).max(100)}).parse(body);
  const original=await invoiceOpen(tx,a,id);if(original.status!=="POSTED"||!["SALE","PURCHASE"].includes(original.kind))throw new AppError("Kaynak fatura alacaklandırılamaz.",409);
  if(dateValue(v.effectiveOn)<original.issuedOn||!v.reason)throw new AppError("Düzeltme tarihi/gerekçesi geçersiz.");
  const seen=new Set(),lines:PreparedLine[]=[];
  for(const l of v.lines){const source=original.lines.find(x=>x.id===l.lineId);if(!source||seen.has(l.lineId))throw new AppError("Düzeltme satırı geçersiz.");seen.add(l.lineId);
    const used=await tx.$queryRaw<{n:any}[]>`SELECT coalesce(sum(l.quantity),0) n FROM "InvoiceLine" l JOIN "FinancialInvoice" f ON f.id=l."invoiceId" AND f."orgId"=l."orgId" WHERE l."orgId"=${a.orgId} AND l."originalLineId"=${l.lineId} AND f.status='POSTED'`;
    if(decimal(used[0].n).add(l.quantity).gt(source.quantity))throw new AppError("İade miktarı kaynak miktarı aşıyor.",409);
    const {invoiceId:_,id:__,...copy}=source;
    lines.push({...copy,quantity:decimal(l.quantity),originalLineId:source.id,...invoiceAmounts(l.quantity,source.unitPrice.toString(),source.discountRate.toString(),source.taxRate.toString())});
  }
  const sum=(key:"net"|"tax"|"discount"|"total")=>lines.reduce((s,l)=>s.add(l[key]),decimal(0));
  if(sum("total").gt(original.open))throw new AppError("Önce ilgili ödeme tahsislerini ters çevirin; alacaklandırma açık bakiyeyi aşamaz.",409);
  const i=await tx.financialInvoice.create({data:{orgId:a.orgId,number:await nextNumber(tx,a,"CN"),kind:original.kind==="SALE"?"SALES_CREDIT":"PURCHASE_CREDIT",partyId:original.partyId,partyName:original.partyName,issuedOn:dateValue(v.effectiveOn),dueOn:dateValue(v.effectiveOn),orderId:original.orderId,originalId:id,net:sum("net"),tax:sum("tax"),discount:sum("discount"),total:sum("total"),createdBy:a.userId}});
  await tx.invoiceLine.createMany({data:lines.map(l=>({...l,invoiceId:i.id}))});await approveInvoice(tx,a,i.id);return postInvoice(tx,a,i.id,v);
}

export async function takePayment(tx:FinanceTx,a:Actor,body:unknown) {
  const v=effectiveInput.extend({partyId:z.string(),accountId:z.string(),direction:z.enum(["IN","OUT"]),amount:positiveMoney,name:z.string().trim().min(1).max(160),allocations:z.array(z.object({invoiceId:z.string(),amount:positiveMoney})).max(100).default([])}).parse(body);
  const p=await party(tx,a,v.partyId,v.direction==="IN"?"customers":"suppliers"),cash=await tx.ledgerAccount.findFirst({where:{orgId:a.orgId,id:v.accountId,active:true}});if(!cash||!["BANK","CASH"].includes(cash.purpose??await inheritedPurpose(tx,a,cash.id)??""))throw new AppError("Kasa/banka hesabı bulunamadı.",404);
  const advance=await account(tx,a,v.direction==="IN"?"CUSTOMER_ADVANCE":"SUPPLIER_ADVANCE");
  const payment=await tx.payment.create({data:{orgId:a.orgId,name:v.name,direction:v.direction,amount:decimal(v.amount)}});
  const j=await postJournal(tx,a,{...v,sourceType:"PAYMENT",sourceId:payment.id,description:v.name,lines:[{accountId:cash.id,debit:v.direction==="IN"?v.amount:"0",credit:v.direction==="OUT"?v.amount:"0"},{accountId:advance.id,partyId:p.id,debit:v.direction==="OUT"?v.amount:"0",credit:v.direction==="IN"?v.amount:"0"}]});
  const result=await tx.financePayment.create({data:{id:payment.id,orgId:a.orgId,partyId:p.id,partyName:p.name,accountId:cash.id,journalId:j.id,direction:v.direction,amount:decimal(v.amount),effectiveOn:dateValue(v.effectiveOn),createdBy:a.userId}});
  for(const allocation of v.allocations)await allocatePayment(tx,a,{...v,...allocation,paymentId:payment.id});
  await audit(tx,a,"FINANCE PAYMENT",payment.id);return result;
}
export async function allocatePayment(tx:FinanceTx,a:Actor,body:unknown) {
  const v=effectiveInput.extend({paymentId:z.string(),invoiceId:z.string(),amount:positiveMoney}).parse(body);
  const p=await tx.financePayment.findFirst({where:{orgId:a.orgId,id:v.paymentId,reversalOf:null}}),i=await invoiceOpen(tx,a,v.invoiceId);
  if(!p||p.partyId!==i.partyId||i.status!=="POSTED"||i.kind!==(p.direction==="IN"?"SALE":"PURCHASE")||await tx.financePayment.findFirst({where:{orgId:a.orgId,reversalOf:p.id}}))throw new AppError("Tahsis kaynakları uyumsuz.",409);
  const used=(await tx.paymentAllocation.aggregate({where:{orgId:a.orgId,paymentId:p.id},_sum:{amount:true}}))._sum.amount??decimal(0);
  if(decimal(v.amount).gt(p.amount.sub(used))||decimal(v.amount).gt(i.open)||dateValue(v.effectiveOn)<p.effectiveOn||dateValue(v.effectiveOn)<i.issuedOn)throw new AppError("Kullanılabilir ödeme/açık fatura tutarı veya tahsis tarihi geçersiz.",409);
  const id=randomUUID(),adv=await account(tx,a,p.direction==="IN"?"CUSTOMER_ADVANCE":"SUPPLIER_ADVANCE"),control=await account(tx,a,p.direction==="IN"?"AR":"AP");
  const j=await postJournal(tx,a,{...v,sourceType:"ALLOCATION",sourceId:id,description:"Mahsup: "+i.number,lines:[{accountId:p.direction==="IN"?adv.id:control.id,partyId:p.partyId,debit:v.amount,credit:"0"},{accountId:p.direction==="IN"?control.id:adv.id,partyId:p.partyId,debit:"0",credit:v.amount}]});
  const result=await tx.paymentAllocation.create({data:{id,orgId:a.orgId,paymentId:p.id,invoiceId:i.id,journalId:j.id,amount:decimal(v.amount),effectiveOn:dateValue(v.effectiveOn),createdBy:a.userId}});await audit(tx,a,"FINANCE ALLOCATION",id);return result;
}
export async function reverseAllocation(tx:FinanceTx,a:Actor,id:string,body:unknown) {
  const v=effectiveInput.parse(body),old=await tx.paymentAllocation.findFirst({where:{orgId:a.orgId,id,reversalOf:null}});
  if(!old||!v.reason||dateValue(v.effectiveOn)<old.effectiveOn||await tx.paymentAllocation.findFirst({where:{orgId:a.orgId,reversalOf:id}}))throw new AppError("Tahsis ters çevrilemez.",409);
  const reverse=await reverseLines(tx,a,old.journalId),rid=randomUUID();
  const j=await postJournal(tx,a,{...v,sourceType:"ALLOCATION",sourceId:rid,description:v.reason,reversalOf:old.journalId,lines:reverse.lines});
  return tx.paymentAllocation.create({data:{id:rid,orgId:a.orgId,paymentId:old.paymentId,invoiceId:old.invoiceId,journalId:j.id,amount:old.amount.negated(),effectiveOn:dateValue(v.effectiveOn),reversalOf:id,createdBy:a.userId}});
}
export async function reversePayment(tx:FinanceTx,a:Actor,id:string,body:unknown) {
  const v=effectiveInput.parse(body),p=await tx.financePayment.findFirst({where:{orgId:a.orgId,id,reversalOf:null}});
  if(!p||!v.reason||dateValue(v.effectiveOn)<p.effectiveOn)throw new AppError("Ödeme ters çevrilemez.",409);
  const used=(await tx.paymentAllocation.aggregate({where:{orgId:a.orgId,paymentId:id},_sum:{amount:true}}))._sum.amount??decimal(0);if(!used.eq(0))throw new AppError("Önce ödeme tahsislerini ters çevirin.",409);
  const reverse=await reverseLines(tx,a,p.journalId),direction=p.direction==="IN"?"OUT":"IN";
  const payment=await tx.payment.create({data:{orgId:a.orgId,name:"Ters kayıt: "+v.reason,direction,amount:p.amount,reversalOf:id}});
  const j=await postJournal(tx,a,{...v,sourceType:"PAYMENT",sourceId:payment.id,description:v.reason,reversalOf:p.journalId,lines:reverse.lines});
  await audit(tx,a,"FINANCE PAYMENT REVERSED",id,{reversalId:payment.id});return tx.financePayment.create({data:{id:payment.id,orgId:a.orgId,partyId:p.partyId,partyName:p.partyName,accountId:p.accountId,journalId:j.id,direction,amount:p.amount,effectiveOn:dateValue(v.effectiveOn),reversalOf:id,createdBy:a.userId}});
}
