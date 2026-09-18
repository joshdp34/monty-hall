export type Counts = {stayLoss:number;stayWin:number;switchLoss:number;switchWin:number};
export type Session = Counts & {id:string;name:string;pointsForWin:number;pointsForLoss:number;startingPoints:number;finalPoints:number;status:'active'|'ended';source:string;createdAt?:string;endedAt?:string;startingPointsSource?:string};
export type Round = {prize:number;picked:number|null;opened:number|null;phase:'pick'|'decide'|'reveal';decision?:'stay'|'switch';finalDoor?:number;won?:boolean};
export type Game = {session:Session;round:Round;version:number;lastMutationId:string};
export const emptyCounts:Counts={stayLoss:0,stayWin:0,switchLoss:0,switchWin:0};
export function randomIndex(n:number){const a=new Uint32Array(1);const limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n}
export function newRound():Round{return {prize:randomIndex(3),picked:null,opened:null,phase:'pick'}}
export function totals(s:Counts){const stay=s.stayLoss+s.stayWin,switches=s.switchLoss+s.switchWin;return {stay,switches,wins:s.stayWin+s.switchWin,losses:s.stayLoss+s.switchLoss,total:stay+switches}}
export function probabilities(s:Counts){const t=totals(s);const ratio=(a:number,b:number)=>b?a/b:null;return {winGivenStay:ratio(s.stayWin,t.stay),winGivenSwitch:ratio(s.switchWin,t.switches),stay:ratio(t.stay,t.total),switch:ratio(t.switches,t.total),win:ratio(t.wins,t.total)}}
export function aggregate(sessions:Session[]):Counts{return sessions.reduce((a,s)=>({stayLoss:a.stayLoss+s.stayLoss,stayWin:a.stayWin+s.stayWin,switchLoss:a.switchLoss+s.switchLoss,switchWin:a.switchWin+s.switchWin}),{...emptyCounts})}
export function applyAction(game:Game,action:string,door?:number):Game{
 const g=structuredClone(game),s=g.session,r=g.round;
 if(s.status!=='active')throw new Error('This session has ended.');
 if(action==='choose'){if(r.phase!=='pick'||!Number.isInteger(door)||door!<0||door!>2)throw new Error('Choose one of the three closed doors.');r.picked=door!;const eligible=[0,1,2].filter(d=>d!==r.prize&&d!==door);r.opened=eligible[randomIndex(eligible.length)];r.phase='decide';}
 else if(action==='stay'||action==='switch'){if(r.phase!=='decide')throw new Error('Choose a door first.');r.decision=action;r.finalDoor=action==='stay'?r.picked!:[0,1,2].find(d=>d!==r.picked&&d!==r.opened)!;r.won=r.finalDoor===r.prize;r.phase='reveal';const key=(action+(r.won?'Win':'Loss')) as keyof Counts;s[key]++;s.finalPoints=s.startingPoints+(s.stayWin+s.switchWin)*s.pointsForWin-(s.stayLoss+s.switchLoss)*s.pointsForLoss;}
 else if(action==='next'){if(r.phase!=='reveal')throw new Error('Finish this round first.');g.round=newRound();}
 else if(action==='end'){s.status='ended';s.endedAt=new Date().toISOString();}
 else throw new Error('Unknown game action.');
 g.version++;return g;
}
export function publicGame(g:Game){const {prize,...round}=g.round;return {...g,lastMutationId:undefined,round:{...round,...(g.round.phase==='reveal'?{prize}:{})}}}

