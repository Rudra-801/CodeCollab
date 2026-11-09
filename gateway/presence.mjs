import { identity, documentAccess } from "./firebase.mjs";

export class PresenceRoom {
  constructor(state, env) {this.env=env;this.peers=new Map();}
  async fetch(request) {
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return new Response("WebSocket required",{status:426});
    if(this.peers.size>=12)return new Response("Room capacity reached",{status:429});
    const url=new URL(request.url),project=url.searchParams.get("project"),file=url.searchParams.get("file");
    const pair=new WebSocketPair(),socket=pair[1];
    socket.accept();
    const peer={socket,project,file,uid:null,token:null,client:null,selection:null,last:0,busy:false};
    this.peers.set(socket,peer);
    const deadline=setTimeout(()=>{if(!peer.uid)socket.close(1008,"Authentication required")},8000);
    const lifetime=setTimeout(()=>socket.close(1000,"Reconnect to renew session"),300000);
    const close=()=>{
      clearTimeout(deadline);clearTimeout(lifetime);
      if(this.peers.delete(socket))this.publish().catch(()=>{});
    };
    socket.addEventListener("close",close);socket.addEventListener("error",close);
    socket.addEventListener("message",async event=>{
      if(peer.busy)return;
      peer.busy=true;
      try{
        if(typeof event.data!=="string"||event.data.length>12000)throw Error();
        const data=JSON.parse(event.data);
        if(!peer.uid){
          if(data.project!==project||data.file!==file||!Number.isSafeInteger(data.client)||data.client<0||data.client>0xffffffff)throw Error();
          peer.uid=await identity(this.env,data.token);peer.token=data.token;peer.client=data.client;
          if(!await this.allowed(peer))throw Error();
          clearTimeout(deadline);socket.send(JSON.stringify({ready:true}));
        }else{
          if(Date.now()-peer.last<750)return;
          const selection=data.selection;
          if(selection!=null&&(!selection.anchor||!selection.head||JSON.stringify(selection).length>1500))throw Error();
          peer.selection=selection||null;
        }
        peer.last=Date.now();await this.publish();
      }catch{socket.close(1008,"Session or access expired");close();}
      finally{peer.busy=false;}
    });
    return new Response(null,{status:101,webSocket:pair[0]});
  }
  async allowed(peer) {
    return peer.uid&&await documentAccess(peer.token,"projects/"+peer.project+"/members/"+encodeURIComponent(peer.uid))&&
      await documentAccess(peer.token,"projects/"+peer.project+"/files/"+peer.file);
  }
  async publish() {
    // Revalidate every recipient before sending any presence data.
    const active=[];
    for(const peer of [...this.peers.values()]){
      if(!peer.uid)continue;
      if(!await this.allowed(peer)){peer.socket.close(1008,"Access revoked");this.peers.delete(peer.socket);continue;}
      active.push(peer);
    }
    const message=JSON.stringify({peers:active.map(({uid,client,selection})=>({uid,client,selection}))});
    for(const peer of active)try{peer.socket.send(message)}catch{this.peers.delete(peer.socket)}
  }
}
