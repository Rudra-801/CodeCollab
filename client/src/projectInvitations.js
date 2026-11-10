import {collection,doc,runTransaction,setDoc,serverTimestamp,Timestamp} from "firebase/firestore";
async function invitationId(code) {
  if(!/^ccp_[a-f0-9]{64}$/.test(code))throw Error("Invalid project invitation.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function projectInvitation(db,uid,data){
  if(data.action==="invite"){
    if(!["editor","viewer"].includes(data.role))throw Error("Choose Editor or Viewer.");
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const code="ccp_"+[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
    await setDoc(doc(db,"projectInvitations",await invitationId(code)),{
      project:data.id,role:data.role,createdBy:uid,createdAt:serverTimestamp(),
      expiresAt:Timestamp.fromMillis(Date.now()+86400000),revoked:false,usedBy:""
    });
    return {code};
  }
  const ref=doc(db,"projectInvitations",await invitationId(data.code));
  return runTransaction(db,async transaction=>{
    const snap=await transaction.get(ref),invite=snap.data();
    if(!invite)throw Error("Invitation is unavailable.");
    if(data.action==="revoke"){transaction.update(ref,{revoked:true});return {};}
    if(invite.revoked||invite.usedBy||invite.expiresAt.toMillis()<=Date.now())throw Error("Invitation is expired, revoked or already used.");
    transaction.update(ref,{usedBy:uid,redeemedAt:serverTimestamp()});
    transaction.set(doc(db,"projects",invite.project,"members",uid),{uid,role:invite.role,invitation:ref.id});
    transaction.set(doc(db,"users",uid,"projects",invite.project),{id:invite.project,role:invite.role,invitation:ref.id});
    return {id:invite.project,kind:"projects"};
  });
}
