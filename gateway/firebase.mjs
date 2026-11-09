export async function identity(env, token) {
  if(typeof token!=="string"||token.length>8192)throw Error("Invalid identity.");
  const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)});
  const uid=(await response.json()).users?.[0]?.localId;
  if(!response.ok||!uid)throw Error("Session expired.");
  return uid;
}
export async function documentAccess(token,path) {
  return (await fetch("https://firestore.googleapis.com/v1/projects/codecollab-rudra/databases/(default)/documents/"+path,{
    headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)})).ok;
}
