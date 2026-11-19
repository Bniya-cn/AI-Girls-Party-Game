import { join, lobby, transition } from '../rules/engine.js';

export const computerSeat = 1;

export function practiceState(name, withGrayBoard, neutralFaces, deckOrder) {
  let state = join(lobby(name), '电脑对手');
  state = transition(state, 0, { kind:'configure', config:{
    seats:2, modules:withGrayBoard ? [{face:'F1', venue:1}] : []
  } });
  for (const player of state.players) state = transition(state, player.id, {kind:'ready', value:true});
  return transition(state, 0, {kind:'start'}, neutralFaces, deckOrder);
}

export function computerAction(state) {
  const game = state.game;
  if (game?.actor !== computerSeat) return null;
  if (state.phase === 'roll') return {kind:'roll'};
  if (state.phase === 'select') {
    const counts = Array(7).fill(0);
    for (const die of game.roll) counts[die.face]++;
    return {kind:'place', face:counts.indexOf(Math.max(...counts))};
  }
  if (state.phase === 'gray') {
    const group = game.groups.indexOf(Math.max(...game.groups));
    const occupancy = game.venues.map(dice => dice.length);
    return {kind:'gray', group, venue:occupancy.indexOf(Math.min(...occupancy)) + 1};
  }
  return null;
}
