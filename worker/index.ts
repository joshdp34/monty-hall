import {applyAction,emptyCounts,newRound,publicGame,type Game} from '../lib/game';
import {findSession,gameFromRow,insertGame,listSessions,updateGame} from './storage';
type Env={DB:D1Database};
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Cache-Control':'no-store'};
function json(data:unknown,status=200){return Response.json(data,{status,headers})}
async function hash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('')}
function token(req:Request){const t=req.headers.get('authorization')?.replace(/^Bearer /,'');return t&&/^[a-f0-9-]{36}$/.test(t)?t:null}
async function own(db:D1Database,req:Request,id:string){const t=token(req);if(!t)return null;const row=await findSession(db,id);return row&&row.token_hash===await hash(t)?row:null}
export async function handleRequest(req:Request,env:Env):Promise<Response>{
 if(new URL(req.url).pathname!=='/api/sessions')return json({error:'Not found.'},404);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
 if(req.method==='GET'){
  const id=new URL(req.url).searchParams.get('id');if(id){const row=await own(env.DB,req,id);return row?json(publicGame(gameFromRow(row))):json({error:'Session not found or session key is incorrect.'},404)}
  return json({schemaVersion:2,storage:'Cloudflare D1',exportedAt:new Date().toISOString(),notes:'All sessions are read from the database. Historical starting points were inferred from the supplied final bank. Positive loss points are deducted. Active sessions include completed rounds only.',sessions:await listSessions(env.DB)});
 }
 if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 const t=token(req);if(!t)return json({error:'A valid session key is required.'},401);
 if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request is too large.'},413);
 const text=await req.text();if(text.length>8192)return json({error:'Request is too large.'},413);
 let b:any;try{b=JSON.parse(text)}catch{return json({error:'Invalid JSON.'},400)}
 if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||typeof b.mutationId!=='string'||!b.mutationId||b.mutationId.length>80)return json({error:'Invalid session request.'},400);
 if(b.action==='create'){
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100)return json({error:'Enter a session name of 1–100 characters.'},400);
  for(const k of ['startingPoints','pointsForWin','pointsForLoss'])if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>1000000000)return json({error:'Points must be whole numbers from 0 to 1,000,000,000.'},400);
  const game:Game={session:{...emptyCounts,id:b.id,name:b.name.trim(),startingPoints:b.startingPoints,pointsForWin:b.pointsForWin,pointsForLoss:b.pointsForLoss,finalPoints:b.startingPoints,status:'active',source:'live',createdAt:new Date().toISOString()},round:newRound(),version:0,lastMutationId:b.mutationId};
  await insertGame(env.DB,game,await hash(t));const row=await own(env.DB,req,b.id);return row?json(publicGame(gameFromRow(row))):json({error:'Session ID is already in use.'},409);
 }
 const row=await own(env.DB,req,b.id);if(!row)return json({error:'Session not found or session key is incorrect.'},404);
 const game=gameFromRow(row);if(game.lastMutationId===b.mutationId)return json(publicGame(game));
 if(b.version!==game.version)return json({error:'This session changed in another tab. Refresh to continue.'},409);
 let next:Game;try{next=applyAction(game,b.action,b.door)}catch(error){return json({error:(error as Error).message},400)}
 next.lastMutationId=b.mutationId;
 const result=await updateGame(env.DB,next,String(row.token_hash),game.version);
 if(!result.meta.changes)return json({error:'Another action completed first. Refresh to continue.'},409);
 return json(publicGame(next));
 }catch(error){console.error('Database request failed',error);return json({error:req.method==='GET'?'Unable to load shared results. Please retry.':'Unable to save this action. Retry to continue without counting it twice.'},503)}
}
export default {fetch:handleRequest};
