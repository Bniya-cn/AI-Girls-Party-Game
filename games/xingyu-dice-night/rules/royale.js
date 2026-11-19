// Module hooks run on the reducer's private draft. Only the active seat gets its choices.
import { check } from './modules.js';
import { cardValue, strengths } from './payout.js';

export const boardVenue = (state, face) => state.config.modules.find(slot => slot.face === face)?.venue;
export const openVenue = (state, n) => Number.isInteger(n) && n >= 1 && n <= 6 && n !== state.game.boards?.closed;
export const liveVenues = state => [1,2,3,4,5,6].filter(n => openVenue(state,n));
export const option = (value,label) => ({key:String(value),label});
export const numberOptions = (values, suffix) => values.map(n=>option(n,n+suffix));
export const dieLabel = die => (die.big?'大骰':'小骰')+' '+(Number(die.id.split('-').at(-1))+1);
export const skip = option('skip','放弃');
export function takeDie(dice,id) {
  const index=dice.findIndex(d=>d.id===id);
  check(index>=0,'骰子已移走');
  return dice.splice(index,1)[0];
}
export function ask(s,face,step,seat,prompt,options,context={}) {
  check(options.length,'没有合法选择');
  s.phase='decision';
  s.game.pending={id:++s.game.serial,face,step,seat,prompt,options,context};
}
export function note(g,face,text,detail={}) {
  g.events.push({id:++g.serial,round:g.round,face,text,...detail});
}
export function reward(g,face,seat,units) {
  // One or two units are chip awards; higher amounts are paid in physical banknotes.
  if(!units)return;
  if(units<3){
    g.chips[seat]+=units;
    note(g,face,'领取 '+units+' 枚筹码',{seat,chips:units});
    return;
  }
  const best=Array(units+1).fill(null);
  best[0]=[];
  for(const card of [...g.bank].sort((a,b)=>a-b)) {
    const amount=cardValue(card)/10000;
    for(let sum=units;sum>=amount;sum--){
      const previous=best[sum-amount];
      if(previous && (!best[sum] || previous.length+1<best[sum].length))best[sum]=[...previous,card];
    }
  }
  const paid=best.findLastIndex(Boolean),cards=best[paid];
  g.bank=g.bank.filter(id=>!cards.includes(id));
  g.wallets[seat].push(...cards);
  note(g,face,'领取 '+paid+' 万'+(paid<units?'（银行短付 '+(units-paid)+' 万）':''),{seat,cash:paid*10000,cards});
}
export function beginBoards(s) {
  const g=s.game;
  g.boards={closed:null,gate:0,jackpot:3,high:null,lead:null,double:[],bar:[],nice:Array(6).fill(null),handicap:Array(9).fill(null)};
  g.events=[];g.pending=null;
  if(boardVenue(s,'F2')){
    g.venues.forEach((pile,i)=>{
      for(let j=0;j<(i<3?1:2);j++)pile.push({owner:'gray',big:false,id:'blank-'+i+'-'+j});
    });
  }
}
export function refreshLead(s) {
  const n=boardVenue(s,'D2'),b=s.game.boards;
  if(!n || b.lead===null)return;
  const leader=strengths(s.game.venues[n-1])[0];
  if(leader?.owner!==b.lead || leader.tied){
    note(s.game,'D2','失去独占领先，交还令牌',{seat:b.lead});b.lead=null;
  }
}
export function randomLayout(randomIndex) {
  const boards=[...'ABCDEFGH'];
  return [1,2,3].map(venue=>{
    const [board]=boards.splice(randomIndex(boards.length),1);
    return {venue,face:board+(1+randomIndex(2))};
  });
}
export const p0 = {
  D1:{enter(s,n,a){
    const occupied=s.game.venues.flatMap((dice,i)=>dice.some(d=>d.owner===a)?[i+1]:[]);
    note(s.game,'D1','占据 '+occupied.join('、')+' 号场地',{seat:a,venues:occupied});
    reward(s.game,'D1',a,occupied.length);
  }},
  A1:{enter(s,n,a){
    ask(s,'A1','hide',a,'秘密藏几枚？',numberOptions([1,2,3],' 枚'));
  },choose(s,p,key){
    const g=s.game;
    if(p.step==='hide'){
      ask(s,'A1','guess',(p.seat+1)%s.players.length,'对方已藏好，猜几枚？',numberOptions([1,2,3],' 枚'),{hidden:Number(key)});
    }else{
      const hidden=p.context.hidden;
      note(g,'A1','藏 '+hidden+' 枚，猜 '+key+' 枚',{seat:g.actor});
      if(hidden!==Number(key))reward(g,'A1',g.actor,[0,2,3,4][hidden]);
    }
  }}
};
