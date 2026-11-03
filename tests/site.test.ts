import {test} from "node:test";
import assert from "node:assert/strict";
import {productionOrigin,siteMetadata} from "../src/lib/site";
test("SEO origin stays absent on staging and rejects unsafe production origins",()=>{
  assert.equal(productionOrigin("staging","https://example.com"),undefined);
  for(const value of ["http://example.com","https://localhost","https://127.0.0.1","https://example.com/path","https://u:p@example.com","https://example.com?x=1"])
    assert.throws(()=>productionOrigin("production",value));
  assert.equal(productionOrigin("production","https://example.com")?.origin,"https://example.com");
});
test("Private shell is noindex even with verified production origin",()=>{
  const metadata=siteMetadata(new URL("https://example.com"));
  assert.deepEqual(metadata.robots,{index:false,follow:false});
  assert.equal(metadata.alternates?.canonical,"https://example.com/");
});
