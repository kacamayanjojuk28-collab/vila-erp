import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFetch, rememberContext } from '../src/components/company-context';

test('a late response is discarded even when its headers match the original request', async t => {
 const values = new Map<string,string>();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
  getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),
 }});
 let deliver!: (response:Response)=>void;
 t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>{ deliver=resolve; }));
 rememberContext({company:'A',user:'owner'});
 const pending=companyFetch('dashboard-engine/preferences');
 rememberContext({company:'B',user:'owner'});
 deliver(Response.json({widgets:[]},{headers:{'X-Vila-Company':'A','X-Vila-User':'owner'}}));
 await assert.rejects(pending,/bağlamı değişti/);
});
