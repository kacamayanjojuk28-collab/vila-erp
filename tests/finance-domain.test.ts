import {test} from 'node:test';import assert from 'node:assert/strict';import {invoiceAmounts,day,today} from '../src/lib/finance-domain';
test('Finance Decimal policy: discounted base, per-line tax and half-up cents',()=>{
 const a=invoiceAmounts('1','1000','0','20');assert.equal(a.net.toFixed(2),'1000.00');assert.equal(a.tax.toFixed(2),'200.00');assert.equal(a.total.toFixed(2),'1200.00');
 const b=invoiceAmounts('2.5','99.99','10','20');assert.equal(b.discount.toFixed(2),'25.00');assert.equal(b.net.toFixed(2),'224.98');assert.equal(b.tax.toFixed(2),'45.00');assert.equal(b.total.toFixed(2),'269.98');
 const c=invoiceAmounts('3','0.05','0','10');assert.equal(c.tax.toFixed(2),'0.02');assert.equal(c.total.toFixed(2),'0.17');
 const d=invoiceAmounts('1','99.99','100','0');assert.equal(d.total.toFixed(2),'0.00');
});
test('Finance dates reject rollover and preserve valid leap days',()=>{assert.equal(day.safeParse('2026-02-30').success,false);assert.equal(day.safeParse('2028-02-29').success,true);assert.equal(day.safeParse('2026-02-29').success,false);});

test('Finance business date remains Istanbul while transaction timestamps use UTC',()=>{assert.equal(today(new Date('2026-11-03T22:30:00Z')),'2026-11-04');assert.equal(today(new Date('2026-11-03T20:59:00Z')),'2026-11-03');});
