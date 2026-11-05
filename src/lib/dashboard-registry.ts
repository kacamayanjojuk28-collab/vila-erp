import { z } from 'zod';
import { canRead } from './permissions';
export const breakpoints={lg:1200,md:960,sm:600,xs:0};
export const columns={lg:12,md:10,sm:6,xs:2};
export type Breakpoint=keyof typeof columns;
export type Settings={limit:number;period:'all'|'30d'|'month';months:6|12;sort:'amount'|'date';status:'all'|'active'|'done'};
export type WidgetDefinition={type:string;title:string;description:string;category:string;icon:string;scope:string;module:string;defaultSize:{w:number;h:number};minSize:{w:number;h:number};maxSize:{w:number;h:number};configurable:boolean;options:(keyof Settings)[]};
const definition=(type:string,title:string,category:string,scope:string,module:string,w:number,h:number,options:(keyof Settings)[]=[],description='Gerçek ERP kayıtlarından hesaplanır.'):WidgetDefinition=>({type,title,description,category,scope,module,icon:category,defaultSize:{w,h},minSize:{w:2,h:3},maxSize:{w:12,h:16},configurable:!!options.length,options});
export const widgetRegistry:Record<string,WidgetDefinition>=Object.fromEntries([
 definition('income','Tahsil edilen tutar','Genel Bakış','finance','finance',4,3,['period'],'Operasyonel ödeme kayıtları; muhasebe geliri değildir.'),
 definition('receivable','Açık alacak','Genel Bakış','finance','sales',4,3,['period'],'Operasyonel satış siparişi bakiyesi.'),
 definition('completion','Tamamlanan görevler','Genel Bakış','tasks','tasks',4,3),
 definition('cashflow','Nakit akışı','Finans','finance','finance',8,6,['months','period'],'Operasyonel tahsilat ve ödeme hareketleri.'),
 definition('opportunities','Öne çıkan fırsatlar','Satış ve CRM','deals','deals',4,6,['limit','sort']),
 definition('sales','Satış siparişleri özeti','Satış ve CRM','sales','sales',4,5,['period']),
 definition('pipeline','Satış pipeline özeti','Satış ve CRM','deals','deals',4,5),
 definition('financial','Finansal durum','Finans','finance','finance',4,5,['period'],'Operasyonel sipariş bakiyeleri ve net nakit.'),
 definition('balances','Muhasebeleştirilmiş açık bakiye','Finans','finance-core','finance-core',4,5,[],'Finance Core kesinleşmiş fatura bakiyeleri; sipariş bakiyesi değildir.'),
 definition('overdue','Vadesi geçen alacaklar','Finans','finance-core','finance-core',4,5,[],'Finance Core kesinleşmiş satış faturalarının vade yaşlandırması.'),
 definition('stock','Kritik stok takibi','Stok ve Satın Alma','stock','stock',4,5,['limit']),
 definition('purchases','Satın alma özeti','Stok ve Satın Alma','purchases','purchases',4,5,['period']),
 definition('team','Ekip ilerlemesi','Projeler ve Görevler','tasks','tasks',4,5),
 definition('projects','Proje portföyü','Projeler ve Görevler','projects','projects',4,5,['limit','status']),
 definition('tasks','Yaklaşan görevler','Projeler ve Görevler','tasks','tasks',4,5,['limit','status']),
 definition('activity','Son aktiviteler','Operasyonlar','audit','audit',12,5,['limit']),
 definition('intelligence','VILA Intelligence','Genel Bakış','sales','sales',8,6,[],'AI Executive Overview')
].map(x=>[x.type,x]));
export const settingsSchema=z.object({limit:z.union([z.literal(3),z.literal(5),z.literal(10)]).default(5),period:z.enum(['all','30d','month']).default('all'),months:z.union([z.literal(6),z.literal(12)]).default(12),sort:z.enum(['amount','date']).default('amount'),status:z.enum(['all','active','done']).default('all')}).strict();
export const defaultSettings=settingsSchema.parse({});
export type Widget={id:string;type:string;visible:boolean;settings:Settings};
export type Position={i:string;x:number;y:number;w:number;h:number};
export type DashboardLayout={schemaVersion:2;widgets:Widget[];layout:Record<Breakpoint,Position[]>};
export function allowed(role:string,type:string){return Object.hasOwn(widgetRegistry,type)&&canRead(role,widgetRegistry[type].scope);}
const widgetSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),type:z.string().refine(t=>Object.hasOwn(widgetRegistry,t),'Bilinmeyen widget'),visible:z.boolean(),settings:settingsSchema}).strict();
const positionSchema=z.object({i:z.string(),x:z.number().int().min(0).max(12),y:z.number().int().min(0).max(1000),w:z.number().int().min(1).max(12),h:z.number().int().min(3).max(16)}).strict();
export const layoutSchema=z.object({schemaVersion:z.literal(2),widgets:z.array(widgetSchema).max(20),layout:z.object({lg:z.array(positionSchema).max(20),md:z.array(positionSchema).max(20),sm:z.array(positionSchema).max(20),xs:z.array(positionSchema).max(20)}).strict()}).strict().superRefine((v,ctx)=>{
 const ids=new Set(v.widgets.map(w=>w.id));if(ids.size!==v.widgets.length)ctx.addIssue({code:'custom',message:'Widget kimlikleri benzersiz olmalı'});
 for(const bp of Object.keys(columns) as Breakpoint[]){const rows=v.layout[bp];if(rows.length!==ids.size||new Set(rows.map(p=>p.i)).size!==ids.size||rows.some(p=>!ids.has(p.i)))ctx.addIssue({code:'custom',message:'Yerleşim/widget eşleşmesi hatalı'});
 for(const p of rows){const d=widgetRegistry[v.widgets.find(w=>w.id===p.i)?.type??''];if(p.x+p.w>columns[bp]||!d||p.w<Math.min(d.minSize.w,columns[bp])||p.h<d.minSize.h)ctx.addIssue({code:'custom',message:'Widget sınırı aşıldı'});}
 const visible=rows.filter(p=>v.widgets.find(w=>w.id===p.i)?.visible);for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)ctx.addIssue({code:'custom',message:'Widget çakışması'});}}
});
export function pack(widgets:Widget[],bp:Breakpoint,old:Position[]=[]):Position[]{let y=0,x=0,rowHeight=0;return widgets.map(w=>{const d=widgetRegistry[w.type],prior=old.find(p=>p.i===w.id),width=Math.min(columns[bp],prior?.w??d.defaultSize.w),h=prior?.h??d.defaultSize.h;if(x+width>columns[bp]){x=0;y+=rowHeight;rowHeight=0;}const p={i:w.id,x,y,w:width,h};x+=width;rowHeight=Math.max(rowHeight,h);return p;});}
// Saved documents contain a bounded rectangle for every widget, including hidden ones.
export function revealWidget(doc: DashboardLayout, id: string): DashboardLayout {
  const visible = new Set(doc.widgets.filter(widget => widget.visible).map(widget => widget.id));
  const layout = { ...doc.layout };
  for (const bp of Object.keys(columns) as Breakpoint[]) {
    const positions = layout[bp];
    const saved = positions.find(position => position.i === id);
    if (!saved) throw new Error('Kayıtlı widget konumu bulunamadı.');
    const occupied = positions.filter(position => position.i !== id && visible.has(position.i));
    const fits = (x: number, y: number) => occupied.every(other =>
      x + saved.w <= other.x || x >= other.x + other.w ||
      y + saved.h <= other.y || y >= other.y + other.h
    );
    if (fits(saved.x, saved.y)) continue;

    // The first free row starts at zero or at the bottom edge of an obstacle.
    const rows = [...new Set([0, ...occupied.map(other => other.y + other.h)])].sort((a,b) => a-b);
    let placed = false;
    for (const y of rows) {
      if (y > 1000) break;
      for (let x = 0; x + saved.w <= columns[bp]; x++) {
        if (!fits(x, y)) continue;
        layout[bp] = positions.map(position => position.i === id ? { ...saved, x, y } : position);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) throw new Error('Widget için yerleşim sınırları içinde boş alan bulunamadı.');
  }
  return { ...doc, layout, widgets: doc.widgets.map(widget => widget.id === id ? { ...widget, visible: true } : widget) };
}
export function defaults(role:string):DashboardLayout{const types=['income','receivable','completion','cashflow','opportunities','team','financial','projects','stock','activity'];const widgets=types.filter(t=>allowed(role,t)).map(type=>({id:'default-'+type,type,visible:true,settings:{...defaultSettings}}));return {schemaVersion:2,widgets,layout:Object.fromEntries(Object.keys(columns).map(bp=>[bp,pack(widgets,bp as Breakpoint)])) as DashboardLayout['layout']};}
// Read migration: unknown types are omitted, valid settings retained, invalid coordinates repacked.
export function upgrade(raw:any,role:string):DashboardLayout{if(raw?.schemaVersion===2){const parsed=layoutSchema.safeParse({schemaVersion:2,widgets:raw.widgets,layout:raw.layout});if(parsed.success)return parsed.data;}
 const widgets:Widget[]=[];const seen=new Set<string>();for(const w of Array.isArray(raw?.widgets)?raw.widgets.slice(0,20):[]){if(!Object.hasOwn(widgetRegistry,w.type)||seen.has(w.id)||! /^[a-zA-Z0-9_-]{1,80}$/.test(w.id??''))continue;seen.add(w.id);const parsed=settingsSchema.safeParse(w.settings??{});widgets.push({id:w.id,type:w.type,visible:w.visible!==false,settings:parsed.success?parsed.data:{...defaultSettings}});}if(!widgets.length)return defaults(role);return {schemaVersion:2,widgets,layout:Object.fromEntries(Object.keys(columns).map(bp=>[bp,pack(widgets,bp as Breakpoint)])) as DashboardLayout['layout']};}
