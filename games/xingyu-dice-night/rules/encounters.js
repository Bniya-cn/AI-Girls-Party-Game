import { cardValue } from './payout.js';
import { ask, dieLabel, note, openVenue, option, reward, takeDie } from './royale.js';
import { handMoves, moveOwnDie } from './royale-moves.js';

export const boxTokens=[6,2,2,0,0,0];
const bits=(mask)=>boxTokens.filter((_,i)=>mask & (1<<i));

// Find a physical set of banknotes for each reachable sum. Smallest transfer wins ties.
function billsFor(cards,limit){
  const matches=new Map([[0,[]]]);
  for(const id of [...cards].sort((a,b)=>a-b)){
    for(const [sum,ids] of [...matches]){
      const next=sum+cardValue(id)/10000;
      if(next<=limit && (!matches.has(next)||matches.get(next).length>ids.length+1))matches.set(next,[...ids,id]);
    }
  }
  return matches;
}
export function paymentOptions(g,seat){
  const wallet=g.wallets[seat],chips=g.chips[seat];
  const max=wallet.reduce((n,c)=>n+cardValue(c)/10000,0);
  const tender=billsFor(wallet,max),change=billsFor(g.bank,max+5);
  // No gratuitous exchanges. For each chip count retain the smallest cash tender at the highest payable amount.
  let best=-1;const options=new Map();
  for(let used=0;used<=Math.min(5,chips);used++){
    for(const [sum,paid] of tender){
      for(let net=5;net>=Math.max(best,used);net--){
        const back=change.get(sum+used-net);
        if(!back)continue;
        if(net>best){best=net;options.clear();}
        if(!options.has(used)||options.get(used).sum>sum)options.set(used,{sum,net,used,paid,back});
        break;
      }
    }
  }
  return [...options.values()].sort((a,b)=>(a.paid.length+a.back.length+a.used)-(b.paid.length+b.back.length+b.used));
}
function pay(g,seat,tx){
  const {paid,back,net,used,sum}=tx;
  g.wallets[seat]=g.wallets[seat].filter(c=>!paid.includes(c)).concat(back);
  g.bank=g.bank.filter(c=>!back.includes(c)).concat(paid);g.chips[seat]-=used;
  g.payments[seat].push({round:g.round,paid:[...paid],back:[...back],chips:used,net});
  note(g,'C2','实扣 '+net+' 万（纸币 '+sum+' 万、筹码 '+used+' 枚、找回 '+(sum+used-net)+' 万）',{seat,penalty:net*10000,chips:-used});
}
function penalties(s,seats){
  const g=s.game;
  while(seats.length){
    const [seat,...rest]=seats,options=paymentOptions(g,seat);
    if(options.length>1){
      ask(s,'C2','pay',seat,'失运警报 · 选一种付款方式',options.map((t,i)=>option(i,'纸币 '+t.sum+' 万 ＋ '+t.used+' 筹，找回 '+(t.sum+t.used-t.net)+' 万')),{options,rest});
      return;
    }
    pay(g,seat,options[0]);seats=rest;
  }
}
export const encounters={
  C2:{enter(s,n){
    const points=s.players.map(p=>s.game.venues[n-1].filter(d=>d.owner===p.id).reduce((v,d)=>v+(d.big?2:1),0));
    const low=Math.min(...points),seats=s.players.filter(p=>points[p.id]===low).map(p=>p.id);
    note(s.game,'C2','当前最低实力 '+low+' · '+seats.map(a=>s.players[a].name).join('、')+' 当场各付 5 万，余额不足按可付额');
    penalties(s,seats);
  },choose(s,p,key){pay(s.game,p.seat,p.context.options[Number(key)]);penalties(s,p.context.rest);}},
  G1:{enter(s,n,a){
    const opts=Array.from({length:62},(_,i)=>option(i+1,'左堆 '+bits(i+1).join('＋')+' 万'));
    ask(s,'G1','split',(a+1)%s.players.length,'把六枚奖片分到两个非空的盒子里',opts);
  },choose(s,p,key){
    if(p.step==='split'){
      const mask=Number(key),left=bits(mask).length;
      ask(s,'G1','box',s.game.actor,'只看数量，选一只盒子打开',[option('left','左盒 · '+left+' 枚'),option('right','右盒 · '+(6-left)+' 枚')],{mask});
    }else{
      const contents=bits(key==='left'?p.context.mask:63^p.context.mask);
      const total=contents.reduce((a,b)=>a+b,0);
      note(s.game,'G1',(key==='left'?'左盒':'右盒')+'揭晓 · '+contents.join('＋')+' 万'+(!total?'，空奖盒':''),{seat:p.seat});
      reward(s.game,'G1',p.seat,total);
    }
  }},
  H2:{enter(s,n,a,pair){
    const dice=pair();
    note(s.game,'H2','星签掷出 '+dice.join('、'),{seat:a});
    const labels=['','1 筹码','2 筹码','3 万','借用另一块板','移动自己的骰','占金框领 6 万'];
    ask(s,'H2','sign',a,'任选一枚星签',[...new Set(dice)].map(v=>option(v,v+' 点 · '+labels[v])));
  },choose(s,p,key,pair,activate){
    const g=s.game,a=p.seat,b=g.boards;
    if(p.step==='target'){activate(s,Number(key),pair,true);return;}
    if(p.step==='move'){moveOwnDie(s,a,key,'H2');return;}
    if(p.step==='gold'){
      const die=takeDie(g.hands[a],key);
      if(b.gold)g.hands[b.gold.owner].push(b.gold);
      b.gold=die;note(g,'H2','占据金框，旧骰归还原主',{seat:a});
      if(!b.goldPaid.includes(a)){b.goldPaid.push(a);reward(g,'H2',a,6);}
      return;
    }
    const v=Number(key);
    if(v<=3){reward(g,'H2',a,v);return;}
    let opts,step,prompt;
    if(v===4){
      opts=s.config.modules.filter(m=>m.face!=='H2' && openVenue(s,m.venue)).map(m=>option(m.venue,m.venue+'号 · '+m.face));
      step='target';prompt='发动哪块板？';
    }else if(v===5){
      opts=handMoves(s,a);step='move';prompt='选择改点投放或收回一颗己骰';
    }else{
      opts=g.hands[a].map(d=>option(d.id,dieLabel(d)));step='gold';prompt='放一颗余骰到金框';
    }
    if(opts.length)ask(s,'H2',step,a,prompt,opts);
    else note(g,'H2','这枚星签没有可用目标',{seat:a});
  }}
};
