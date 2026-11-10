import {doc,runTransaction,serverTimestamp} from "firebase/firestore";
export async function changeProjectMember(db,uid,data){
 if(!data.target||data.target===uid)throw Error("Choose another project member.");
 return runTransaction(db,async tx=>{
  const member=doc(db,"projects",data.id,"members",data.target);
  const snapshot=await tx.get(member),value=snapshot.data();
  if(!value||value.role==="owner")throw Error("The project owner cannot be changed here.");
  const index=doc(db,"users",data.target,"projects",data.id);
  if(data.action==="remove"){
   const event=doc(db,"projects",data.id,"activity","removed_"+data.target+"_"+(value.invitation||"legacy"));
   tx.set(event,{action:"remove",uid,target:data.target,createdAt:serverTimestamp()});
   tx.delete(member);tx.delete(index);
  }else{
   if(!["admin","editor","viewer"].includes(data.role))throw Error("Invalid member role.");
   const audit=crypto.randomUUID();
   tx.set(doc(db,"projects",data.id,"activity",audit),{action:"role",uid,target:data.target,role:data.role,createdAt:serverTimestamp()});
   tx.update(member,{role:data.role,audit});
   tx.update(index,{role:data.role});
  }
  return {};
 });
}
