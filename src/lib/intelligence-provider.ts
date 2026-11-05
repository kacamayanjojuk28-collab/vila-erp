import { z } from "zod";
import type { Finding } from "./intelligence-metrics";

export function providerConfig() {
  const result=z.object({key:z.string().min(1),model:z.string().min(1),
    inputPrice:z.coerce.number().positive(),outputPrice:z.coerce.number().positive(),
    dailyUsd:z.coerce.number().positive().max(1000)
  }).safeParse({key:process.env.VILA_AI_KEY,model:process.env.VILA_AI_MODEL,
    inputPrice:process.env.VILA_AI_INPUT_USD_PER_MTOK,outputPrice:process.env.VILA_AI_OUTPUT_USD_PER_MTOK,
    dailyUsd:process.env.VILA_AI_DAILY_USD});
  return result.success?result.data:null;
}
export type Config=NonNullable<ReturnType<typeof providerConfig>>;
const sections=["summary","positive","risks","reviews"];
const schema={type:"object",additionalProperties:false,required:sections,properties:Object.fromEntries(
  sections.map(key=>[key,{type:"array",items:{type:"string"}}]))};

export async function requestInterpretation(options:Finding[], config:Config, transport:typeof fetch=fetch){
  const response=await transport("https://api.anthropic.com/v1/messages",{method:"POST",redirect:"error",
    signal:AbortSignal.timeout(12000),headers:{"Content-Type":"application/json","x-api-key":config.key,"anthropic-version":"2023-06-01"},
    body:JSON.stringify({model:config.model,max_tokens:384,
      system:"Bir Türkçe yönetici özeti için verilen doğrulanmış bulguları önem sırasına koy. Her bölüm için yalnızca o bölümdeki bulguların id alanlarını seç. Genel özette en az bir bulgu seç. Dayanağı olmayan bölümü boş bırak.",
      messages:[{role:"user",content:JSON.stringify(options)}],output_config:{format:{type:"json_schema",schema}}})});
  if(!response.ok)throw Object.assign(Error("Sağlayıcıya erişilemedi."),{retryable:[429,503].includes(response.status)});
  const data=z.object({stop_reason:z.literal("end_turn"),content:z.tuple([z.object({type:z.literal("text"),text:z.string().max(5000)})]),
    usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()})}).parse(await response.json());
  return {raw:JSON.parse(data.content[0].text),input:data.usage.input_tokens,output:data.usage.output_tokens};
}
