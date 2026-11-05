"use client";
import { useState } from "react";
import { api,type Row } from "../ui";
import type { Finding,Metric } from "@/lib/intelligence-metrics";

const messages:Record<string,string>={
 disabled:"Bu şirket için harici analiz kapalı.",
 unconfigured:"Analiz sağlayıcısı henüz yapılandırılmadı.",
 restricted:"Harici analizi şirket yöneticisi başlatabilir.",
 empty:"Bu dönem için analiz edilebilecek satış siparişi bulunmuyor.",
 idle:"Yönetici özeti henüz oluşturulmadı.",
 unavailable:"Analiz sağlayıcısından geçerli bir yanıt alınamadı."
};
const titles={summary:"Genel durum",positive:"Olumlu gelişmeler",risks:"Dikkat gerektiren konular",reviews:"Önerilen incelemeler"};

export function IntelligenceWidget({data,go}:{data:Row;go:(view:string)=>void}){
 const [reply,setReply]=useState<{source:Row;result:Row}>();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const result=reply?.source===data ? reply.result : data;
 async function refresh(){
  if(!confirm("Bu şirkete ait toplu satış göstergeleri yorumlanmak üzere Anthropic’e gönderilsin mi?"))return;
  setBusy(true);setError("");
  try{setReply({source:data,result:await api("dashboard-engine/intelligence","POST",{confirmExternalProcessing:true})});}
  catch(e){setError(e instanceof Error?e.message:"Analiz tamamlanamadı.");}
  finally{setBusy(false);}
 }
 return <div aria-busy={busy}><small>AI Executive Overview</small>
  <p role="status">{busy?"Analiz hazırlanıyor…":messages[result.status]}</p>
  {error&&<p role="alert">{error}</p>}
  {result.status==="ready"&&<><small>Son analiz · {new Date(result.analyzedAt).toLocaleString("tr-TR")}</small>
   {Object.entries(titles).map(([key,title])=>{
    const findings=(result.findings as Finding[]).filter(f=>f.section===key);
    return findings.length>0&&<section key={key}><h4>{title}</h4>{findings.map(f=><p key={f.id}>{f.text}</p>)}</section>;
   })}</>}
  <h4>Veri kapsamı</h4><small>Satış siparişleri · Tüm dönem</small>
  {(result.metrics as Metric[]).map(m=><div key={m.id} className="row"><span className="grow">{m.label}</span><b>{m.value??"Veri yok"}</b></div>)}
  <button className="btn sm" onClick={()=>go("sales")}>Satış siparişlerini aç</button>
  {result.canRefresh&&<button className="btn sm" disabled={busy} onClick={refresh}>Analizi yenile</button>}
 </div>;
}
