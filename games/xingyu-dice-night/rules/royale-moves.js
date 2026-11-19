import { strengths } from './payout.js';
import { ask, dieLabel, liveVenues, note, numberOptions, openVenue, option, reward, skip, takeDie } from './royale.js';

function barTurn(s,a,offset){
  const g=s.game,b=g.boards;
  for(let i=offset;i<s.players.length;i++){
    const seat=(a+i)%s.players.length;
    if(g.hands[seat].length && b.bar.filter(d=>d.owner===seat).length<2){
      ask(s,'E2','surrender',seat,'选一颗手骰放入吧台',g.hands[seat].map(d=>option(d.id,dieLabel(d))),{offset:i});return;
    }
  }
  const returned=b.bar.filter(d=>d.owner===a && !d.extra);
  g.hands[a].push(...returned);b.bar=b.bar.filter(d=>d.owner!==a);
  note(g,'E2','从吧台收回 '+returned.length+' 颗骰',{seat:a});
}
export function handMoves(s,a){
  const g=s.game,options=[];
  for(const n of liveVenues(s)){
    for(const d of g.venues[n-1].filter(d=>d.owner===a && !d.extra))options.push(option('take/'+n+'/'+d.id,'收回 '+n+' 号的'+dieLabel(d)));
  }
  // Identical unrolled small dice are interchangeable. Offer one of each size.
  for(const d of distinctSizes(g.hands[a])){
    for(const n of liveVenues(s))options.push(option('put/'+n+'/'+d.id,dieLabel(d)+' 定面到 '+n+' 号'));
  }
  return options;
}
export function moveOwnDie(s,a,key,face){
  const g=s.game;
      const [action,num,id]=key.split('/'),n=Number(num),pile=g.venues[n-1];
      if(action==='take')g.hands[a].push(takeDie(pile,id));
      else pile.push({...takeDie(g.hands[a],id),face:n});
      note(g,face,action==='take'?'从 '+n+' 号收回骰':'定面至 '+n+' 号，跳过目的板效果',{seat:a});
}
function distinctSizes(dice){return [dice.find(d=>!d.big),dice.find(d=>d.big)].filter(Boolean);}
export function powerOptions(s,a){
  if(s.game.boards?.lead!==a)return [];
  return distinctSizes(s.game.hands[a]).flatMap(d=>liveVenues(s).map(n=>option(d.id+'/'+n,dieLabel(d)+' → '+n+'号')));
}
const slotAward=i=>i<2?1:i<5?3:0;
export const moves={
  E1:{enter(s,n,a){
    ask(s,'E1','gate',a,'封住另一场；保留现址不会推进奖励轨',numberOptions([1,2,3,4,5,6].filter(v=>v!==n),' 号'));
  },choose(s,p,key){
    const b=s.game.boards,n=Number(key);
    if(n===b.closed){note(s.game,'E1','维持原封场',{seat:p.seat});return;}
    b.closed=n;b.gate=(b.gate+1)%6;
    note(s.game,'E1','封住 '+n+' 号场地',{seat:p.seat});reward(s.game,'E1',p.seat,[0,2,0,3,0,1][b.gate]);
  }},
  E2:{enter(s,n,a){barTurn(s,a,1);},choose(s,p,key){
    s.game.boards.bar.push(takeDie(s.game.hands[p.seat],key));
    note(s.game,'E2','交一颗骰到吧台',{seat:p.seat});barTurn(s,s.game.actor,p.context.offset+1);
  }},
  F2:{enter(s,n,a){
    const sources=liveVenues(s).filter(n=>s.game.venues[n-1].some(d=>d.owner==='gray'));
    if(sources.length)ask(s,'F2','source',a,'从哪个场地取一颗灰骰？',[skip,...numberOptions(sources,' 号')]);
  },choose(s,p,key){
    if(key==='skip')return;
    const g=s.game,b=g.boards,a=p.seat;
    if(p.step==='source'){
      const slots=b.handicap.flatMap((d,i)=>{
        if(d || (!slotAward(i) && !handMoves(s,a).length))return [];
        const label=i<2?'1 筹码':i<5?'3 万':'移一颗己骰';
        return [option(i,(i+1)+' 格 · '+label)];
      });
      if(slots.length)ask(s,'F2','slot',a,'选择空奖励格',[skip,...slots],{n:Number(key)});
    }else if(p.step==='slot'){
      const pile=g.venues[p.context.n-1],i=Number(key);
      b.handicap[i]=takeDie(pile,pile.find(d=>d.owner==='gray').id);
      note(g,'F2','从 '+p.context.n+' 号取灰骰，占据第 '+(i+1)+' 格',{seat:a});
      if(slotAward(i))reward(g,'F2',a,slotAward(i));
      else ask(s,'F2','move',a,'定面投放或收回自己的骰',handMoves(s,a));
    }else{
      moveOwnDie(s,a,key,'F2');
    }
  }},
  H1:{enter(s,n,a){
    const g=s.game;
    const opts=g.roll.filter(d=>!g.boards.nice[d.face-1] || openVenue(s,d.face)).map(d=>option(d.id,dieLabel(d)+' → '+d.face+' 点槽'));
    if(opts.length)ask(s,'H1','nice',a,'选本次的一颗骰占位；旧骰回对应主场',[skip,...opts],{n});
  },choose(s,p,key){
    if(key==='skip')return;
    const g=s.game,n=p.context.n,rolled=g.roll.find(d=>d.id===key);
    const from=g.hands[p.seat].some(d=>d.id===key)?g.hands[p.seat]:g.venues[n-1];
    const d={...takeDie(from,key),face:rolled.face},i=d.face-1,old=g.boards.nice[i];
    if(old)g.venues[i].push(old);
    g.boards.nice[i]=d;note(g,'H1','占据 '+d.face+' 点槽'+(old?'，原骰回到主场':''),{seat:p.seat});
    const stamp=p.seat+'-'+i;
    if(!g.boards.nicePaid.includes(stamp)){g.boards.nicePaid.push(stamp);reward(g,'H1',p.seat,i+1);}
    else note(g,'H1','本轮你已领取这个点槽的奖励',{seat:p.seat});
  }},
  D2:{enter(s,n,a){
    const top=strengths(s.game.venues[n-1])[0];
    if(top?.owner===a && !top.tied && s.game.boards.lead!==a){
      s.game.boards.lead=a;note(s.game,'D2','取得独占领先令牌',{seat:a});
    }
  }}
};
