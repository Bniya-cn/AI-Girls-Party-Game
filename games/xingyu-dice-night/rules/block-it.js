import { check } from './modules.js';

export function initialGrayGroups(config) {
  return config.modules.some(slot => slot.face === 'F1') ? [1, 1, 2, 2, 3] : [];
}

export function triggersBlockIt(state, venue) {
  return state.config.modules.some(slot => slot.face === 'F1' && slot.venue === venue)
    && state.game.groups.some(Boolean);
}

// Called on the reducer's private draft. Moving blanks does not activate the destination.
export function placeGrayGroup(game, group, venue) {
  check(Number.isInteger(group) && game.groups[group] > 0, '灰骰组无效或已用完');
  check(Number.isInteger(venue) && venue >= 1 && venue <= 6, '灰骰目标无效');
  for (let i = 0; i < game.groups[group]; i++) {
    game.venues[venue - 1].push({ owner: 'gray', big: false, id: 'gray-' + group + '-' + i });
  }
  game.groups[group] = 0;
}
