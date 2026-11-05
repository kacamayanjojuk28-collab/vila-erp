import test from "node:test";
import assert from "node:assert/strict";
import {candidates,interpret,salesMetrics} from "../src/lib/intelligence-metrics";
test("intelligence distinguishes a measured zero from no qualifying sales records",()=>{
 const empty=salesMetrics([]);
 assert.ok(empty.every(metric=>metric.status==="unavailable" && metric.value===null));
 assert.deepEqual(candidates(empty),[]);
 const orders=salesMetrics([{status:"FULFILLED",_count:{_all:1}}]);
 assert.equal(orders[0].status,"available");
 assert.equal(orders[0].value,0);
});
test("provider cannot narrate unauthorised metrics, invent warnings or emit HTML",()=>{
 const options=candidates(salesMetrics([{status:"FULFILLED",_count:{_all:1}}]));
 const valid={summary:["openOrders"],positive:["fulfilledOrders"],risks:[],reviews:[]};
 assert.equal(interpret(valid,options).length,2);
 for(const changes of [{risks:["partialOrders"]},{summary:["cashBalance"]},{summary:["<script>"]},{command:"pay"},{summary:["openOrders","openOrders"]}])
  assert.throws(()=>interpret({...valid,...changes},options));
});
