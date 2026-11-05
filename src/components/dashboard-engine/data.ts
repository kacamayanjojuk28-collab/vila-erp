"use client";
import { useEffect,useRef,useState } from 'react';
import { companyFetch,currentContext } from "../company-context";
import { allowed,type Widget } from '@/lib/dashboard-registry';
export const dataKey=(w:Widget)=>w.type+':'+JSON.stringify(w.settings);
type Result={data?:any;error?:string};
export function useWidgetData(widgets:Widget[],role:string,revision:number){
 const [results,setResults]=useState<Record<string,Result>>({});
 const cache=useRef<{scope:string;values:Record<string,Result>}>({scope:'',values:{}});
 const signature=JSON.stringify([...new Set(widgets.filter(w=>w.visible&&allowed(role,w.type)).map(dataKey))].sort());
 useEffect(()=>{
  const controller=new AbortController(),scope=JSON.stringify([currentContext(),role,revision]),keys:string[]=JSON.parse(signature);
  if(cache.current.scope!==scope)cache.current={scope,values:{}};
  // Keep only active data keys: geometry changes do not fetch; adding or hiding a
  // widget does not reload completed, unchanged neighbours. Cache is bounded.
  cache.current.values=Object.fromEntries(keys.filter(k=>cache.current.values[k]).map(k=>[k,cache.current.values[k]]));
  setResults({...cache.current.values});
  for(const key of keys){if(cache.current.values[key])continue;const index=key.indexOf(':'),type=key.slice(0,index),settings=key.slice(index+1);
   companyFetch('dashboard-engine/widget?'+new URLSearchParams({type,settings}),{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){cache.current.values[key]={data};setResults(r=>({...r,[key]:{data}}));}}).catch(e=>{if(!controller.signal.aborted){cache.current.values[key]={error:e.message};setResults(r=>({...r,[key]:{error:e.message}}));}});
  }
  return()=>controller.abort();
 },[signature,role,revision]);
 return results;
}
