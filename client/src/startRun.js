const recent=[];
let current;
export function startRun(source,input,language){
 if(current)throw Error("Another program is running in this tab.");
 if(source.length>65536||input.length>8192)throw Error("Source or input exceeds the runtime limit.");
 const now=Date.now();
 while(recent.length&&recent[0]<=now-60000)recent.shift();
 if(recent.length>=30)throw Error("30 runs per minute reached. Try again shortly.");
 recent.push(now);
 const worker=new Worker(new URL("./browserRunner.worker.js",import.meta.url),{type:"module"});
 let finish;
 const result=new Promise(resolve=>{finish=value=>{if(current!==worker)return;clearTimeout(timer);worker.terminate();current=null;resolve(value)}});
 current=worker;
 const timer=setTimeout(()=>finish({stderr:"Worker deadline exceeded.",exitCode:124}),15000);
 worker.onmessage=e=>finish(e.data);
 worker.onerror=()=>finish({stderr:"Runtime failed to load.",exitCode:1});
 worker.postMessage({source,input,language});
 return {result,cancel:()=>finish({stderr:"Cancelled",exitCode:130})};
}
