'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=__dirname,DATA=path.join(ROOT,'data','database.json'),PUB=path.join(ROOT,'public');
const PORT=Number(process.env.PORT||5000),MAX=1024*1024;
const uid=()=>crypto.randomBytes(12).toString('hex');
const db=fs.existsSync(DATA)?JSON.parse(fs.readFileSync(DATA,'utf8')):{users:{},sessions:{},projects:{}};
let saveQueue=Promise.resolve();function save(){const snap=JSON.stringify(db);saveQueue=saveQueue.then(async()=>{const temp=DATA+'.tmp';await fs.promises.writeFile(temp,snap);await fs.promises.rename(temp,DATA)}).catch(console.error);return saveQueue}
function hash(p,salt){return crypto.scryptSync(p,salt,64).toString('hex')}
function response(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))}
function err(res,status,message){response(res,status,{error:message})}
function json(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',b=>{size+=b.length;if(size>MAX){reject(new Error('Payload too large'));req.destroy()}else chunks.push(b)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString()||'{}'))}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)})}
function auth(req){const token=(req.headers.authorization||'').replace(/^Bearer /,'');const s=db.sessions[token];return s?{user:db.users[s],token}:null}
function summary(p,userId){return {id:p.id,name:p.name,language:p.language,updatedAt:p.updatedAt,role:p.owner===userId?'owner':p.members[userId],members:Object.keys(p.members).length+1}}
function access(p,id){return p&&(p.owner===id?'owner':p.members[id])}
function requireAuth(req,res){const a=auth(req);if(!a?.user){err(res,401,'Please sign in');return null}return a}
const streams=new Map();function emit(id,event,data){for(const res of streams.get(id)||[]){try{res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)}catch{}}}
const cleanName=v=>typeof v==='string'?v.trim().slice(0,90):'';
async function api(req,res,url){const parts=url.pathname.split('/').filter(Boolean),method=req.method;
if(url.pathname==='/api/health')return response(res,200,{ok:true,storage:'local-json',realtime:'SSE'});
if(url.pathname==='/api/auth/register'&&method==='POST'){const b=await json(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128||!cleanName(b.name))return err(res,400,'Enter name, valid email and password (8–128 characters)');if(Object.values(db.users).some(u=>u.email===email))return err(res,409,'Email already registered');const id=uid(),salt=uid();db.users[id]={id,name:cleanName(b.name),email,salt,passwordHash:hash(password,salt)};const token=uid()+uid();db.sessions[token]=id;await save();return response(res,201,{token,user:{id,name:db.users[id].name,email}})}
if(url.pathname==='/api/auth/login'&&method==='POST'){const b=await json(req),email=String(b.email||'').trim().toLowerCase(),u=Object.values(db.users).find(x=>x.email===email);if(!u||!crypto.timingSafeEqual(Buffer.from(u.passwordHash,'hex'),Buffer.from(hash(String(b.password||''),u.salt),'hex')))return err(res,401,'Invalid credentials');const token=uid()+uid();db.sessions[token]=u.id;await save();return response(res,200,{token,user:{id:u.id,name:u.name,email:u.email}})}
const a=requireAuth(req,res);if(!a)return;const id=a.user.id;
if(url.pathname==='/api/me'&&method==='GET')return response(res,200,{id,name:a.user.name,email:a.user.email});
if(url.pathname==='/api/auth/logout'&&method==='POST'){delete db.sessions[a.token];await save();return response(res,200,{ok:true})}
if(url.pathname==='/api/projects'&&method==='GET')return response(res,200,Object.values(db.projects).filter(p=>access(p,id)).map(p=>summary(p,id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
if(url.pathname==='/api/projects'&&method==='POST'){const b=await json(req),name=cleanName(b.name);if(!name)return err(res,400,'Project name required');const pid=uid(),now=new Date().toISOString();db.projects[pid]={id:pid,name,language:String(b.language||'javascript').slice(0,30),owner:id,members:{},files:{'main.js':'// Welcome to CodeCollab\nconsole.log("Hello, team!");\n','README.md':'# '+name+'\n'},chat:[],history:[],invites:{},updatedAt:now};await save();return response(res,201,summary(db.projects[pid],id))}
if(parts[1]==='invites'&&parts[2]&&parts[3]==='join'&&method==='POST'){const code=parts[2],p=Object.values(db.projects).find(p=>p.invites[code]&&p.invites[code].expires>Date.now());if(!p)return err(res,404,'Invite expired or invalid');if(p.owner!==id)p.members[id]=p.invites[code].role;await save();emit(p.id,'members',{});return response(res,200,{id:p.id})}
if(parts[1]!=='projects'||!parts[2])return err(res,404,'Unknown API route');const p=db.projects[parts[2]],role=access(p,id);if(!role)return err(res,404,'Project not found');const editor=role==='owner'||role==='editor',owner=role==='owner';
if(parts.length===3&&method==='GET')return response(res,200,{...summary(p,id),files:p.files,chat:p.chat.slice(-100),history:p.history.map(h=>({id:h.id,at:h.at,by:h.by})),members:[{id:p.owner,name:db.users[p.owner]?.name||'Owner',role:'owner'},...Object.entries(p.members).map(([id,role])=>({id,name:db.users[id]?.name||'User',role}))]});
if(parts.length===3&&method==='PATCH'){if(!owner)return err(res,403,'Owner only');const b=await json(req),name=cleanName(b.name);if(!name)return err(res,400,'Name required');p.name=name;p.updatedAt=new Date().toISOString();await save();emit(p.id,'project',{});return response(res,200,{ok:true})}
if(parts.length===3&&method==='DELETE'){if(!owner)return err(res,403,'Owner only');delete db.projects[p.id];await save();emit(p.id,'deleted',{});return response(res,200,{ok:true})}
if(parts[3]==='events'&&method==='GET'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});res.write(': connected\n\n');if(!streams.has(p.id))streams.set(p.id,new Set());streams.get(p.id).add(res);const ping=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},20000);req.on('close',()=>{clearInterval(ping);streams.get(p.id)?.delete(res)});return}
if(parts[3]==='files'&&method==='PUT'){if(!editor)return err(res,403,'Read-only access');const b=await json(req),filename=String(b.name||'');if(!/^[\w.\- ]{1,80}$/.test(filename)||filename==='.'||filename==='..')return err(res,400,'Invalid filename');if(typeof b.content!=='string'||b.content.length>200000)return err(res,400,'File too large');if(b.base!==undefined&&p.files[filename]!==undefined&&p.files[filename]!==b.base)return err(res,409,'File changed elsewhere. Reload before saving.');p.files[filename]=b.content;p.updatedAt=new Date().toISOString();await save();emit(p.id,'files',{by:id,filename});return response(res,200,{ok:true})}
if(parts[3]==='files'&&method==='DELETE'){if(!editor)return err(res,403,'Read-only access');const b=await json(req);if(!(b.name in p.files))return err(res,404,'File missing');delete p.files[b.name];p.updatedAt=new Date().toISOString();await save();emit(p.id,'files',{by:id});return response(res,200,{ok:true})}
if(parts[3]==='chat'&&method==='POST'){const b=await json(req),message=String(b.message||'').trim().slice(0,1500);if(!message)return err(res,400,'Message required');const m={id:uid(),by:a.user.name,message,at:new Date().toISOString()};p.chat.push(m);p.chat=p.chat.slice(-200);await save();emit(p.id,'chat',m);return response(res,201,m)}
if(parts[3]==='history'&&method==='POST'){if(!editor)return err(res,403,'Read-only access');const h={id:uid(),at:new Date().toISOString(),by:a.user.name,files:structuredClone(p.files)};p.history.unshift(h);p.history=p.history.slice(0,30);await save();return response(res,201,{id:h.id})}
if(parts[3]==='history'&&parts[4]&&method==='POST'){if(!owner)return err(res,403,'Owner only');const h=p.history.find(x=>x.id===parts[4]);if(!h)return err(res,404,'Snapshot missing');p.history.unshift({id:uid(),at:new Date().toISOString(),by:'Before restore',files:structuredClone(p.files)});p.files=structuredClone(h.files);p.updatedAt=new Date().toISOString();await save();emit(p.id,'files',{});return response(res,200,{ok:true})}
if(parts[3]==='invite'&&method==='POST'){if(!owner)return err(res,403,'Owner only');const b=await json(req),role=b.role==='viewer'?'viewer':'editor',code=uid();p.invites[code]={role,expires:Date.now()+7*86400000};await save();return response(res,201,{code,role,expires:p.invites[code].expires})}
if(parts[3]==='members'&&parts[4]&&method==='PATCH'){if(!owner)return err(res,403,'Owner only');if(!(parts[4] in p.members))return err(res,404,'Member not found');const b=await json(req);if(!['editor','viewer'].includes(b.role))return err(res,400,'Invalid role');p.members[parts[4]]=b.role;await save();emit(p.id,'members',{});return response(res,200,{ok:true})}
if(parts[3]==='members'&&parts[4]&&method==='DELETE'){if(!owner)return err(res,403,'Owner only');delete p.members[parts[4]];await save();emit(p.id,'members',{});return response(res,200,{ok:true})}
return err(res,404,'Unknown API route')}
const DIST=path.join(ROOT,'client','dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.wasm':'application/wasm','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-frame-options','DENY');
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    if(!['GET','HEAD'].includes(req.method))return err(res,405,'Method not allowed');
    let file;
    if(url.pathname==='/' && (url.searchParams.has('legacy')||url.searchParams.has('invite')))file=path.join(PUB,'legacy.html');
    else if(['/','/index.html'].includes(url.pathname))file=path.join(ROOT,'index.html');
    else if(url.pathname==='/public/index.html')file=path.join(PUB,'index.html');
    else if(url.pathname==='/local-entry.js')file=path.join(ROOT,'local-entry.js');
    else if(['/app.js','/style.css','/legacy.html'].includes(url.pathname))file=path.join(PUB,url.pathname.slice(1));
    else{
      const relative=decodeURIComponent(url.pathname).replace(/^\/(?:client\/dist\/)?/,'');
      file=path.resolve(DIST,relative);
      if(!file.startsWith(DIST+path.sep))return err(res,403,'Forbidden');
    }
    fs.readFile(file,(error,bytes)=>{
      if(error){res.writeHead(404);return res.end('File unavailable')}
      res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:bytes);
    });
  }catch(error){if(!res.headersSent)err(res,400,'Invalid request')}
});
if(require.main===module)server.listen(PORT,()=>console.log(`CodeCollab running at http://localhost:${PORT}`));
module.exports={server,db};


