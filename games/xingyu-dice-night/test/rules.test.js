import test from 'node:test';
import assert from 'node:assert/strict';
import { lobby,join,transition as t,project } from '../rules/engine.js';
import { faces,validateConfig } from '../rules/modules.js';

const action=(kind,extra={})=>({kind,...extra});
function started(players=2, tile=1) {
  let s=lobby('房主');
  for (let i=1;i<players;i++) s=join(s,'访客'+i);
  s=t(s,0,action('configure',{config:{seats:players,modules:tile?[{face:'F1',venue:tile}]:[]}}));
  for (let i=0;i<players;i++) s=t(s,i,action('ready',{value:true}));
  return t(s,0,action('start'),Array(8).fill(3));
}
test('configuration rejects collisions, unfinished boards, malformed input and excess seats',()=>{
  assert.equal(Object.keys(faces).length,16);
  const f=(face,venue)=>({face,venue});
  for(const [modules,reason] of [
    [[f('F1',2),f('F2',3)],/两面/],[[f('A1',2),f('F1',2)],/场地/],[[f('F2',2)],/尚未/],
    [[f('XX',1)],/未知/],[[f(['F1'],1)],/未知/],[[f('F1',7)],/未知/]
  ]) assert.throws(()=>validateConfig({seats:3,modules}),reason);
  assert.throws(()=>validateConfig({seats:6,modules:[]}));
  assert.throws(()=>validateConfig({seats:2,modules:[],future:false}));
});

test('host permissions, ready reset, capacity and lobby lock',()=>{
  let s=join(lobby('A'),'B');
  const config={seats:2,modules:[]};
  assert.throws(()=>t(s,1,action('configure',{config})),/房主/);
  s=t(s,0,action('ready',{value:true}));
  assert.equal(join(s,'C').players[0].ready,false);
  assert.throws(()=>t(s,0,action('start')),/准备/);
  s=t(s,0,action('configure',{config}));
  assert.equal(s.players[0].ready,false);
  assert.throws(()=>join(s,'C'),/已满/);
  assert.throws(()=>t(started(),0,action('configure',{config})),/锁定/);
});

test('roll/place moves the entire group and preserves big die identity; disabled tile never triggers',()=>{
  const s=started(3,0), snapshot=structuredClone(s);
  assert.equal(s.game.venues.flat().length,0);
  assert.throws(()=>t(s,1,action('roll')),/轮到/);
  assert.throws(()=>t(s,0,action('roll',{outcomes:[1]})),/格式/);
  assert.throws(()=>t(s,0,action('roll'),[7]),/数量/);
  const r=t(s,0,action('roll'),[2,2,4,3,4,3,5,2]);
  assert.deepEqual(s,snapshot);
  assert.throws(()=>t(r,0,action('place',{face:6})),/点数/);
  const p=t(r,0,action('place',{face:2}));
  assert.equal(p.game.venues[1].length,3);
  assert.equal(p.game.venues[1].filter(d=>d.big).length,1);
  assert.equal(p.game.hands[0].length,5);
  assert.equal(p.game.actor,1);
  assert.equal(p.phase,'roll');
});

test('F1 interrupts even on final placement; blank and two-player neutral dice stay distinct',()=>{
  let s=started();
  assert.equal(s.game.venues[2].length,8);
  s=t(s,0,action('roll'),Array(8).fill(1));
  s=t(s,0,action('place',{face:1}));
  assert.equal(s.phase,'gray');
  assert.throws(()=>t(s,1,action('gray',{group:4,venue:3})));
  assert.throws(()=>t(s,0,action('gray',{group:6,venue:3})));
  s=t(s,0,action('gray',{group:4,venue:3}));
  assert.equal(s.game.venues[2].filter(d=>d.owner==='gray').length,3);
  assert.deepEqual(s.game.groups,[1,1,2,2,0]);
  s=t(s,1,action('roll'),Array(8).fill(1));
  s=t(s,1,action('place',{face:1}));
  assert.throws(()=>t(s,1,action('gray',{group:4,venue:1})));
  s=t(s,1,action('gray',{group:0,venue:1}));
  assert.equal(s.phase,'between');
  assert.equal(new Set(s.game.venues.flat().map(d=>d.id)).size,28);
});

test('chips can pass only after rolling; depleted hand skipped; no pass at zero chips',()=>{
  let s=started(2,0);
  const go=(actor,kind,extra,roll)=>{s=t(s,actor,action(kind,extra),roll);};
  assert.throws(()=>go(0,'pass'));
  go(0,'roll',{},Array(8).fill(6)); go(0,'place',{face:6});
  for(let i=0;i<2;i++) {go(1,'roll',{},Array(8).fill(4)); go(1,'pass');}
  assert.equal(s.game.chips[1],0);
  go(1,'roll',{},Array(8).fill(4));
  assert.throws(()=>go(1,'pass'),/筹码/);
  go(1,'place',{face:4}); assert.equal(s.phase,'between');
});

test('projection explicitly excludes private state and detaches public arrays',()=>{
  const s=started(5);
  s.secret='hidden'; s.game.privateDeck=['hidden'];
  const p=project(s);
  assert.doesNotMatch(JSON.stringify(p),/hidden|hands/);
  p.game.chips[0]=0;
  assert.equal(s.game.chips[0],2);
});

test('all five gray groups exhaust exactly nine dice and later visits skip the module prompt',()=>{
  let s=started(3);
  for(let visit=0;visit<6;visit++){
    const a=s.game.actor;
    const result=Array(s.game.hands[a].length).fill(2);
    result[0]=1;
    s=t(s,a,action('roll'),result);
    s=t(s,a,action('place',{face:1}));
    if(visit<5){
      assert.equal(s.phase,'gray');
      s=t(s,a,action('gray',{group:visit,venue:1}));
    }
    assert.equal(s.phase,'roll');
  }
  assert.equal(s.game.venues[0].filter(d=>d.owner==='gray').length,9);
  assert.deepEqual(s.game.groups,[0,0,0,0,0]);
});
