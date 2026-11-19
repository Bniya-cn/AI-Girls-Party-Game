import { check, fields, validateConfig } from './modules.js';

import { cardValue, dealPrizes, finalScores, orderedDeck, settleRound } from './payout.js';
import { initialGrayGroups, triggersBlockIt, placeGrayGroup } from './block-it.js';

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

function nextTurn(state) {
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
  settleRound(g);
  state.phase = g.round===3 ? 'complete' : 'between';
  g.actor = null;
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
  state.phase='roll';
}

const shape = { configure: ['config'], ready: ['value'], start: [], nextRound: [], roll: [], place: ['face'],
  pass: [], gray: ['group', 'venue'] };

// All entropy is explicit input. Replaying the same state, command and outcomes is deterministic.
export function transition(previous, actor, command, outcomes = [], deckOrder) {
  check(command && typeof command.kind === 'string' && Object.hasOwn(shape, command.kind) && fields(command, ['kind', ...shape[command.kind]]), '动作格式错误');
  check(Number.isInteger(actor) && previous.players[actor], '未知座位');
  const state = structuredClone(previous);
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
    beginRound(state,0,outcomes);
    return state;
  }
  const g = state.game;
  if (kind === 'nextRound') {
    check(actor===0 && state.phase==='between','仅房主可在轮末开启下一轮');
    beginRound(state,g.history.at(-1).nextStarter,outcomes);
    return state;
  }
  check(g && g.actor === actor, '尚未轮到此座位');
  if (kind === 'roll') {
    check(state.phase === 'roll', '当前不能掷骰');
    g.roll = rolled(g.hands[actor], outcomes);
    state.phase = 'select';
    return state;
  }
  if (kind === 'gray') {
    check(state.phase === 'gray', '当前不能放灰骰');
    placeGrayGroup(g, command.group, command.venue);
    nextTurn(state);
    return state;
  }
  check(state.phase === 'select', '请先掷骰');
  if (kind === 'pass') {
    check(g.chips[actor] > 0, '没有可用筹码');
    g.chips[actor]--;
  } else {
    const selected = g.roll.filter(d => d.face === command.face);
    check(selected.length > 0, '只能选择此次掷出的点数');
    const ids = new Set(selected.map(d => d.id));
    g.hands[actor] = g.hands[actor].filter(d => !ids.has(d.id));
    g.venues[command.face - 1].push(...selected);
    g.roll = [];
    if (triggersBlockIt(state, command.face)) {
      state.phase = 'gray';
      return state;
    }
  }
  nextTurn(state);
  return state;
}

// Only public fields travel over the wire. The transport keeps credentials separately.
export function project(state) {
  const { game: g } = state;
  return { phase: state.phase, config: structuredClone(state.config), players: state.players.map(({ id, name, ready }) => ({ id, name, ready })),
    game: g && { round:g.round, starter:g.starter, prizes:g.prizes.map(pair=>pair.map(cardValue)),
      history:structuredClone(g.history), scores:state.phase==='complete'?finalScores(g.wallets,g.chips):null, actor: g.actor, chips: [...g.chips], remaining: g.hands.map(hand => hand.length),
      venues: structuredClone(g.venues), roll: structuredClone(g.roll), groups: [...g.groups] } };
}
