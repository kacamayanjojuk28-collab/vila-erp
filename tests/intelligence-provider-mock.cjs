// Preloaded only by the isolated browser verification script.
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=new URL(typeof input==='string'?input:input.url??String(input));
 if(url.hostname!=='api.anthropic.com')return originalFetch(input,init);
 if(process.env.VILA_AI_KEY!=='isolated-test-credential')throw Error('Unexpected mock configuration');
 const body=JSON.parse(init.body);
 const choices=JSON.parse(body.messages[0].content);
 const open=choices.find(item=>item.id==='openOrders' && item.section==='summary');
 if(!open || !open.text.includes('1.') || body.tools)throw Error('Unexpected ERP payload');
 return Response.json({stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:20},content:[
  {type:'text',text:JSON.stringify({summary:['openOrders'],positive:[],risks:[],reviews:['openOrders']})}
 ]});
};
