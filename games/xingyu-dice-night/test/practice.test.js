import test from 'node:test';
import assert from 'node:assert/strict';
import { computerAction, practiceState } from '../server/practice.js';
import { transition, project } from '../rules/engine.js';
import { guidedHint } from '../web/tutorial.js';

test('computer plays legal whole groups and resolves its last F1 before the round ends',()=>{
  let s=practiceState('玩家',true,Array(8).fill(4));
  assert.equal(computerAction(s),null);
  s=transition(s,0,{kind:'roll'},Array(8).fill(5));
  s=transition(s,0,{kind:'place',face:5});
  s=transition(s,1,computerAction(s),[1,1,1,1,1,1,3,3]);
  assert.deepEqual(computerAction(s),{kind:'place',face:1});
  s=transition(s,1,computerAction(s));assert.equal(s.phase,'gray');
  const gray=computerAction(s);assert.equal(gray.group,4);
  s=transition(s,1,gray);s=transition(s,1,computerAction(s),[1,1]);
  s=transition(s,1,computerAction(s));s=transition(s,1,computerAction(s));
  assert.equal(s.phase,'between');assert.equal(computerAction(s),null);
  assert.equal(s.game.venues.flat().filter(d=>d.owner==='gray').length,5);
});
test('guide describes the actual remaining hand, duplicate faces and the next legal action',()=>{
  let s=practiceState('玩家',false,Array(8).fill(3));
  const hint=()=>guidedHint({you:0,state:project(s)});
  assert.match(hint(),/全部 8/);s=transition(s,0,{kind:'roll'},[2,2,2,2,1,6,5,5]);
  assert.match(hint(),/4 颗 2 点骰/);assert.match(hint(),/筹码跳过/);
  s=transition(s,0,{kind:'place',face:2});assert.match(hint(),/电脑对手/);
  assert.deepEqual(s.config.modules,[]);
});
