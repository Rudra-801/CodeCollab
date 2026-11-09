const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function load(name, modules, extras = {}) {
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../functions", name), "utf8"), {
    exports, Buffer, process: {env: {E2B_API_KEY:"contract-test", E2B_TEMPLATE:"test", GEMINI_API_KEY:"contract-test", GEMINI_MODEL:"test"}},
    Date, AbortSignal, ...extras,
    require(id) {
      if (!(id in modules)) throw Error("Unexpected dependency " + id);
      return modules[id];
    }
  }, {filename:name});
  return exports;
}
function failure(code, message) {throw Object.assign(Error(message), {code});}
function runnerFixture(options = {}) {
  const row = {}, writes = [], commands = [];
  let killed = 0, created = 0;
  const db = {
    doc: () => ({}),
    runTransaction: async fn => fn({
      get: async () => ({get:key => row[key]}),
      update: (_, fields) => Object.assign(row, fields)
    })
  };
  const handler = load("runner.js", {
    "firebase-functions/v2/https":{onCall:(_,fn)=>fn},
    "firebase-admin/auth":{},
    "firebase-admin/firestore":{getFirestore:()=>db},
    "./toolAccess":{
      authorize:async()=>{if(options.denied)failure("permission-denied","Denied");return "user";},
      reserve:async(_,job)=>Object.assign(row,{job,until:1,cancelled:false}),
      fail:failure
    },
    e2b:{Sandbox:{
      kill:async()=>{killed++;},
      create:async(template,config)=>{
        created++;
        assert.equal(template,"test");
        assert.equal(config.allowInternetAccess,false);
        assert.equal(config.network.allowPublicTraffic,false);
        if(options.cancelOnCreate)row.cancelled=true;
        return {sandboxId:"sandbox-test",kill:async()=>{killed++;},
          files:{write:async(file,content,config)=>{assert.equal(config.user,"user");writes.push([file,content]);}},
          commands:{run:async(command,config)=>{
            commands.push(command);assert.equal(config.user,"user");
            if(options.providerFailure)throw Error("Provider failure");
            return {stdout:command.startsWith("head") ? (command.includes("stdout") ? (options.largeOutput ? "x".repeat(40000) : "actual output\n") : "") : (options.exit ?? "0")};
          }}
        };
      }
    }}
  }).runner;
  return {handler,row,writes,commands,counts:()=>({killed,created})};
}
const job = "contract-job-00000001";
for (const [language,filename,compiler] of [
  ["python","main.py","python3"],["javascript","main.js","node"],["typescript","main.ts","tsc"],
  ["java","Main.java","javac"],["c","main.c","gcc"],["cpp","main.cpp","g++"],
  ["csharp","Main.cs","mcs"],["go","main.go","go run"],["rust","main.rs","rustc"],
  ["php","main.php","php"],["ruby","main.rb","ruby"]
]) {
  test("mock runner contract: "+language, async()=>{
    const f=runnerFixture();
    const result=await f.handler({data:{source:"test source",stdin:"42",language,job}});
    assert.equal(result.exitCode,0);
    assert.equal(result.stdout,"actual output\n");
    assert.ok(f.writes.some(([p,s])=>p==="/home/user/"+filename&&s==="test source"));
    assert.ok(f.writes.some(([p,s])=>p.endsWith("/stdin.txt")&&s==="42"));
    assert.ok(f.commands[0].includes(compiler));
    assert.ok(f.commands[0].includes("timeout -k 1 20"));
    assert.equal(f.row.until,0);
    assert.equal(f.counts().killed,1);
  });
}
for(const [label,options,code] of [
  ["revocation before sandbox creation",{denied:true},"permission-denied"],
  ["cancellation during startup",{cancelOnCreate:true},"cancelled"],
  ["malformed provider result",{exit:"NaN"},"internal"],
  ["provider failure",{providerFailure:true},undefined]
]){
  test("mock runner cleanup: "+label,async()=>{
    const f=runnerFixture(options);
    await assert.rejects(f.handler({data:{source:"x",language:"python",job}}),error=>code?error.code===code:error.message==="Provider failure");
    if(options.denied)assert.equal(f.counts().created,0);
    else {assert.equal(f.counts().killed,1);assert.equal(f.row.until,0);}
  });
}
test("mock runner rejects unknown actions before allocating sandbox",async()=>{
  const f=runnerFixture();
  await assert.rejects(f.handler({data:{job,action:"shell"}}),e=>e.code==="invalid-argument");
  assert.equal(f.counts().created,0);
});
for(const ok of [true,false]){
  test("mock AI contract: "+(ok?"response":"provider error"),async()=>{
    let released=false;
    const handler=load("assistant.js",{
      "firebase-functions/v2/https":{onCall:(_,fn)=>fn},
      "firebase-admin/firestore":{getFirestore:()=>({doc:()=>({update:async()=>{released=true;}})})},
      "node:crypto":require("node:crypto"),
      "./toolAccess":{authorize:async()=>"user",reserve:async()=>{},fail:failure}
    },{fetch:async(url,request)=>{
      assert.ok(url.includes("models/test:generateContent"));
      const body=JSON.parse(request.body);
      assert.ok(body.systemInstruction.parts[0].text.includes("untrusted"));
      assert.equal(body.contents[0].parts[1].text,"Selected project context:\ncode");
      return {ok,json:async()=>({candidates:[{content:{parts:[{text:"Suggestion"}]}}]})};
    }}).assistant;
    if(ok)assert.equal((await handler({data:{context:"code",question:"Explain"}})).answer,"Suggestion");
    else await assert.rejects(handler({data:{context:"code",question:"Explain"}}),e=>e.code==="unavailable");
    assert.equal(released,true);
  });
}


test("mock runner bounds provider output before returning to the browser",async()=>{
  const f=runnerFixture({largeOutput:true});
  const result=await f.handler({data:{source:"x",language:"python",job}});
  assert.equal(result.stdout.length,32768);
  assert.equal(f.counts().killed,1);
});
