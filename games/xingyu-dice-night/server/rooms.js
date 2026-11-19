import { randomLayout } from '../rules/royale.js';
import { shuffledDeck } from '../rules/payout.js';
import { randomBytes, randomInt } from 'node:crypto';
import { practiceState, computerAction, computerSeat, decider } from './practice.js';
import { WebSocket } from 'ws';
import { lobby, join, transition, project } from '../rules/engine.js';
import { check, fields } from '../rules/modules.js';

const send = (socket, body) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(body));
};
const uuid = value => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);


export function attachRooms(server, {botDelayMs=650, randomIndex=randomInt}={}) {
  const roll=count=>Array.from({length:count},()=>1+randomIndex(6));
  const rooms = new Map(), credentials = new Map();
  const present = seat => seat.bot || Boolean(seat.socket);
  function cancelComputer(room) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
  function removeRoom(room) {
    cancelComputer(room);
    for (const seat of room.seats) if (!seat.bot) credentials.delete(seat.key);
    rooms.delete(room.code);
  }
  function apply(room, actor, command) {
    let outcomes = [];
    if (['start','nextRound'].includes(command?.kind) && room.state.players.length === 2) outcomes = roll(8);
    if (command?.kind === 'roll' && room.state.phase === 'roll' && room.state.game.actor === actor)
      outcomes = roll(room.state.game.hands[actor].length);
    room.state = transition(room.state, actor, command, outcomes, command?.kind==='start'?shuffledDeck(randomIndex):undefined,roll(4), ['start','nextRound'].includes(command?.kind) && room.state.config.mode==='shuffle'?randomLayout(randomIndex):undefined);
    room.revision++;
  }
  function scheduleComputer(room) {
    if (!room.practice || room.botTimer || !room.seats[0]?.socket || decider(room.state) !== computerSeat) return;
    const revision = room.revision;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (rooms.get(room.code) !== room || !room.seats[0]?.socket || room.revision !== revision) return;
      const command = computerAction(room.state,randomIndex);
      if (!command) return;
      apply(room, computerSeat, command);
      broadcast(room);
    }, botDelayMs).unref();
  }
  function snapshot(room, seat) {
    send(seat.socket, { type: 'state', room: room.code, you: seat.id, revision: room.revision,
      practice: Boolean(room.practice), online: room.seats.map(present), state: project(room.state,seat.id) });
  }
  function broadcast(room) {
    for (const seat of room.seats) if (seat.socket) snapshot(room, seat);
    scheduleComputer(room);
  }
  function expire() {
    for (const room of rooms.values()) {
      if (room.seats.some(s => s.socket) || Date.now() - room.lastSeen < 3600000) continue;
      removeRoom(room);
    }
  }
  const sweep = setInterval(expire, 60000).unref();
  server.on('close', () => { clearInterval(sweep); for (const room of rooms.values()) cancelComputer(room); });
  server.on('connection', socket => {
    let room, seat;
    socket.on('error', () => socket.terminate());
    socket.on('message', (data, binary) => {
      let m;
      try {
        check(!binary, '仅接受 JSON 文本');
        m = JSON.parse(data.toString());
        if (!seat) {
          const keys = { practice:['type','key','name',m?.setup!==undefined?'setup':m?.modules!==undefined?'modules':'f1'], create: ['type','key','name'], join: ['type','key','name','room'], resume: ['type','key','room'] };
          check(m && typeof m.type === 'string' && Object.hasOwn(keys, m.type) && fields(m, keys[m.type]) && uuid(m.key), '入房格式错误');
          if (m.type === 'practice') check((fields(m.setup,['mode','modules']) && ['shuffle','lesson','custom'].includes(m.setup.mode)) || Array.isArray(m.modules) || typeof m.f1 === 'boolean', '练习配置错误');
          if (m.type === 'resume' || m.type === 'join') check(typeof m.room === 'string' && /^[A-F0-9]{8}$/.test(m.room), '房间码无效');
          if (m.type !== 'resume') check(typeof m.name === 'string' && m.name.trim().length > 0 && m.name.length <= 20, '昵称须为 1–20 字');
          const handshake = JSON.stringify([m.type,m.room,m.name,m.setup??m.modules??m.f1]);
          const existing = credentials.get(m.key);
          if (existing) {
            check((m.type === 'resume' && m.room === existing.room.code) || existing.handshake === handshake, '席位凭证不匹配');
            ({ room, seat } = existing);
          } else {
            check(m.type !== 'resume', '席位已失效');
            if (m.type === 'create' || m.type === 'practice') {
              check(rooms.size < 100, '本机房间已满');
              let code;
              do { code = randomBytes(4).toString('hex').toUpperCase(); } while (rooms.has(code));
              const practice = m.type === 'practice';
              const state = practice ? practiceState(m.name.trim(), m.setup??m.modules??m.f1, roll(8), shuffledDeck(randomIndex),randomIndex) : lobby(m.name.trim());
              room = { code, revision: 1, state, practice, seats: [], lastSeen: Date.now() };
              rooms.set(code, room);
            } else {
              room = rooms.get(m.room);
              check(room && !room.practice, '找不到可加入的房间');
              room.state = join(room.state, m.name.trim());
              room.revision++;
            }
            seat = { id: room.seats.length, key: m.key, socket: null, receipts: new Map() };
            room.seats.push(seat);
            if (room.practice) room.seats.push({ id:computerSeat, bot:true, socket:null });
            credentials.set(m.key, { room, seat, handshake });
          }
          seat.socket?.close(4001, 'seat resumed');
          seat.socket = socket;
          broadcast(room);
          return;
        }
        check(seat.socket === socket, '席位已在另一连接恢复');
        if (room.practice && fields(m, ['type']) && m.type === 'leavePractice') {
          removeRoom(room);
          seat.socket = null;
          socket.close(1000);
          return;
        }
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
          check(room.seats.every(present), '等待离线玩家重连');
        }
        apply(room, seat.id, m.command);
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
        if (room.practice) cancelComputer(room);
        broadcast(room);
      }
    });
  });
}
