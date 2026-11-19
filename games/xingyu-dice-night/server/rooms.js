import { randomBytes, randomInt } from 'node:crypto';
import { WebSocket } from 'ws';
import { lobby, join, transition, project } from '../rules/engine.js';
import { check, fields } from '../rules/modules.js';

const send = (socket, body) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(body));
};
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const roll = count => Array.from({ length: count }, () => randomInt(1, 7));

export function attachRooms(server) {
  const rooms = new Map(), credentials = new Map();
  function snapshot(room, seat) {
    send(seat.socket, { type: 'state', room: room.code, you: seat.id, revision: room.revision,
      online: room.seats.map(s => Boolean(s.socket)), state: project(room.state) });
  }
  function broadcast(room) {
    for (const seat of room.seats) if (seat.socket) snapshot(room, seat);
  }
  function expire() {
    for (const room of rooms.values()) {
      if (room.seats.some(s => s.socket) || Date.now() - room.lastSeen < 3600000) continue;
      for (const seat of room.seats) credentials.delete(seat.key);
      rooms.delete(room.code);
    }
  }
  const sweep = setInterval(expire, 60000).unref();
  server.on('close', () => clearInterval(sweep));
  server.on('connection', socket => {
    let room, seat;
    socket.on('error', () => socket.terminate());
    socket.on('message', (data, binary) => {
      let m;
      try {
        check(!binary, '仅接受 JSON 文本');
        m = JSON.parse(data.toString());
        if (!seat) {
          const keys = { create: ['type','key','name'], join: ['type','key','name','room'], resume: ['type','key','room'] };
          check(m && typeof m.type === 'string' && Object.hasOwn(keys, m.type) && fields(m, keys[m.type]) && uuid(m.key), '入房格式错误');
          if (m.type !== 'create') check(typeof m.room === 'string' && /^[A-F0-9]{8}$/.test(m.room), '房间码无效');
          if (m.type !== 'resume') check(typeof m.name === 'string' && m.name.trim().length > 0 && m.name.length <= 20, '昵称须为 1–20 字');
          const existing = credentials.get(m.key);
          if (existing) {
            check((m.type === 'resume' && m.room === existing.room.code) || existing.handshake === JSON.stringify([m.type,m.room,m.name]), '席位凭证不匹配');
            ({ room, seat } = existing);
          } else {
            check(m.type !== 'resume', '席位已失效');
            if (m.type === 'create') {
              check(rooms.size < 100, '本机房间已满');
              let code;
              do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
              room = { code, revision: 1, state: lobby(m.name.trim()), seats: [], lastSeen: Date.now() };
              rooms.set(code, room);
            } else {
              room = rooms.get(m.room);
              check(room, '找不到房间');
              room.state = join(room.state, m.name.trim());
              room.revision++;
            }
            seat = { id: room.seats.length, key: m.key, socket: null, receipts: new Map() };
            room.seats.push(seat);
            credentials.set(m.key, { room, seat, handshake: JSON.stringify([m.type,m.room,m.name]) });
          }
          seat.socket?.close(4001, 'seat resumed');
          seat.socket = socket;
          broadcast(room);
          return;
        }
        check(seat.socket === socket, '席位已在另一连接恢复');
        check(fields(m, ['type','id','revision','command']) && m.type === 'act' && uuid(m.id)
          && Number.isSafeInteger(m.revision) && m.revision > 0, '命令信封错误');
        const fingerprint = JSON.stringify([m.revision,m.command]);
        const receipt = seat.receipts.get(m.id);
        if (receipt) {
          check(receipt.fingerprint === fingerprint, '请求编号已用于其他命令');
          send(socket, receipt.ack);
          snapshot(room, seat);
          return;
        }
        check(m.revision === room.revision, '状态版本已更新');
        if (m.command?.kind === 'start' || room.state.phase !== 'lobby') {
          check(room.seats.every(s => s.socket), '等待离线玩家重连');
        }
        let outcomes = [];
        if (m.command?.kind === 'start' && room.state.players.length === 2) outcomes = roll(8);
        if (m.command?.kind === 'roll' && room.state.phase === 'roll' && room.state.game.actor === seat.id)
          outcomes = roll(room.state.game.hands[seat.id].length);
        // Synchronous check, reduce and commit: no await between revision check and receipt.
        room.state = transition(room.state, seat.id, m.command, outcomes);
        room.revision++;
        const ack = { type: 'ack', id: m.id, revision: room.revision };
        seat.receipts.set(m.id, { fingerprint, ack });
        if (seat.receipts.size > 256) seat.receipts.delete(seat.receipts.keys().next().value);
        send(socket, ack);
        broadcast(room);
      } catch (error) {
        send(socket, { type: 'error', id: uuid(m?.id) ? m.id : null, message: error instanceof SyntaxError ? '无效 JSON' : error.message });
        if (seat && seat.socket === socket) snapshot(room, seat);
      }
    });
    socket.on('close', () => {
      if (seat && seat.socket === socket) {
        seat.socket = null;
        room.lastSeen = Date.now();
        broadcast(room);
      }
    });
  });
}
