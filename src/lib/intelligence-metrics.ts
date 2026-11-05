import { z } from "zod";

export const metricSchema = z.object({
  id: z.enum(["openOrders","partialOrders","fulfilledOrders"]),
  label: z.string(), value: z.number().int().nonnegative().nullable(),
  unit: z.literal("sipariş"), period: z.literal("Tüm dönem"),
  source: z.literal("Satış siparişleri"), updatedAt: z.iso.datetime(),
  status: z.enum(["available","unavailable"]), drillDown: z.literal("sales")
}).strict();
export type Metric = z.infer<typeof metricSchema>;
type Section = "summary" | "positive" | "risks" | "reviews";
export type Finding = {id:Metric["id"];section:Section;text:string};

export function salesMetrics(rows: {status:string;_count:{_all:number}}[], now = new Date()):Metric[] {
  const count = (status:string) => rows.find(row=>row.status===status)?._count._all ?? 0;
  const fulfilled=count("FULFILLED"), partial=count("PARTIAL"), open=count("CONFIRMED")+partial;
  const available=open+fulfilled>0;
  return ([
    ["openOrders","Açık satış siparişleri",open],
    ["partialOrders","Kısmen karşılanan satış siparişleri",partial],
    ["fulfilledOrders","Karşılanan satış siparişleri",fulfilled]
  ] as const).map(([id,label,value])=>metricSchema.parse({id,label,value:available?value:null,
    unit:"sipariş",period:"Tüm dönem",source:"Satış siparişleri",updatedAt:now.toISOString(),
    status:available?"available":"unavailable",drillDown:"sales"}));
}

export function candidates(metrics:Metric[]): Finding[] {
  const findings:Finding[]=[];
  for(const m of metrics){
    if(m.status!=="available" || m.value===null)continue;
    findings.push({id:m.id,section:"summary",text:m.label+" toplamı "+m.value+"."});
    if(m.id==="fulfilledOrders" && m.value>0) findings.push({id:m.id,section:"positive",text:m.value+" satış siparişinin karşılanması tamamlanmış."});
    if(m.id==="partialOrders" && m.value>0) findings.push({id:m.id,section:"risks",text:m.value+" sipariş kısmen karşılanmış durumda."});
    if(m.id==="openOrders" && m.value>0) findings.push({id:m.id,section:"reviews",text:"Açık satış siparişlerinin karşılanma durumunu inceleyin."});
  }
  return findings;
}

const reference=z.array(z.string()).max(3);
const selection=z.object({summary:reference.min(1),positive:reference,risks:reference,reviews:reference}).strict();
export function interpret(raw:unknown, options:Finding[]) {
  const parsed=selection.parse(raw);
  return (Object.keys(parsed) as Section[]).flatMap(section=>{
    if(new Set(parsed[section]).size!==parsed[section].length)throw Error("Yinelenen bulgu");
    return parsed[section].map(id=>{
      const finding=options.find(item=>item.id===id && item.section===section);
      if(!finding)throw Error("Kaynakla uyuşmayan bulgu");
      return finding;
    });
  });
}
