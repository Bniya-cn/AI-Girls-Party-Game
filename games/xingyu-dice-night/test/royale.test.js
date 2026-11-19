import test from 'node:test';
import assert from 'node:assert/strict';
import { project,transition } from '../rules/engine.js';
import { faces } from '../rules/modules.js';
import { shuffledDeck } from '../rules/payout.js';
import { randomLayout } from '../rules/royale.js';
import { practiceState,seatAction,decider } from '../server/practice.js';

function rng(seed){return n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};}
const setup=(...ids)=>practiceState('星客',ids.map((face,i)=>({face,venue:i+1})),Array(8).fill(6),shuffledDeck(rng(4)));
const go=(s,cmd,regular=[],extra=[2,5,3,6])=>transition(s,decider(s)??0,cmd,regular,undefined,extra);
const choose=(s,key,extra)=>go(s,{kind:'decide',id:s.game.pending.id,key:String(key)},[],extra);
function land(s,n,roll,extra){
  return go(go(s,{kind:'roll'},roll??Array(s.game.hands[s.game.actor].length).fill(n)),{kind:'place',face:n},[],extra);
}
function conserve(s){
  const g=s.game,cards=[...g.deck,...g.discards,...g.wallets.flat(),...g.prizes.flat(),...g.bank];
  assert.equal(cards.length,90);assert.equal(new Set(cards).size,90);
  const dice=[...g.hands.flat(),...g.venues.flat(),...g.boards.double,...g.boards.nice.filter(Boolean),...g.boards.bar,...g.boards.handicap.filter(Boolean)];
  assert.equal(new Set(dice.map(d=>d.id)).size,dice.length);
  for(const owner of [0,1])assert.equal(dice.filter(d=>d.owner===owner&&!d.extra).length,8);
}
test('A1 both seats conceal independently, restores pending choices; D1 pays by occupied venues',()=>{
  let s=setup('A1','D1','F1');assert.deepEqual([s.game.prizes.flat().length,s.game.deck.length,s.game.bank.length],[12,24,54]);
  s=land(s,1,[1,2,2,2,2,2,2,2]);const hidden=choose(s,'2'),alternate=choose(s,'3');
  assert.deepEqual(project(hidden,1),project(alternate,1));assert.equal(project(hidden,0).game.pending.committed,2);
  assert.deepEqual(project(hidden,1),project(structuredClone(hidden),1));
  assert.throws(()=>transition(hidden,0,{kind:'decide',id:hidden.game.pending.id,key:'2'}));
  s=choose(hidden,'1');assert.equal(s.game.events.at(-1).cash,30000);conserve(s);
  assert.throws(()=>go(s,{kind:'decide',id:hidden.game.pending.id,key:'1'}));
  s=land(s,1,[1,2,2,2,2,2,2,2]);s=choose(s,'1');assert.equal(decider(s),0);
  s=choose(s,'1');s=land(s,2);assert.equal(s.game.chips[0],4);
});
test('A2 caps and resets, B2 ties lose and stopping pays the right asset',()=>{
  let s=setup('A2','B2');s.game.boards.jackpot=8;
  s=land(s,1,[1,2,2,2,2,2,2,2],[2,6]);assert.equal(s.game.boards.jackpot,8);
  s=land(s,1,[1,2,2,2,2,2,2,2],[4,4]);assert.equal(s.game.boards.jackpot,3);assert.equal(s.game.events.at(-1).cash,80000);
  s=land(s,2,undefined,[2,5]);const tied=choose(s,'up',[3,4]);assert.equal(tied.game.chips[0],2);
  s=choose(s,'up',[5,5]);s=choose(s,'stop');assert.equal(s.game.chips[0],3);
});
test('C1 crosses five; G2 moves old dice once; B1 can place a single matching extra die',()=>{
  let s=setup('C1','G2','B1');
  s=land(s,1,[1,1,1,2,2,2,2,1]);assert.equal(s.game.boards.high,0);
  s=land(s,2,[2,3,3,3,3,3,3,2]);s=choose(s,'1-7');s=choose(s,'done');
  assert.equal(s.game.boards.double[0].big,true);assert.equal(s.game.venues[1].length,1);
  s=land(s,3);s=land(s,5,undefined,[4,4]);assert.equal(s.game.pending.face,'B1');
  s=choose(s,'1');assert.equal(s.phase,'between');assert.equal(s.game.venues[3].filter(d=>d.extra).length,1);
  assert.deepEqual(s.game.events.filter(e=>e.cash).map(e=>e.face),['C1','G2']);conserve(s);
});
test('F1 removes D2 lead; E1 rejects closed gray destinations; D2 can trigger A2',()=>{
  let s=setup('D2','F1','E1','A2');s=land(s,1,[1,2,2,2,2,2,2,2]);
  assert.equal(s.game.boards.lead,0);s=land(s,2,[2,3,3,3,3,3,3,3]);
  const tied=go(s,{kind:'gray',group:0,venue:1});assert.equal(tied.game.boards.lead,null);
  s=go(s,{kind:'gray',group:0,venue:5});const key=project(s,0).game.power.find(o=>o.key.endsWith('/4')).key;
  s=go(s,{kind:'power',key});assert.equal(s.game.events.at(-1).face,'A2');assert.equal(s.game.boards.lead,0);
  s=land(s,3);s=choose(s,1);assert.equal(s.game.boards.closed,1);
  assert.ok(project(s,0).game.power.every(o=>!o.key.endsWith('/1')));
  s=land(s,2);assert.throws(()=>go(s,{kind:'gray',group:1,venue:1}),/封闭/);
});
test('E2 returns dice on final placement; F2 never triggers destination; H1 ejects to main venue',()=>{
  let s=setup('E2','F2','D1','H1');s=land(s,1,[1,2,2,2,2,2,2,2]);
  s=choose(s,'1-7');assert.equal(s.game.boards.bar.length,1);
  s=land(s,1);s=choose(s,'0-7');assert.equal(s.game.hands[1].length,1);
  s=land(s,2,[2,3,3,3,3,3]);s=choose(s,4);s=choose(s,5);
  const key=s.game.pending.options.find(o=>o.key.startsWith('put/3/')).key;
  const count=s.game.events.filter(e=>e.face==='D1').length;s=choose(s,key);
  assert.equal(s.game.events.filter(e=>e.face==='D1').length,count);conserve(s);
  s=setup('H1','D1');s=land(s,1,[1,2,3,3,3,3,3,3]);s=choose(s,'0-1');
  s=land(s,1,[1,2,3,3,3,3,3,3]);s=choose(s,'1-1');
  assert.equal(s.game.venues[1][0].owner,0);assert.equal(s.game.boards.nice[1].owner,1);
  assert.equal(s.game.events.filter(e=>e.face==='D1').length,0);conserve(s);
});
test('all 13 selectable faces finish three rounds against seat-filtered bots and conserve pieces every step',()=>{
  const enabled=Object.values(faces).filter(f=>f.enabled).map(f=>f.id);
  assert.equal(enabled.length,13);
  for(const group of [...enabled.map(f=>[f]),['A1','D1','F1'],['B1','E1','D2','F2','H1','G2'],['B2','C1','E2','A2','G2','F1']]){
    for(let seed=1;seed<=5;seed++){
      const rand=rng(seed),roll=n=>Array.from({length:n},()=>1+rand(6));
      let s=setup(...group);
      for(let steps=0;s.phase!=='complete';steps++){
        assert.ok(steps<600,group.join());conserve(s);
        const seat=decider(s)??0;
        const cmd=s.phase==='between'?{kind:'nextRound'}:seatAction(project(s,seat),seat,rand);
        s=go(s,cmd,roll(cmd.kind==='nextRound'?8:s.game.hands[seat].length),roll(4));
      }
      conserve(s);assert.equal(s.game.history.length,3);assert.ok(project(s,0).game.scores.some(r=>r.winner));
    }
  }
});
test('standard layout generator draws only distinct physical boards on venues 1–3',()=>{
  const layouts=new Set();
  for(let a=0;a<8;a++)for(let b=0;b<7;b++)for(let c=0;c<6;c++)for(let sides=0;sides<8;sides++){
    const digits=[a,sides&1,b,(sides>>1)&1,c,(sides>>2)&1];
    const slots=randomLayout(()=>digits.shift());
    assert.deepEqual(slots.map(x=>x.venue),[1,2,3]);assert.equal(new Set(slots.map(x=>x.face[0])).size,3);
    layouts.add(slots.map(x=>x.face).join());
  }
  assert.equal(layouts.size,2688);
});

test('gate holds position without paying, blocks H1 eviction, and frees a fully blocked roll',()=>{
  let s=setup('E1','H1');
  s=land(s,2,[2,3,4,4,4,4,4,4]);s=choose(s,'0-1');
  s=land(s,1,[1,2,2,2,2,2,2,2]);s=choose(s,3);assert.equal(s.game.chips[1],4);
  const blocked=go(s,{kind:'roll'},Array(6).fill(3));
  assert.equal(blocked.game.actor,1);assert.equal(blocked.game.hands[0].length,6);assert.equal(blocked.game.chips[0],2);
  s=land(s,2,[2,3,4,4,4,4]);assert.ok(!s.game.pending.options.some(o=>o.key==='0-3'));
  s=choose(s,'skip');s=land(s,1);s=choose(s,3);assert.equal(s.game.boards.gate,1);assert.equal(s.game.chips[1],4);conserve(s);
});
test('F2 locks occupied slots and closed sources; retrieving from a main venue returns a real die',()=>{
  let s=setup('F2','E1');
  s=land(s,1,[1,2,2,2,2,2,2,2]);s=choose(s,3);s=choose(s,0);assert.equal(s.game.chips[0],3);
  s=land(s,2,[2,3,3,3,3,3,3,3]);s=choose(s,6);
  s=land(s,1,[1,2,2,2,2,2,2]);assert.ok(!s.game.pending.options.some(o=>o.key==='6'));
  s=choose(s,5);assert.ok(!s.game.pending.options.some(o=>o.key==='0'));s=choose(s,5);
  const before=s.game.hands[0].length;s=choose(s,s.game.pending.options.find(o=>o.key.startsWith('take/')).key);
  assert.equal(s.game.hands[0].length,before+1);conserve(s);
});
test('H1 pays the occupied slots once and releases its slots for the next round',()=>{
  let s=setup('H1');
  s=land(s,1);s=choose(s,'0-7');
  s=land(s,4);assert.equal(s.phase,'between');
  assert.equal(s.game.chips[0],3);conserve(s);
  s=go(s,{kind:'nextRound'},Array(8).fill(6));assert.ok(s.game.boards.nice.every(x=>x===null));assert.equal(s.game.chips[0],5);
});
test('B1 neutral winner cannot make a choice; custom reserve stays separate even if bank runs short',()=>{
  let s=setup('A2','B1');
  s.game.venues[1]=s.game.venues[5].splice(0).map(d=>({...d,face:2}));
  s.game.wallets[1].push(...s.game.bank.splice(0));
  s=land(s,1,undefined,[2,2]);const reserve=s.game.deck.slice();
  assert.equal(s.game.events.at(-1).cash,0);assert.match(s.game.events.at(-1).text,/短付/);
  s=land(s,3);assert.equal(s.phase,'between');assert.equal(s.game.pending,null);
  assert.deepEqual(s.game.deck,reserve);conserve(s);
  assert.equal(s.game.events.filter(e=>e.face==='主场').length,12);
});

test('E2 capacity counts physical dice and leaves a seat with no remaining dice alone',()=>{
  let s=setup('E2');
  for(let i=0;i<2;i++){
    const rolls=Array(s.game.hands[0].length).fill(3);rolls[0]=1;
    s=land(s,1,rolls);s=choose(s,i===0?'1-7':'1-1');
    const theirs=Array(s.game.hands[1].length).fill(4);theirs[0]=2;
    s=land(s,2,theirs);
  }
  assert.equal(s.game.boards.bar.length,2);
  s=land(s,1);assert.equal(s.game.pending,null);assert.equal(s.game.boards.bar.length,2);conserve(s);
  s=land(s,1);assert.equal(s.phase,'roll');assert.equal(s.game.hands[1].length,2);conserve(s);
});
test('B2 top-out yields six units and opening stop yields zero; rerunning the same input is deterministic',()=>{
  const s=land(setup('B2'),1,undefined,[1,1]);const zero=choose(s,'stop');
  assert.equal(zero.game.wallets[0].length,0);
  const next=choose(s,'up',[2,2]);assert.deepEqual(next,choose(s,'up',[2,2]));
  let high=choose(next,'up',[3,3]);high=choose(high,'up',[4,4]);high=choose(high,'up',[5,5]);
  assert.equal(high.game.events.at(-1).cash,60000);assert.equal(high.game.pending,null);conserve(high);
});
