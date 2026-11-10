const test=require("node:test"),assert=require("node:assert/strict");
const env={GROQ_API_KEY:"test",GROQ_MODELS:"active-groq",OPENROUTER_API_KEY:"test",OPENROUTER_MODELS:"free-model",GEMINI_API_KEY:"test",GEMINI_MODELS:"active-gemini"};
function stream(text){return new Response(new ReadableStream({start(c){const b=new TextEncoder().encode(text);for(let i=0;i<b.length;i+=7)c.enqueue(b.slice(i,i+7));c.close();}}));}
function providerFetch(failGroq=false){
 return async(url,options)=>{
  if(url.endsWith("/models"))return Response.json(url.includes("googleapis")?{models:[{name:"models/active-gemini",supportedGenerationMethods:["generateContent"]}]}:{data:[{id:url.includes("groq")?"active-groq":"free-model",pricing:{prompt:"0",completion:"0"}}]});
  if(url.includes("groq")&&failGroq)return new Response("",{status:429});
  assert.ok(options.signal);assert.ok(options.headers.Authorization||options.headers["x-goog-api-key"]);
  return stream(url.includes("googleapis")?'data: {"candidates":[{"content":{"parts":[{"text":"héllo"}]}}]}\n\n':'data: {"choices":[{"delta":{"content":"héllo"}}]}\n\ndata: [DONE]\n\n');
 };
}
for(const provider of ["groq","openrouter","gemini"]){
 test("mock AI streaming "+provider,async()=>{
  const {generate}=await import("../gateway/providers.mjs");const output=[];
  await generate(env,{provider,question:"Explain",context:"x"},e=>output.push(e),new AbortController().signal,providerFetch());
  assert.equal(output.map(x=>x.text).join(""),"héllo");
  assert.equal(output[0].provider,provider);
 });
}
test("mock AI falls back after rate limiting",async()=>{
 const {generate}=await import("../gateway/providers.mjs");const output=[];
 await generate(env,{question:"Explain",context:"x"},e=>output.push(e),new AbortController().signal,providerFetch(true));
 assert.equal(output[0].provider,"openrouter");
});
test("catalog rejects paid and removed models",async()=>{
 const {catalog}=await import("../gateway/providers.mjs");
 assert.deepEqual(await catalog(env,new AbortController().signal,async()=>Response.json({data:[{id:"free-model",pricing:{prompt:"1",completion:"0"}}]})),[]);
});
test("unlisted models rejected",async()=>{
 const {generate}=await import("../gateway/providers.mjs");
 await assert.rejects(generate(env,{provider:"groq",model:"unlisted",question:"x",context:""},()=>{},new AbortController().signal,providerFetch()),/not configured/);
});
test("stream cancellation does not invoke fallback",async()=>{
 const {generate}=await import("../gateway/providers.mjs");const controller=new AbortController();let calls=0;
 await assert.rejects(generate(env,{question:"x",context:""},()=>{},controller.signal,async(url,opts)=>{
  if(url.endsWith("/models"))return providerFetch()(url,opts);
  calls++;controller.abort();throw Error("Cancelled");
 }));
 assert.equal(calls,1);
});
test("gateway rejects origin and unconfigured provider",async()=>{
 const worker=(await import("../gateway/worker.mjs")).default;
 assert.equal((await worker.fetch(new Request("https://gateway",{method:"POST",headers:{Origin:"https://attacker.test"}}),{},{})).status,403);
 assert.equal((await worker.fetch(new Request("https://gateway",{method:"POST",headers:{Origin:"https://codecollab-rudra.web.app"}}),{},{})).status,503);
});
test("durable quota enforces active lease and daily count",async()=>{
 const {Quota}=await import("../gateway/worker.mjs");const values=new Map();
 const storage={get:async k=>values.get(k),put:async(k,v)=>values.set(k,v),transaction:async fn=>fn(storage)};
 const quota=new Quota({storage});
 assert.equal((await quota.fetch(new Request("https://quota/reserve"))).status,200);
 assert.equal((await quota.fetch(new Request("https://quota/reserve"))).status,429);
 await quota.fetch(new Request("https://quota/release"));
 const row=values.get("quota");row.started=0;row.used=30;
 assert.equal((await quota.fetch(new Request("https://quota/reserve"))).status,429);
});
test("gateway denies invalid Firebase session without calling a provider",async()=>{
 const worker=(await import("../gateway/worker.mjs")).default, original=global.fetch;
 let calls=0;
 global.fetch=async()=>{calls++;return Response.json({error:{message:"INVALID_ID_TOKEN"}},{status:400});};
 try{
  const r=await worker.fetch(new Request("https://gateway",{method:"POST",headers:{Origin:"https://codecollab-rudra.web.app",Authorization:"Bearer invalid"},body:"{}"}),{...env,FIREBASE_WEB_API_KEY:"public-config",QUOTAS:{}},{});
  assert.equal(r.status,401);assert.equal(calls,1);
 }finally{global.fetch=original;}
});
test("gateway denies cross-project access before quotas or provider calls",async()=>{
 const worker=(await import("../gateway/worker.mjs")).default,original=global.fetch;
 const calls=[];global.fetch=async url=>{calls.push(url);return url.includes("accounts:lookup")?Response.json({users:[{localId:"user"}]}):new Response("",{status:403});};
 try{
  const r=await worker.fetch(new Request("https://gateway",{method:"POST",headers:{Origin:"https://codecollab-rudra.web.app",Authorization:"Bearer token"},body:JSON.stringify({project:"private-project",question:"x",context:""})}),{...env,FIREBASE_WEB_API_KEY:"public-config",QUOTAS:{}},{});
  assert.equal(r.status,403);assert.equal(calls.length,2);
 }finally{global.fetch=original;}
});
test("presence rechecks recipients and closes revoked peers",async()=>{
 const {PresenceRoom}=await import("../gateway/presence.mjs"),original=global.fetch;
 global.fetch=async(url,options)=>new Response("",{status:options.headers.Authorization==="Bearer revoked"?403:200});
 const messages=[],closed=[];
 const socket=id=>({send:m=>messages.push([id,JSON.parse(m)]),close:()=>closed.push(id)});
 const room=new PresenceRoom({},{});
 room.peers.set("a",{socket:socket("a"),uid:"a",token:"valid",project:"p",file:"f",client:1});
 room.peers.set("b",{socket:socket("b"),uid:"b",token:"revoked",project:"p",file:"f",client:2});
 try{await room.publish();assert.deepEqual(closed,["b"]);assert.equal(messages.length,1);assert.equal(messages[0][1].peers.length,1);}
 finally{global.fetch=original;}
});
test("partial provider output never falls through to a second provider",async()=>{
 const {generate}=await import("../gateway/providers.mjs");let calls=0;const received=[];
 await assert.rejects(generate(env,{question:"x",context:""},x=>received.push(x),new AbortController().signal,async(url,options)=>{
  if(url.endsWith("/models"))return providerFetch()(url,options);
  calls++;
  return stream('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: {"error":{"message":"upstream failed"}}\n\n');
 }),/stream failed/);
 assert.equal(calls,1);assert.equal(received[0].text,"partial");
});
test("configured fallback order is honored",async()=>{
 const {generate}=await import("../gateway/providers.mjs");const received=[];
 await generate({...env,AI_FALLBACK_ORDER:"gemini,groq"},{question:"x",context:""},x=>received.push(x),new AbortController().signal,providerFetch());
 assert.equal(received[0].provider,"gemini");
});
test("presence keeps the last cursor update inside the throttle window",async()=>{
 const {PresenceRoom}=await import("../gateway/presence.mjs");
 const originals={fetch:global.fetch,Response:global.Response,WebSocketPair:global.WebSocketPair};
 const handlers={};let broadcasts=0;
 const socket={accept(){},addEventListener(name,fn){handlers[name]=fn},send(message){if(JSON.parse(message).peers)broadcasts++},close(){}};
 global.WebSocketPair=class{constructor(){this[0]={};this[1]=socket;}};
 global.Response=class{constructor(body,options){this.status=options.status;}};
 global.fetch=async url=>url.includes("accounts:lookup")?originals.Response.json({users:[{localId:"user"}]}):new originals.Response("",{status:200});
 try{
  const room=new PresenceRoom({},{FIREBASE_WEB_API_KEY:"public-config"});
  await room.fetch(new Request("https://gateway/presence?project=p&file=f",{headers:{Upgrade:"websocket"}}));
  await handlers.message({data:JSON.stringify({token:"valid",project:"p",file:"f",client:1})});
  const selection={anchor:{index:7},head:{index:8}};
  await handlers.message({data:JSON.stringify({selection})});
  assert.deepEqual(room.peers.get(socket).selection,selection);
  const initial=broadcasts;
  await new Promise(resolve=>setTimeout(resolve,820));
  assert.ok(broadcasts>initial);
 }finally{
  handlers.close?.();
  global.fetch=originals.fetch;global.Response=originals.Response;global.WebSocketPair=originals.WebSocketPair;
 }
});
