const sessionKey = 'star-isles-seat-v1';
export function roomClient(onChange) {
  let saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  let socket, timer, view = null, online = false, message = '';
  const persist = () => sessionStorage.setItem(sessionKey, JSON.stringify(saved));
  const notify = () => onChange({ view, online, pending: !!saved?.pending, saved: !!saved, message });
  function connect() {
    if (!saved) { notify(); return; }
    const current = new WebSocket('ws://' + location.host + '/room');
    socket = current;
    let first = true, retry = true;
    current.onopen = () => { if (current === socket && saved) current.send(JSON.stringify(saved.hello)); };
    current.onmessage = event => {
      if (current !== socket) return;
      const m = JSON.parse(event.data);
      if (m.type === 'state') {
        view = m; online = true;
        if (first) message = '';
        saved.hello = { type:'resume', key:saved.hello.key, room:m.room };
        persist();
        if (first && saved.pending) current.send(JSON.stringify(saved.pending));
        first = false;
      } else if (m.type === 'ack' || m.type === 'error') {
        if (m.id && saved.pending?.id === m.id) { saved.pending = null; persist(); }
        message = m.type === 'error' ? m.message : '';
        if (first && m.type === 'error') { retry = false; current.close(); }
      }
      notify();
    };
    current.onclose = event => {
      if (current !== socket) return;
      online = false;
      if (event.code === 4001) { retry = false; message = '该席位已在另一连接恢复'; }
      if (retry) { message = '连接中断，正在恢复原席位…'; timer = setTimeout(connect,1200); }
      notify();
    };
    notify();
  }
  return { connect,
    enter(type,name,room, f1=false) {
      saved = { hello: { type, name, key:crypto.randomUUID(), ...(type==='join'?{room}:{}), ...(type==='practice'?(Array.isArray(f1)?{modules:f1}:{f1}):{}) }, pending:null };
      message='连接中…'; persist(); connect();
    },
    reset() {
      clearTimeout(timer);
      const old=socket; socket=null;
      if (view?.practice && old?.readyState === WebSocket.OPEN) old.send(JSON.stringify({type:'leavePractice'}));
      old?.close();
      saved=null; view=null; online=false; message=''; persist(); notify();
    },
    act(command) {
      if (!online || !view || saved.pending || socket?.readyState !== WebSocket.OPEN) return;
      saved.pending={type:'act',id:crypto.randomUUID(),revision:view.revision,command};
      message=''; persist(); socket.send(JSON.stringify(saved.pending)); notify();
    }
  };
}
