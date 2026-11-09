export {PresenceRoom} from "./presence.mjs";
import { configurations, catalog, generate } from "./providers.mjs";

function json(value,status=200,headers={}) {
  return Response.json(value,{status,headers});
}
export class Quota {
  constructor(state) {this.state=state;}
  async fetch(request) {
    const action=new URL(request.url).pathname;
    if(action==="/release"){await this.state.storage.put("active",0);return json({ok:true});}
    const allowed=await this.state.storage.transaction(async tx=>{
      const now=Date.now(),day=new Date().toISOString().slice(0,10);
      const row=await tx.get("quota")||{};
      if((await tx.get("active")||0)>now || (row.day===day&&row.used>=30) || now-(row.started||0)<5000)return false;
      await tx.put("quota",{day,used:row.day===day?row.used+1:1,started:now});
      await tx.put("active",now+65000);return true;
    });
    return json({ok:allowed},allowed?200:429);
  }
}
export default {
  async fetch(request,env,ctx) {
    const origin=request.headers.get("Origin");
    const allowed=(env.ALLOWED_ORIGINS||"https://codecollab-rudra.web.app").split(",").map(x=>x.trim());
    if(!origin||!allowed.includes(origin))return json({error:"Origin denied."},403);
    const headers={"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"};
    const url=new URL(request.url);
    if(url.pathname==="/presence"){
      if(!env.PRESENCE||!env.FIREBASE_WEB_API_KEY)return json({error:"Presence unavailable."},503,headers);
      const project=url.searchParams.get("project"),file=url.searchParams.get("file");
      if(![project,file].every(x=>/^[-\w]{1,128}$/.test(x||"")))return json({error:"Invalid room."},400,headers);
      return env.PRESENCE.get(env.PRESENCE.idFromName(project+"/"+file)).fetch(request);
    }
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    if(request.method!=="POST")return json({error:"Method denied."},405,headers);
    try {
      if(!env.FIREBASE_WEB_API_KEY || !env.QUOTAS || !configurations(env).length)return json({error:"AI gateway is unconfigured."},503,headers);
      const token=request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
      if(!token)return json({error:"Sign in."},401,headers);
      const auth=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
      const uid=(await auth.json()).users?.[0]?.localId;
      if(!auth.ok||!uid)return json({error:"Session expired."},401,headers);
      const reader=request.body?.getReader();let raw="",size=0;const decoder=new TextDecoder();
      if(!reader)return json({error:"Missing request."},400,headers);
      while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536){await reader.cancel();return json({error:"Request too large."},413,headers);}raw+=decoder.decode(part.value,{stream:true});}
      const data=JSON.parse(raw);
      if(!/^[-\w]{1,128}$/.test(data.project||""))return json({error:"Invalid project."},400,headers);
      const membership=await fetch("https://firestore.googleapis.com/v1/projects/codecollab-rudra/databases/(default)/documents/projects/"+data.project+"/members/"+uid,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
      if(!membership.ok)return json({error:"Project access denied."},403,headers);
      const quota=env.QUOTAS.get(env.QUOTAS.idFromName(uid+(data.action==="models"?":models":":ai")));
      if(!(await quota.fetch("https://quota/reserve")).ok)return json({error:"AI quota reached. Try later."},429,headers);
      if(data.action==="models"){
        await quota.fetch("https://quota/release");
        return json({providers:await catalog(env,AbortSignal.timeout(10000))},200,headers);
      }
      if(typeof data.question!=="string"||!data.question.trim()||data.question.length>2000||typeof data.context!=="string"||data.context.length>20000||
        (data.history!==undefined&&(!Array.isArray(data.history)||data.history.length>12||data.history.some(m=>!["user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>8000)))){
        await quota.fetch("https://quota/release");return json({error:"Invalid question or context."},400,headers);
      }
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55000);
      const abort=()=>controller.abort();request.signal.addEventListener("abort",abort,{once:true});
      const stream=new TransformStream(),writer=stream.writable.getWriter(),encoder=new TextEncoder();
      const send=value=>writer.write(encoder.encode("data: "+JSON.stringify(value)+"\n\n"));
      ctx.waitUntil((async()=>{
        try{await generate(env,data,send,controller.signal);await send({done:true});}
        catch{await send({error:controller.signal.aborted?"Request cancelled or timed out.":"AI provider unavailable. Try again."}).catch(()=>{});}
        finally{clearTimeout(timeout);controller.abort();request.signal.removeEventListener("abort",abort);await quota.fetch("https://quota/release").catch(()=>{});await writer.close().catch(()=>{});}
      })());
      return new Response(stream.readable,{headers:{...headers,"Content-Type":"text/event-stream","Cache-Control":"no-store"}});
    }catch{return json({error:"Request failed."},400,headers);}
  }
};
