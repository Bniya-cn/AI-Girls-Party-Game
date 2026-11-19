import { join, lobby, project, transition } from '../rules/engine.js';

export const computerSeat = 1;
export function practiceState(name, board, neutralFaces, deckOrder) {
  let state = join(lobby(name), '电脑对手');
  const config=Array.isArray(board)?{seats:2,mode:'custom',modules:board}:
    {seats:2,modules:board?[{face:'F1',venue:1}]:[]};
  state=transition(state,0,{kind:'configure',config});
  for(const player of state.players)state=transition(state,player.id,{kind:'ready',value:true});
  return transition(state,0,{kind:'start'},neutralFaces,deckOrder);
}
export const decider = state => state.game?.pending?.seat ?? state.game?.actor;
function pick(options,rand){return options[rand(options.length)];}
function decide(g,p,rand) {
  const opts=p.options;
  if(p.face==='A1')return pick(opts,rand);
  if(p.face==='B2'){
    const total=p.total;
    if(!total || (total>=6 && total<=8 && p.step==='predict' && p.progress>0))return opts[0];
    return opts.find(o=>o.key===(total<=7?'up':'down'));
  }
  if(p.face==='G2'){
    if(g.boards.double.some(d=>d.owner===p.seat))return opts[0];
    return opts.at(-1);
  }
  if(p.face==='F2' && p.step==='slot')return opts.find(o=>[2,3,4].includes(Number(o.key))) ?? opts.at(-1);
  if(p.face==='F2' && p.step==='move')return opts.find(o=>o.key.startsWith('put/')) ?? opts[0];
  if(p.face==='E2')return opts[0];
  if(p.face==='E1')return pick(opts,rand);
  return opts.at(-1);
}
// All strategy inputs, including secret mini-games, come from the seat-filtered projection.
export function seatAction(s,seat,rand) {
  const g=s.game;
  if(decider(s)!==seat)return null;
  if(s.phase==='decision'){
    const p=g.pending;
    return {kind:'decide',id:p.id,key:decide(g,p,rand).key};
  }
  if(s.phase==='roll'){
    if(g.power?.length && rand(2)===0)return {kind:'power',key:pick(g.power,rand).key};
    return {kind:'roll'};
  }
  const open=i=>i+1!==g.boards?.closed;
  if(s.phase==='select'){
    const counts=Array(6).fill(0);
    for(const d of g.roll)if(open(d.face-1))counts[d.face-1]++;
    return {kind:'place',face:counts.indexOf(Math.max(...counts))+1};
  }
  if(s.phase==='gray'){
    const group=g.groups.indexOf(Math.max(...g.groups));
    const occupancy=g.venues.map((dice,i)=>open(i)?dice.length:Infinity);
    return {kind:'gray',group,venue:occupancy.indexOf(Math.min(...occupancy))+1};
  }
  return null;
}
export function computerAction(state,rand=n=>Math.floor(Math.random()*n)) {
  return seatAction(project(state,computerSeat),computerSeat,rand);
}
