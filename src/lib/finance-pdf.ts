import PDFDocument from "pdfkit";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { invoiceGet } from "./finance-engine";

// Authorized caller supplies a tenant-scoped invoice snapshot. This is not a GIB e-document.
export async function invoicePdf(invoice:Awaited<ReturnType<typeof invoiceGet>>,organization:string):Promise<Buffer> {
  const font=readFileSync(path.join(process.cwd(),"public/fonts/Urbanist.ttf"));
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:44,info:{Title:invoice.number,Author:"VILA",Subject:"İç kayıt — Resmî e-belge değildir"}}),chunks:Buffer[]=[];
    doc.on("data",chunk=>chunks.push(chunk));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);
    doc.registerFont("Urbanist",font).font("Urbanist");
    const header=()=>{doc.fillColor("#151d1a").rect(0,0,596,84).fill();doc.fillColor("#d4f56b").fontSize(26).text("VILA",44,25);doc.fillColor("#ffffff").fontSize(11).text("İç kayıt / Taslak — Resmî e-belge değildir",180,35,{width:370,align:"right"});doc.fillColor("#15211a");doc.x=44;doc.y=105;};
    header();doc.fontSize(15).text(organization).moveDown(.4);doc.fontSize(11).text(`${invoice.number} · ${({SALE:"Satış",PURCHASE:"Alış",SALES_CREDIT:"Satış alacaklandırma",PURCHASE_CREDIT:"Alış alacaklandırma"} as Record<string,string>)[invoice.kind]??invoice.kind} · ${({DRAFT:"Taslak",APPROVED:"Onaylı",POSTED:"Kesinleşmiş"} as Record<string,string>)[invoice.status]??invoice.status}`).text(`Cari: ${invoice.partyName}`).text(`Belge: ${invoice.issuedOn.toISOString().slice(0,10)}     Vade: ${invoice.dueOn.toISOString().slice(0,10)}`).text(`Para birimi: ${invoice.currency}`).text(`Sipariş: ${invoice.orderId??"—"}`).text(`Düzeltme kaynağı: ${invoice.originalId??"—"}`).moveDown();
    doc.on("pageAdded",header);
    for(const l of invoice.lines){
      const description=`${l.name}\n${l.quantity} × ${l.unitPrice} TRY · İskonto %${l.discountRate} · Vergi %${l.taxRate} (${l.taxClassification})\nMatrah ${l.net} · Vergi ${l.tax} · Toplam ${l.total} TRY`;
      const height=doc.heightOfString(description,{width:500})+20;
      if(doc.y+height>740)doc.addPage();
      const y=doc.y;doc.fontSize(10).text(description,44,y,{width:500});doc.y+=10;doc.strokeColor("#cbd3cc").moveTo(44,doc.y).lineTo(550,doc.y).stroke();doc.y+=10;
    }
    if(doc.y>650)doc.addPage();doc.moveDown().fontSize(12).text(`İskonto: ${invoice.discount} TRY`).text(`Matrah: ${invoice.net} TRY`).text(`Vergi: ${invoice.tax} TRY`).text(`Genel toplam: ${invoice.total} TRY`);
    doc.moveDown().fontSize(9).fillColor("#536057").text(`Kayıt referansı: ${invoice.id}\nMuhasebe fişi: ${invoice.journalId??"Henüz kesinleştirilmedi"}\nGİB'e gönderilmemiştir. Resmî e-Fatura/e-Arşiv Fatura yerine kullanılamaz.`);
    doc.end();
  });
}
