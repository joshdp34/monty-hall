// Compatibility endpoint for the original Sites URL. All records live in the
// user's Cloudflare D1 database behind this Worker; no local JSON is loaded.
const API='https://monty-hall-api.joshua-patrick-d6b.workers.dev/api/sessions';
async function proxy(request:Request){
 try {
  const headers=new Headers();
  for(const name of ['authorization','content-type']){const value=request.headers.get(name);if(value)headers.set(name,value)}
  return await fetch(API+new URL(request.url).search,{method:request.method,headers,body:request.method==='POST'?await request.arrayBuffer():undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
 }catch{return Response.json({error:'The shared database is temporarily unavailable. Please retry.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}})}
}
export const GET=proxy;
export const POST=proxy;
export const OPTIONS=proxy;
