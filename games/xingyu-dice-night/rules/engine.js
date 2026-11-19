import { check, fields, validateConfig } from './modules.js';

import { cardValue, dealPrizes, finalScores, orderedDeck, settleRound } from './payout.js';
import { initialGrayGroups, triggersBlockIt, placeGrayGroup } from './block-it.js';

import { beginBoards, note, openVenue, p0, refreshLead, takeDie } from './royale.js';
import { prizes } from './royale-prizes.js';
import { moves, powerOptions } from './royale-moves.js';
const modules={...p0,...prizes,...moves};

export const defaultConfig = () => ({ seats: 5, modules: [] });
export function lobby(name) {
  return { phase: 'lobby', config: defaultConfig(), players: [{ id: 0, name, ready: false }], game: null };
}

export function join(state, name) {
  check(state.phase === 'lobby' && state.players.length < state.config.seats, '房间已满或已开局');
  const players = state.players.map(p => ({ ...p, ready: false }));
  players.push({ id: players.length, name, ready: false });
  return { ...state, players };
}

function dice(owner) {
  return Array.from({ length: 8 }, (_, index) => ({
    id: owner + '-' + index, owner, big: index === 7
  }));
}

function rolled(dice, outcomes) {
  check(Array.isArray(outcomes) && outcomes.length === dice.length, '服务端骰值数量错误');
  return dice.map((die, i) => {
    const face = outcomes[i];
    check(Number.isInteger(face) && face >= 1 && face <= 6, '服务端骰值错误');
    return { ...die, face };
  });
}

function finishRound(state) {
  const g=state.game;
  settleRound(g);
  if(g.boards){
    g.history.at(-1).venues.forEach((venue,i)=>{
      venue.awards.forEach((award,j)=>{
        const card=g.prizes[i][j],paid=Number.isInteger(award.owner);
        note(g,'主场',(i+1)+' 号 · '+(j?'次奖 ':'头奖 ')+award.value/10000+' 万'+(paid?'':'归堆'),
          {seat:paid?award.owner:null,owner:award.owner,card,venue:i+1,value:award.value});
      });
    });
    for(const {face} of [...state.config.modules].sort((a,b)=>a.venue-b.venue))modules[face]?.payout?.(state);
    g.history.at(-1).events=g.events.slice();
    g.prizes=[]; // Paid cards now belong exclusively to wallets or discards.
  }
  state.phase=g.round===3?'complete':'between';
  g.actor=null;
}
function nextTurn(state,pair) {
  const g = state.game;
  g.roll = [];
  for (let step = 1; step <= g.hands.length; step++) {
    const next = (g.actor + step) % g.hands.length;
    if (g.hands[next].length) {
      g.actor = next;
      state.phase = 'roll';
      return;
    }
  }
  if(state.config.modules.some(m=>m.face==='B1')){
    prizes.B1.beforePayout(state,pair);
    if(g.pending)return;
  }
  finishRound(state);
}

function beginRound(state, starter, outcomes) {
  const g=state.game;
  g.round++;
  g.starter=g.actor=starter;
  g.hands=state.players.map(p=>dice(p.id));
  g.venues=Array.from({length:6},()=>[]);
  g.prizes=dealPrizes(g.deck);
  g.chips=g.chips.map(count=>count+2);
  g.groups=initialGrayGroups(state.config);
  g.roll=[];
  if(state.players.length===2){
    for(const die of rolled(dice('neutral'),outcomes))g.venues[die.face-1].push(die);
  }
  if(g.bank){
    beginBoards(state);
    for(const p of state.players)note(g,'开轮','领取 2 枚筹码',{seat:p.id,chips:2});
  }
  state.phase='roll';
}

const shape = { configure: ['config'], ready: ['value'], start: [], nextRound: [], roll: [], place: ['face'],
  pass: [], gray: ['group', 'venue'], decide:['id','key'], power:['key'] };

// All entropy is explicit input. Replaying the same state, command and outcomes is deterministic.
export function transition(previous, actor, command, outcomes = [], deckOrder, bonusDice = []) {
  check(command && typeof command.kind === 'string' && Object.hasOwn(shape, command.kind) && fields(command, ['kind', ...shape[command.kind]]), '动作格式错误');
  check(Number.isInteger(actor) && previous.players[actor], '未知座位');
  const state = structuredClone(previous);
  let offset=0;
  const pair=()=>{
    const d=bonusDice.slice(offset,offset+2);offset+=2;
    check(d.length===2 && d.every(n=>Number.isInteger(n)&&n>=1&&n<=6),'额外骰值错误');
    return d;
  };
  const { kind } = command;
  if (['configure', 'ready', 'start'].includes(kind)) {
    check(state.phase === 'lobby', '开局后大厅已锁定');
    if (kind === 'ready') {
      check(typeof command.value === 'boolean', '准备状态错误');
      state.players[actor].ready = command.value;
      return state;
    }
    check(actor === 0, '仅房主可操作');
    if (kind === 'configure') {
      validateConfig(command.config);
      check(command.config.seats >= state.players.length, '座位少于现有人数');
      state.config = structuredClone(command.config);
      state.players.forEach(p => { p.ready = false; });
      return state;
    }
    validateConfig(state.config);
    check(state.players.length >= 2 && state.players.every(p => p.ready), '至少两人且须全员准备');
    const deck=deckOrder ?? orderedDeck();
    check(deck.length===90 && new Set(deck).size===90 && deck.every(id=>Number.isInteger(id)&&id>=0&&id<90),'牌堆错误');
    state.game={round:0,deck:[...deck],wallets:state.players.map(()=>[]),chips:state.players.map(()=>0),history:[]};
    if(state.config.mode==='custom' || state.config.modules.some(m=>m.face!=='F1')){
      state.game.bank=state.game.deck.splice(36);
      state.game.discards=[];state.game.serial=0;
    }
    beginRound(state,0,outcomes);
    return state;
  }
  const g = state.game;
  if (kind === 'nextRound') {
    check(actor===0 && state.phase==='between','仅房主可在轮末开启下一轮');
    beginRound(state,g.history.at(-1).nextStarter,outcomes);
    return state;
  }
  if(kind==='decide'){
    const pending=g?.pending;
    check(state.phase==='decision' && pending && pending.seat===actor,'尚未轮到此座位选择');
    check(command.id===pending.id && pending.options.some(o=>o.key===command.key),'选择已过期或无效');
    g.pending=null;
    modules[pending.face].choose(state,pending,command.key,pair);
    refreshLead(state);
    if(!g.pending){
      if(pending.face==='B1')finishRound(state);
      else nextTurn(state,pair);
    }
    return state;
  }
  check(g && g.actor === actor, '尚未轮到此座位');
  if(kind==='power'){
    check(state.phase==='roll' && powerOptions(state,actor).some(o=>o.key===command.key),'当前不能使用定面');
    const [id,number]=command.key.split('/'),face=Number(number);
    const die={...takeDie(g.hands[actor],id),face};
    g.roll=[die];g.venues[face-1].push(die);
    note(g,'D2','定面投放到 '+face+' 号',{seat:actor});
    afterPlace(state,face,pair);
    return state;
  }
  if (kind === 'roll') {
    check(state.phase === 'roll', '当前不能掷骰');
    g.roll = rolled(g.hands[actor], outcomes);
    state.phase = 'select';
    if(!g.roll.some(d=>openVenue(state,d.face))){
      note(g,'E1','本次点数全部被封，免费让过',{seat:actor});nextTurn(state,pair);
    }
    return state;
  }
  if (kind === 'gray') {
    check(state.phase === 'gray', '当前不能放灰骰');
    check(openVenue(state,command.venue),'场地已封闭或无效');
    placeGrayGroup(g, command.group, command.venue);
    if(g.boards){note(g,'F1','灰骰落入 '+command.venue+' 号',{seat:actor});refreshLead(state);}
    nextTurn(state,pair);
    return state;
  }
  check(state.phase === 'select', '请先掷骰');
  if (kind === 'pass') {
    check(g.chips[actor] > 0, '没有可用筹码');
    g.chips[actor]--;
    if(g.boards)note(g,'本体','跳过本回合',{seat:actor,chips:-1});
  } else {
    const selected = g.roll.filter(d => d.face === command.face);
    check(openVenue(state,command.face),'场地已封闭或无效');
    check(selected.length > 0, '只能选择此次掷出的点数');
    const ids = new Set(selected.map(d => d.id));
    g.hands[actor] = g.hands[actor].filter(d => !ids.has(d.id));
    g.venues[command.face - 1].push(...selected);
    afterPlace(state,command.face,pair);
    return state;
  }
  nextTurn(state,pair);
  return state;
}

function afterPlace(state,n,pair){
  const g=state.game,face=state.config.modules.find(m=>m.venue===n)?.face;
  if(g.boards)refreshLead(state);
  if(triggersBlockIt(state,n)){g.roll=[];state.phase='gray';return;}
  modules[face]?.enter?.(state,n,g.actor,pair);
  if(!g.pending)nextTurn(state,pair);
}

function royaleView(s,seat){
  const g=s.game,p=g.pending;
  const pending=p && {id:p.id,face:p.face,seat:p.seat,step:p.step,
    prompt:p.seat===seat?p.prompt:'等待'+s.players[p.seat].name+'选择',
    options:p.seat===seat?structuredClone(p.options):[]};
  if(p?.face==='B2'){pending.progress=p.context.index;pending.total=p.context.sum;}
  if(p?.step==='guess' && seat===g.actor)pending.committed=p.context.hidden;
  return {boards:structuredClone(g.boards),events:structuredClone(g.events),pending,
    bank:g.bank.map(cardValue),wallet:g.wallets[seat]?.map(cardValue),
    power:s.phase==='roll' && seat===g.actor?powerOptions(s,seat):[]};
}

// Only public fields travel over the wire. The transport keeps credentials separately.
export function project(state,seat) {
  const { game: g } = state;
  return { phase: state.phase, config: structuredClone(state.config), players: state.players.map(({ id, name, ready }) => ({ id, name, ready })),
    game: g && { round:g.round, starter:g.starter, prizes:g.prizes.length?g.prizes.map(pair=>pair.map(cardValue)):g.history.at(-1).venues.map(v=>v.awards.map(a=>a.value)),
      ...(g.boards?royaleView(state,seat):{}),
      history:structuredClone(g.history), scores:state.phase==='complete'?finalScores(g.wallets,g.chips):null, actor: g.actor, chips: [...g.chips], remaining: g.hands.map(hand => hand.length),
      venues: structuredClone(g.venues), roll: structuredClone(g.roll), groups: [...g.groups] } };
}
