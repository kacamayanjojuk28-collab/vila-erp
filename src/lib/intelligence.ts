import { createHash } from "node:crypto";
import { db } from "./db";
import { canRead } from "./permissions";
import { AppError,rateLimit,type Actor } from "./security";
import { candidates,interpret,salesMetrics,type Finding } from "./intelligence-metrics";
import { providerConfig,requestInterpretation,type Config } from "./intelligence-provider";

type Analysis={findings:Finding[];analyzedAt:string};
const cache=new Map<string,Analysis>();
const pending=new Map<string,Promise<Analysis>>();
const ttl=5*60_000;
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");

// Reserve conservatively before each outbound attempt, including a retry. The
// atomic counter is shared across workers and survives process restarts.
export async function reserveBudget(company:string,config:Config) {
  const charge=Math.ceil(8192*config.inputPrice+384*config.outputPrice);
  const budget=Math.floor(config.dailyUsd*1_000_000);
  if(charge>budget)throw new AppError("Günlük analiz bütçesi doldu.",429);
  const key="ai:budget:"+hash(company);
  const rows=await db.$queryRaw<{count:number}[]>`
    INSERT INTO "RateLimit" (key,count,until) VALUES (${key},${charge},date_trunc('day',timezone('UTC',now()))+interval '1 day')
    ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "RateLimit".until<=timezone('UTC',now()) THEN excluded.count ELSE "RateLimit".count+excluded.count END,
    until=excluded.until WHERE "RateLimit".until<=timezone('UTC',now()) OR "RateLimit".count+excluded.count<=${budget}
    RETURNING count`;
  if(!rows.length)throw new AppError("Günlük analiz bütçesi doldu.",429);
}

export async function overview(actor:Actor,refresh=false,provider=requestInterpretation){
  if(!canRead(actor.role,"sales"))throw new AppError("Satış analizi için yetkiniz yok.",403);
  const rows=await db.document.groupBy({by:["status"],where:{orgId:actor.orgId,kind:"sales",archived:false,
    status:{in:["CONFIRMED","PARTIAL","FULFILLED"]}},_count:{_all:true}});
  const metrics=salesMetrics(rows);
  const approved=(process.env.VILA_AI_APPROVED_TENANTS??"").split(",").map(id=>id.trim()).includes(actor.orgId);
  const manager=["OWNER","ADMIN"].includes(actor.role);
  const config=providerConfig();
  const base={metrics,canRefresh:approved&&manager&&!!config};
  if(!approved)return {...base,status:"disabled" as const};
  if(!manager)return {...base,status:"restricted" as const};
  if(!config)return {...base,status:"unconfigured" as const};
  const options=candidates(metrics);
  if(!options.length)return {...base,status:"empty" as const};
  const key=hash(JSON.stringify([actor.orgId,actor.userId,actor.role,config.model,options]));
  const cached=cache.get(key);
  if(cached && Date.now()-Date.parse(cached.analyzedAt)<ttl)return {...base,status:"ready" as const,...cached};
  if(!refresh)return {...base,status:"idle" as const};
  const generate=async():Promise<Analysis>=>{
    await rateLimit("ai:user:"+hash(actor.orgId+":"+actor.userId),4);
    await rateLimit("ai:org:"+hash(actor.orgId),12);
    for(let attempt=0;;attempt++){
      await reserveBudget(actor.orgId,config);
      try{
        const reply=await provider(options,config);
        console.info("vila.intelligence.usage",{tenant:hash(actor.orgId),model:config.model,input:reply.input,
          output:reply.output,estimatedUsd:(reply.input*config.inputPrice+reply.output*config.outputPrice)/1e6});
        const result={findings:interpret(reply.raw,options),analyzedAt:new Date().toISOString()};
        if(cache.size>=256)cache.delete(cache.keys().next().value!);
        cache.set(key,result);
        return result;
      }catch(e){if(attempt!==0||!(e instanceof Error && "retryable" in e && e.retryable))throw e;}
    }
  };
  let job=pending.get(key);
  if(!job){
    if(pending.size>=8)throw new AppError("Analiz kapasitesi dolu.",429);
    job=generate().finally(()=>pending.delete(key));pending.set(key,job);
  }
  try{return {...base,status:"ready" as const,...await job};}
  catch(e){if(e instanceof AppError)throw e;return {...base,status:"unavailable" as const};}
}
