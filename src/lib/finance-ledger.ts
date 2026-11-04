import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { decimal } from "./domain";
import { AppError, type Actor } from "./security";
import { audit } from "./service";
import { dateValue, today } from "./finance-domain";
export type FinanceTx=Prisma.TransactionClient;
export type PostingLine={accountId:string;partyId?:string|null;debit:string|Prisma.Decimal;credit:string|Prisma.Decimal;description?:string};
export const controlPurposes=["AR","AP","CUSTOMER_ADVANCE","SUPPLIER_ADVANCE"];
export function financePermission(a:Actor,scope="read") {
  const admin=["OWNER","ADMIN"].includes(a.role);
  if (!(admin || (a.role==="FINANCE" && !["configure","close"].includes(scope)))) throw new AppError("Finans işlemi için yetkiniz yok.",403);
}
export async function setFinanceClock(tx:FinanceTx) {
  // Prisma/pg date bindings and timestamptz decoding must share UTC. Transaction
  // local only: legacy auth/ERP connections retain their existing clock semantics.
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
}
export async function lockFinance(tx:FinanceTx,a:Actor) {
  await setFinanceClock(tx);
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${a.orgId} FOR UPDATE`;
  if(a.org.currency!=="TRY")throw new AppError("Finance Core v1 yalnız TRY destekler; döviz muhasebesi etkin değil.",409);
}
export async function account(tx:FinanceTx,a:Actor,purpose:string) {
  const row=await tx.ledgerAccount.findUnique({where:{orgId_purpose:{orgId:a.orgId,purpose}}});
  if(!row?.active)throw new AppError("Hesap eşlemesi eksik/kapalı: "+purpose,409);
  return row;
}
export async function inheritedPurpose(tx:FinanceTx,a:Actor,id:string) {
  const rows=await tx.$queryRaw<{purpose:string|null}[]>`SELECT vila_account_purpose(${a.orgId},${id}) AS purpose`;
  return rows[0]?.purpose??null;
}
export async function party(tx:FinanceTx,a:Actor,id:string,kind?:string) {
  const row=await tx.record.findFirst({where:{orgId:a.orgId,id,archived:false,kind:kind??{in:["customers","suppliers"]}}});
  if(!row)throw new AppError("Cari kayıt bulunamadı.",404);
  return row;
}
export async function nextNumber(tx:FinanceTx,a:Actor,kind:string) {
  const row=await tx.financeCounter.upsert({where:{orgId_kind:{orgId:a.orgId,kind}},create:{orgId:a.orgId,kind,value:1},update:{value:{increment:1}}});
  return kind+"-"+String(row.value).padStart(8,"0");
}
export async function postJournal(tx:FinanceTx,a:Actor,input:{effectiveOn:string;backdateReason?:string;sourceType:string;sourceId:string;description:string;reversalOf?:string;lines:PostingLine[]}) {
  if(input.effectiveOn>today())throw new AppError("İleri tarihli muhasebe kaydı yapılamaz.",409);
  if(input.effectiveOn<today() && !input.backdateReason)throw new AppError("Geri tarihli işlem gerekçesi zorunludur.");
  const date=dateValue(input.effectiveOn);
  const period=await tx.accountingPeriod.findFirst({where:{orgId:a.orgId,status:"OPEN",startsOn:{lte:date},endsOn:{gte:date}}});
  if(!period)throw new AppError("İşlem tarihi için açık muhasebe dönemi yok.",409);
  if(input.lines.length<2||input.lines.length>500)throw new AppError("Fiş en az iki, en fazla 500 satır içermeli.");
  let debit=decimal(0),credit=decimal(0);
  for(const line of input.lines) {
    const d=decimal(line.debit),c=decimal(line.credit);
    if(d.isNegative()||c.isNegative()||d.decimalPlaces()>2||c.decimalPlaces()>2||d.gt(0)===c.gt(0))throw new AppError("Geçersiz borç/alacak satırı.");
    debit=debit.add(d);credit=credit.add(c);
    const acct=await tx.ledgerAccount.findFirst({where:{orgId:a.orgId,id:line.accountId,active:true}});
    if(!acct)throw new AppError("Muhasebe hesabı bulunamadı.",404);
    const purpose=acct.purpose??await inheritedPurpose(tx,a,acct.id);
    if(acct.partyId){if(line.partyId&&line.partyId!==acct.partyId)throw new AppError("Alt hesap carisi uyumsuz.");line.partyId=acct.partyId;}
    if(controlPurposes.includes(purpose??"")!==!!line.partyId)throw new AppError("Kontrol hesabı için cari bağlantısı zorunludur.");
    if(line.partyId){const p=await party(tx,a,line.partyId);if(["AR","CUSTOMER_ADVANCE"].includes(purpose??"")!==(p.kind==="customers"))throw new AppError("Cari türü ile kontrol hesabı uyumsuz.");}
  }
  if(!debit.eq(credit))throw new AppError("Dengesiz muhasebe fişi kesinleştirilemez.",409);
  const entry=await tx.journalEntry.create({data:{id:randomUUID(),orgId:a.orgId,number:await nextNumber(tx,a,"JV"),periodId:period.id,effectiveOn:date,currency:"TRY",sourceType:input.sourceType,sourceId:input.sourceId,description:input.description,createdBy:a.userId,reversalOf:input.reversalOf}});
  await tx.journalLine.createMany({data:input.lines.map(l=>({orgId:a.orgId,entryId:entry.id,accountId:l.accountId,partyId:l.partyId||null,debit:l.debit,credit:l.credit,description:l.description??input.description}))});
  await tx.journalEntry.update({where:{id:entry.id},data:{status:"POSTED"}});
  await audit(tx,a,"FINANCE JOURNAL POSTED",entry.id,{sourceType:input.sourceType,sourceId:input.sourceId,backdateReason:input.backdateReason??null});
  return {...entry,status:"POSTED"};
}
export async function reverseLines(tx:FinanceTx,a:Actor,entryId:string) {
  const original=await tx.journalEntry.findFirst({where:{orgId:a.orgId,id:entryId,status:"POSTED"}});
  if(!original||await tx.journalEntry.findFirst({where:{orgId:a.orgId,reversalOf:entryId}}))throw new AppError("Fiş ters çevrilemez.",409);
  const lines=await tx.journalLine.findMany({where:{orgId:a.orgId,entryId}});
  return {original,lines:lines.map(l=>({accountId:l.accountId,partyId:l.partyId,debit:l.credit,credit:l.debit}))};
}
export const exampleChart=[
  ["100","Kasa","ASSET","CASH"],["102","Bankalar","ASSET","BANK"],["120","Alıcılar","ASSET","AR"],
  ["153","Ticari mallar","ASSET","INVENTORY"],["159","Verilen sipariş avansları","ASSET","SUPPLIER_ADVANCE"],
  ["191","İndirilecek KDV","ASSET","INPUT_TAX"],["320","Satıcılar","LIABILITY","AP"],
  ["340","Alınan sipariş avansları","LIABILITY","CUSTOMER_ADVANCE"],["391","Hesaplanan KDV","LIABILITY","OUTPUT_TAX"],
  ["500","Açılış karşı hesabı — inceleme gerekli","EQUITY","OPENING"],["600","Yurtiçi satışlar","INCOME","REVENUE"],["770","Genel yönetim giderleri","EXPENSE","EXPENSE"],
];
