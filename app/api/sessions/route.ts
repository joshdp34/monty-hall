import historical from '../../../public/sessions.json';
import {database} from '@/lib/db';
import {applyAction,emptyCounts,newRound,publicGame,type Game} from '@/lib/game';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Cache-Control':'no-store'};
function json(data:unknown,status=200){return Response.json(data,{status,headers})}
export async function OPTIONS(){return new Response(null,{status:204,headers})}
async function hash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('')}
function token(req:Request){const t=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!t||!/^[a-f0-9-]{36}$/.test(t))throw new Error('A valid session key is required.');return t}
type Row={id:string;token_hash:string;data:string;version:number};
async function own(req:Request,id:string){const row=await database().prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<Row>();if(!row||row.token_hash!==await hash(token(req)))return null;return row}
export async function GET(req:Request){try{
 const id=new URL(req.url).searchParams.get('id');
 if(id){const row=await own(req,id);return row?json(publicGame(JSON.parse(row.data))):json({error:'Session not found or session key is incorrect.'},404)}
 const rows=await database().prepare('SELECT data FROM sessions ORDER BY rowid DESC').all<{data:string}>();
 return json({schemaVersion:1,exportedAt:new Date().toISOString(),notes:'Historical starting points were inferred from the supplied final bank. Positive pointsForLoss values are deducted. Active sessions include completed rounds only.',sessions:[...rows.results.map(row=>(JSON.parse(row.data) as Game).session),...historical.sessions]});
 }catch(error){console.error(error);return json({error:'Unable to load shared results. Please retry.'},503)}}
export async function POST(req:Request){try{
 if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Request is too large.'},413);
 const bodyText=await req.text();if(bodyText.length>8192)return json({error:'Request is too large.'},413);
 let b:any;try{b=JSON.parse(bodyText)}catch{return json({error:'Invalid JSON.'},400)}
 if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||typeof b.mutationId!=='string'||b.mutationId.length>80)return json({error:'Invalid session request.'},400);
 const t=token(req);
 if(b.action==='create'){
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>100)return json({error:'Enter a session name of 1–100 characters.'},400);
  for(const k of ['startingPoints','pointsForWin','pointsForLoss'])if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>1000000000)return json({error:'Points must be whole numbers from 0 to 1,000,000,000.'},400);
  const game:Game={session:{...emptyCounts,id:b.id,name:b.name.trim(),startingPoints:b.startingPoints,pointsForWin:b.pointsForWin,pointsForLoss:b.pointsForLoss,finalPoints:b.startingPoints,status:'active',source:'live',createdAt:new Date().toISOString()},round:newRound(),version:0,lastMutationId:b.mutationId};
  await database().prepare('INSERT OR IGNORE INTO sessions (id, token_hash, data, version) VALUES (?, ?, ?, ?)').bind(b.id,await hash(t),JSON.stringify(game),0).run();
  const row=await own(req,b.id);return row?json(publicGame(JSON.parse(row.data))):json({error:'Session ID is already in use.'},409);
 }
 const row=await own(req,b.id);if(!row)return json({error:'Session not found or session key is incorrect.'},404);
 const game:Game=JSON.parse(row.data);if(game.lastMutationId===b.mutationId)return json(publicGame(game));
 if(b.version!==row.version)return json({error:'This session changed in another tab. Refresh to continue.'},409);
 let next:Game;try{next=applyAction(game,b.action,b.door)}catch(error){return json({error:(error as Error).message},400)}
 next.lastMutationId=b.mutationId;
 const result=await database().prepare('UPDATE sessions SET data = ?, version = ? WHERE id = ? AND version = ?').bind(JSON.stringify(next),next.version,b.id,row.version).run();
 if(!result.meta.changes)return json({error:'Another action completed first. Refresh to continue.'},409);
 return json(publicGame(next));
 }catch(error){console.error(error);return json({error:'Unable to save this action. Retry to continue without counting it twice.'},503)}}

