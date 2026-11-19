import { strengths } from './payout.js';
import { ask, dieLabel, note, openVenue, option, reward, skip, takeDie } from './royale.js';

const steps=[0,1,3,4,6];
function guess(s,a,index,dice){
  const sum=dice[0]+dice[1];
  ask(s,'B2','predict',a,'上次合计 '+sum+' · 当前可领 '+['零','1 筹码','3 万','4 万','6 万'][index],
    [option('stop','收手领取'),option('up','猜更高'),option('down','猜更低')],{sum,index});
}
function transfer(s,n,a){
  const mine=s.game.venues[n-1].filter(d=>d.owner===a && !d.extra);
  if(mine.length)ask(s,'G2','transfer',a,'移哪颗到副板？可继续移或结束',
    [option('done','完成'),...mine.map(d=>option(d.id,dieLabel(d)))],{n});
}
export const prizes={
  A2:{enter(s,n,a,pair){
    const g=s.game,d=pair(),b=g.boards;
    if(d[0]===d[1] || d[0]+d[1]===7){
      note(g,'A2','黑骰 '+d.join('＋')+'，命中奖池',{seat:a});
      reward(g,'A2',a,b.jackpot);b.jackpot=3;
    }else{
      b.jackpot=Math.min(8,b.jackpot+1);
      note(g,'A2','黑骰 '+d.join('＋')+'，奖池现为 '+b.jackpot+' 万',{seat:a});
    }
  }},
  B2:{enter(s,n,a,pair){
    const d=pair();note(s.game,'B2','起掷 '+d.join('＋'),{seat:a});guess(s,a,0,d);
  },choose(s,p,key,pair){
    const {sum,index}=p.context;
    if(key==='stop'){note(s.game,'B2','在第 '+(index+1)+' 格收手',{seat:p.seat});reward(s.game,'B2',p.seat,steps[index]);return;}
    const d=pair(),total=d[0]+d[1];
    const hit=key==='up'?total>sum:total<sum;
    note(s.game,'B2','猜'+(key==='up'?'高':'低')+'，掷出 '+d.join('＋')+(hit?'，前进一格':'，本次无奖'),{seat:p.seat});
    if(!hit)return;
    if(index+1===steps.length-1)reward(s.game,'B2',p.seat,steps.at(-1));
    else guess(s,p.seat,index+1,d);
  }},
  C1:{enter(s,n,a){
    if(s.game.boards.high===null && strengths(s.game.venues[n-1]).some(row=>row.owner===a && row.strength>=5)){
      s.game.boards.high=a;note(s.game,'C1','取得五星令牌',{seat:a});reward(s.game,'C1',a,10);
    }
  }},
  G2:{enter:transfer,choose(s,p,key){
    if(key==='done'){paySide(s,p.seat);return;}
    const {n}=p.context;
    const die=takeDie(s.game.venues[n-1],key);
    s.game.boards.double.push(die);note(s.game,'G2',dieLabel(die)+' 移至副板',{seat:p.seat});
    transfer(s,n,p.seat);
    if(!s.game.pending)paySide(s,p.seat);
  }},
  B1:{enter(s,n,winner,pair){
    const g=s.game;
    // Two reusable black dice. A die inside a sealed venue cannot be lifted.
    const locked=g.venues.flatMap((pile,i)=>openVenue(s,i+1)?[]:pile.filter(d=>d.extra).map(d=>d.id));
    const available=['black-0','black-1'].filter(id=>!locked.includes(id));
    if(!available.length){note(g,'B1','两颗支援骰都被封场锁住');return;}
    g.venues=g.venues.map(pile=>pile.filter(d=>!available.includes(d.id)));
    const dice=pair().slice(0,available.length),opts=[skip];
    for(let mask=1;mask<(1<<dice.length);mask++){
      const selected=dice.filter((_,i)=>mask & (1<<i));
      if(selected.every(face=>openVenue(s,face)))opts.push(option(mask,'投放 '+selected.map(n=>n+'号').join('、')));
    }
    note(s.game,'B1','即时支援骰 '+dice.join('、'),{seat:winner});
    ask(s,'B1','extra',winner,'选择要派往场地的支援骰 · '+dice.join('、'),opts,{dice,available});
  },choose(s,p,key){
    if(key==='skip')return;
    p.context.dice.forEach((face,i)=>{
      if(Number(key)&(1<<i))s.game.venues[face-1].push({id:p.context.available[i],owner:p.seat,face,big:false,extra:true});
    });
    note(s.game,'B1','额外骰已投放',{seat:p.seat});
  }}
};

function paySide(s,a){
  const b=s.game.boards,ranks=strengths(b.double).filter(r=>!r.tied);
  const rank=ranks.findIndex(r=>r.owner===a),award=[6,3][rank]??0;
  const delta=award-b.doublePaid[a];
  if(delta>0){
    b.doublePaid[a]=award;reward(s.game,'G2',a,delta);
  }else note(s.game,'G2','当前副板名次没有新增奖金',{seat:a});
}
