export const faces = Object.fromEntries([
  ['Lucky Punch', 'Jackpot'], ['Prime Time', 'Fifty Fifty'], ['High Five', 'Bad Luck'],
  ['Pay Day', 'Power Play'], ['No Entry!', 'Knockout?'], ['Block It!', 'Handicap'],
  ['Black Box', 'Double Down'], ['Nice Dice', 'My Choice']
].flatMap((pair, index) => pair.map((name, side) => {
  const board = 'ABCDEFGH'[index];
  const id = board + (side + 1);
  return [id, { id, board, name, enabled:true }];
})));

export function check(condition, message) {
  if (!condition) throw new Error(message);
}

export function fields(object, names) {
  return object !== null && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === names.length && names.every(key => Object.hasOwn(object, key));
}

export function validateConfig(config) {
  check((fields(config, ['seats', 'modules']) || (fields(config, ['seats','modules','mode']) && ['custom','shuffle','lesson'].includes(config.mode))), '配置格式错误');
  check(Number.isInteger(config.seats) && config.seats >= 2 && config.seats <= 5, '座位须为 2–5 个');
  check(Array.isArray(config.modules) && config.modules.length <= 6, '场地最多六个');
  if(config.mode==='shuffle')check(!config.modules.length,'随机桌由服务端抽板');
  if(config.mode==='lesson')check(config.modules.length===1,'单板练习请选择一面');
  const venues = new Set(), boards = new Set();
  for (const slot of config.modules) {
    check(fields(slot, ['face', 'venue']) && typeof slot.face === 'string' && Object.hasOwn(faces, slot.face), '未知模块');
    check(Number.isInteger(slot.venue) && slot.venue >= 1 && slot.venue <= 6, '未知场地');
    check(!venues.has(slot.venue), '同一场地只可接一块板');
    check(!boards.has(faces[slot.face].board), '同一块板不可同时使用两面');
    venues.add(slot.venue);
    boards.add(faces[slot.face].board);
  }
  check(config.modules.every(slot => faces[slot.face].enabled), '此模块尚未实现');
}
