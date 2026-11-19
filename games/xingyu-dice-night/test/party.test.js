import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceState,seatAction,decider} from '../server/practice.js';
import {transition,project} from '../rules/engine.js';
import {shuffledDeck,cardValue} from '../rules/payout.js';
import {randomLayout} from '../rules/royale.js';
import {paymentOptions} from '../rules/encounters.js';

const seedRng=seed=>n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*n);};
const slots=ids=>ids.map((face,i)=>({face,venue:i+1}));
const room=(...ids)=>practiceState('甲',slots(ids),Array(8).fill(6),shuffledDeck(seedRng(2026)));
const act=(s,c,normal=[],extra=[4,6])=>transition(s,decider(s)??0,c,normal,undefined,extra);
const land=(s,face,extra)=>act(act(s,{kind:'roll'},[face,...Array(s.game.hands[s.game.actor].length-1).fill(5)]),{kind:'place',face},[],extra);
const choose=(s,key,extra)=>act(s,{kind:'decide',id:s.game.pending.id,key:String(key)},[],extra);
function reserveCheck(g){
  const cards=[...g.wallets.flat(),...g.deck,...g.bank,...g.discards,...g.prizes.flat()];
  assert.equal(cards.length,90);assert.equal(new Set(cards).size,90);
  const dice=[...g.venues.flat(),...g.hands.flat(),...g.boards.nice,...g.boards.handicap,...g.boards.double,...g.boards.bar,g.boards.gold].filter(Boolean);
  assert.equal(new Set(dice.map(d=>d.id)).size,dice.length);
  for(const seat of [0,1])assert.equal(dice.filter(d=>d.owner===seat&&!d.extra).length,8);
  assert.ok(g.chips.every(n=>n>=0));
}
test('G1 partition stays private across two equivalent hidden splits; reward is paid before next roll',()=>{
  const split=land(room('G1'),1);assert.equal(decider(split),1);
  const left=choose(split,1),empty=choose(split,8);
  assert.deepEqual(project(left,0),project(empty,0));
  assert.deepEqual(project(left,0),project(structuredClone(left),0));
  assert.deepEqual(seatAction(project(left,0),0,()=>0),seatAction(project(empty,0),0,()=>0));
  assert.throws(()=>transition(left,1,{kind:'decide',id:left.game.pending.id,key:'left'}));
  const done=choose(left,'left');assert.equal(done.phase,'roll');assert.equal(done.game.wallets[0].map(cardValue).reduce((a,b)=>a+b,0),60000);
  assert.equal(choose(empty,'left').game.wallets[0].length,0);assert.throws(()=>choose(split,63));reserveCheck(done.game);
});
test('C2 charges immediately, including tied minima and change in bills, with no duplicate round-end charge',()=>{
  let s=room('C2'),g=s.game;
  const give=n=>{const i=g.bank.findIndex(c=>cardValue(c)===n);assert.ok(i>=0);g.wallets[1].push(g.bank.splice(i,1)[0]);};
  give(80000);g.chips[1]=0;
  assert.equal(paymentOptions(g,1)[0].net,5);
  s=land(s,1);
  assert.equal(s.phase,'roll');assert.equal(s.game.wallets[1].reduce((a,c)=>a+cardValue(c),0),30000);
  s=land(s,1);while(s.game.pending)s=choose(s,s.game.pending.options[0].key);
  assert.equal(s.game.events.filter(e=>e.penalty!==undefined).length,3);reserveCheck(s.game);
  const poor=paymentOptions({bank:[],wallets:[[0]],chips:[1]},0)[0];assert.equal(poor.net,4);
  const short=paymentOptions({bank:[],wallets:[[89]],chips:[0]},0)[0];assert.equal(short.net,0);
});
test('H2 resolves all six signs, filters sealed targets, transfers the golden die and never recurses',()=>{
  for(const v of [1,2,3]){const s=choose(land(room('H2'),1,[v,v]),v);assert.equal(s.game.events.at(-1).face,'H2');reserveCheck(s.game);}
  let s=choose(land(room('H2','G1','D1'),1,[4,4]),4);
  assert.deepEqual(s.game.pending.options.map(o=>o.key),['2','3']);
  s=choose(s,2);s=choose(s,1);s=choose(s,'left');assert.equal(s.phase,'roll');reserveCheck(s.game);
  s=choose(land(room('H2','D1'),1,[5,5]),5);s=choose(s,s.game.pending.options.find(o=>o.key.startsWith('put/2/')).key);
  assert.equal(s.game.events.filter(e=>e.face==='D1').length,0);reserveCheck(s.game);
  s=choose(land(room('H2'),1,[6,6]),6);s=choose(s,s.game.pending.options[0].key);
  const old=s.game.boards.gold.id;assert.equal(s.game.events.at(-1).cash,60000);
  s=choose(land(s,1,[6,6]),6);s=choose(s,s.game.pending.options[0].key);assert.ok(s.game.hands[0].some(d=>d.id===old));reserveCheck(s.game);
  s=room('H2','F1','A1');s.game.boards.closed=3;s=choose(land(s,1,[4,4]),4);assert.deepEqual(s.game.pending.options.map(o=>o.key),['2']);
  s=choose(s,2);assert.equal(s.phase,'gray');s=act(s,{kind:'gray',group:0,venue:2});assert.equal(s.phase,'roll');
});
test('random layout is renewed only at round boundaries; teaching roll is marked and repeatable',()=>{
  const rng=seedRng(7);
  let s=practiceState('甲',{mode:'shuffle',modules:[]},Array(8).fill(6),shuffledDeck(rng),rng);
  const observed=[];
  for(let i=0;s.phase!=='complete';i++){
    assert.ok(i<500);
    const a=decider(s)??0,c=s.phase==='between'?{kind:'nextRound'}:seatAction(project(s,a),a,rng);
    if(c.kind==='nextRound')observed.push(structuredClone(s.config.modules));
    const layout=c.kind==='nextRound'?randomLayout(rng):undefined;
    s=transition(s,a,c,Array.from({length:c.kind==='nextRound'?8:s.game.hands[a].length},()=>1+rng(6)),undefined,[1,5,2,4],layout);
  }
  observed.push(s.config.modules);
  assert.deepEqual(s.game.history.map(h=>h.modules),observed);assert.ok(new Set(observed.map(JSON.stringify)).size>1);
  const lesson=practiceState('甲',{mode:'lesson',modules:slots(['G1'])},Array(8).fill(6),shuffledDeck(rng));
  assert.equal(act(lesson,{kind:'roll'},Array(8).fill(3)).game.roll.filter(d=>d.face===1).length,5);
});
function run(ids,seed,stats){
  const rng=seedRng(seed),roll=n=>Array.from({length:n},()=>1+rng(6));
  let s=practiceState('甲',slots(ids),roll(8),shuffledDeck(rng));
  for(let steps=0;s.phase!=='complete';steps++){
    assert.ok(steps<600,ids.join()+' seed '+seed);reserveCheck(s.game);
    const a=decider(s)??0,cmd=s.phase==='between'?{kind:'nextRound'}:seatAction(project(s,a),a,rng);
    if(s.phase==='select' && stats){
      stats.turns++;if(new Set(s.game.roll.map(d=>d.face).filter(f=>f!==s.game.boards.closed)).size>1)stats.alternatives++;
    }
    s=act(s,cmd,roll(cmd.kind==='nextRound'?8:s.game.hands[a].length),roll(4));
  }
  assert.equal(s.game.history.length,3);reserveCheck(s.game);
  if(stats)for(const h of s.game.history)for(const p of h.plays)stats.faces.add(p.face);
}
test('all 448 physical three-face combinations complete three rounds; 100 six-venue party games measure decisions',t=>{
  let seed=1000;const boards=[...'ABCDEFGH'];
  for(let a=0;a<6;a++)for(let b=a+1;b<7;b++)for(let c=b+1;c<8;c++)for(let mask=0;mask<8;mask++){
    run([a,b,c].map((idx,i)=>boards[idx]+(1+((mask>>i)&1))),seed++);
  }
  const stats={turns:0,alternatives:0,faces:new Set()};
  for(let i=1;i<=100;i++)run(['A1','B2','C2','F1','G1','H2'],i,stats);
  assert.equal(stats.faces.size,6);
  t.diagnostic('六场派对 100 局：'+stats.turns+' 次选区，'+stats.alternatives+' 次有两个或更多合法场地；六种小游戏均触发。');
});
