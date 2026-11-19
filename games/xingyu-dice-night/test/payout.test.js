import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedDeck,cardValue,dealPrizes,finalScores,settleRound,shuffledDeck } from '../rules/payout.js';
import { practiceState } from '../server/practice.js';
import { project,transition } from '../rules/engine.js';

test('draws intact pairs, ranks equal sums by their high card, has exactly 90 distinct cards',()=>{
  const deck=orderedDeck(),ids=new Set(shuffledDeck(()=>0));
  assert.equal(ids.size,90);
  assert.deepEqual(Array.from({length:8},(_,i)=>deck.filter(id=>cardValue(id)===(i+3)*10000).length),[11,11,13,15,13,11,9,7]);
  const cards=[0,1,2,3,4,5,6,7,11,73,22,50];
  const pairs=dealPrizes(cards).map(pair=>pair.map(cardValue));
  assert.deepEqual(pairs.slice(-2),[[70000,50000],[80000,40000]]);assert.equal(cards.length,0);
});

test('ties removed at every strength; imaginary winners return cards; highest paying seat starts',()=>{
  const d=(owner,big=false)=>({owner,big});
  const g={deck:[],wallets:[[],[],[]],history:[],round:1,starter:2,
    prizes:Array.from({length:6},(_,i)=>[24+i,i]),venues:[
      [d(0,true),d(1),d(1),d(2)],[],[],[],[d(0),d(1,true)],
      [d('neutral',true),d('neutral'),d('gray'),d(2,true)]]};
  settleRound(g);
  assert.deepEqual(g.history[0].venues[0].awards.map(a=>a.owner),[2,null]);
  assert.deepEqual(g.history[0].venues[5].awards.map(a=>a.owner),['neutral',2]);
  assert.equal(g.history[0].nextStarter,2);
  assert.equal(g.deck.length+g.wallets.flat().length,12);
  g.venues=Array.from({length:6},()=>[d(0),d(1)]);
  settleRound(g);assert.equal(g.history.at(-1).nextStarter,0);
});

test('money first, then cards plus chips, then shared victory',()=>{
  assert.deepEqual(finalScores([[0,1],[35]],[0,0]).map(r=>[r.seat,r.winner]),[[0,true],[1,false]]);
  assert.deepEqual(finalScores([[35],[11]],[0,2]).map(r=>[r.seat,r.winner]),[[1,true],[0,false]]);
  assert.ok(finalScores([[0],[1]],[1,1]).every(r=>r.total===40000&&r.winner));
  assert.equal(finalScores([[0],[11]],[0,0])[0].seat,1);
});

test('all three rounds conserve cards and refill chips, dice, neutrals and F1',()=>{
  let s=practiceState('玩家',true,Array(8).fill(3),orderedDeck());
  for(let round=1;round<=3;round++){
    const g=s.game;
    assert.equal(g.round,round);assert.equal(g.chips[0],2*round);
    assert.deepEqual(g.groups,[1,1,2,2,3]);assert.deepEqual(g.hands.map(h=>h.length),[8,8]);
    assert.equal(g.venues.flat().filter(d=>d.owner==='neutral').length,8);
    assert.equal(new Set([...g.deck,...g.prizes.flat(),...g.wallets.flat()]).size,90);
    assert.doesNotMatch(JSON.stringify(project(s)),/"deck"|"wallets"/);
    while(s.phase==='roll'){
      const a=s.game.actor;
      s=transition(s,a,{kind:'roll'},Array(8).fill(a===0?5:6));
      s=transition(s,a,{kind:'place',face:a===0?5:6});
    }
    assert.equal(s.game.history.length,round);
    assert.equal(new Set([...s.game.deck,...s.game.wallets.flat()]).size,90);
    assert.throws(()=>transition(s,1,{kind:'nextRound'},Array(8).fill(4)));
    if(round<3){
      s=transition(s,0,{kind:'nextRound'},Array(8).fill(4));
      assert.equal(s.game.actor,1);
      assert.throws(()=>transition(s,0,{kind:'nextRound'},Array(8).fill(4)));
    }
  }
  assert.equal(s.phase,'complete');assert.throws(()=>transition(s,0,{kind:'nextRound'}));
  assert.equal(project(s).game.scores.length,2);
});
