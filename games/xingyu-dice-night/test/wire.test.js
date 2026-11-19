import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { gameServer } from '../server/http.js';

async function client(port,hello) {
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/room');
  const queue=[],waiters=new Set();
  socket.on('message', bytes=>{
    queue.push(JSON.parse(bytes));
    for(const notify of waiters) notify();
  });
  await once(socket,'open');
  const send=m=>socket.send(JSON.stringify(m));
  send(hello);
  function read(match) {
    return new Promise((ok,fail)=>{
      const timer=setTimeout(()=>{waiters.delete(check);fail(new Error('timed out waiting for '+match));},2500);
      function check() {
        const i=queue.findIndex(match);
        if(i<0) return;
        clearTimeout(timer); waiters.delete(check);ok(queue.splice(i,1)[0]);
      }
      waiters.add(check);check();
    });
  }
  return {send,read,socket, state:(rev,condition=()=>true)=>read(m=>m.type==='state' && m.revision===rev && condition(m))};
}
const msg=(revision,command)=>({type:'act',id:randomUUID(),revision,command});
async function apply(client,revision,command) {
  const m=msg(revision,command);client.send(m);
  const ack=await client.read(x=>x.id===m.id);
  assert.equal(ack.type,'ack',ack.message);
  return client.state(ack.revision);
}
async function rejects(client,m,reason) {
  client.send(m);
  const error=await client.read(x=>x.type==='error' && x.id===m.id);
  assert.match(error.message,reason);
}

test('two real WS clients: create/join, host permissions, revisions, replay, takeover, disconnect/resume, finish',async t=>{
  const service=gameServer(); const port=await service.listen(0); t.after(()=>service.close());
  const hostKey=randomUUID(), guestKey=randomUUID();
  const a=await client(port,{type:'create',key:hostKey,name:'甲'});
  const created=await a.state(1), code=created.room;
  const hello={type:'join',key:guestKey,name:'乙',room:code};
  const b=await client(port,hello);
  const joined=await a.state(2);
  assert.equal((await b.state(2)).you,1);
  assert.doesNotMatch(JSON.stringify(joined),new RegExp(hostKey+'|'+guestKey));
  await rejects(b,msg(2,{kind:'configure',config:{seats:2,modules:[]}}),/房主/);
  await rejects(a,msg(2,{kind:'configure',config:{seats:2,modules:[{face:'A1',venue:1}]}}),/尚未/);
  await apply(a,2,{kind:'configure',config:{seats:2,modules:[{face:'F1',venue:1}]}});
  await apply(a,3,{kind:'ready',value:true});
  await rejects(b,msg(3,{kind:'ready',value:true}),/版本/);
  await apply(b,4,{kind:'ready',value:true});
  await apply(a,5,{kind:'start'});
  await rejects(b,msg(6,{kind:'roll'}),/轮到/);
  await rejects(a,msg(6,{kind:'roll',dice:[6]}),/格式/);
  const request=msg(6,{kind:'roll'}); a.send(request);
  const ack=await a.read(m=>m.type==='ack' && m.id===request.id);
  const first=await a.state(7), other=await b.state(7);
  assert.deepEqual(first.state,other.state);
  assert.equal(first.state.game.roll.length,8);
  a.socket.close();await b.state(7,m=>!m.online[0]);
  await rejects(b,msg(7,{kind:'place',face:1}),/重连/);
  const wrong=await client(port,{type:'resume',room:code,key:randomUUID()});
  assert.match((await wrong.read(m=>m.type==='error')).message,/失效/);
  const resumed=await client(port,{type:'resume',room:code,key:hostKey});
  assert.deepEqual((await resumed.state(7)).state,first.state);
  resumed.send(request);
  assert.deepEqual(await resumed.read(m=>m.type==='ack'),ack);
  assert.deepEqual((await resumed.state(7)).state,first.state);
  await rejects(resumed,{...request,command:{kind:'pass'}},/编号/);
  const peer=await client(port,hello);
  assert.equal((await peer.state(7)).you,1);
  let current=first;
  for(let steps=0;current.state.phase!=='complete' && steps<70;steps++){
    const g=current.state.game,actor=g.actor===0?resumed:peer;
    const cmd={roll:()=>({kind:'roll'}),select:()=>({kind:'place',face:g.roll[0].face}),
      gray:()=>({kind:'gray',group:g.groups.findIndex(n=>n>0),venue:2})}[current.state.phase]();
    current=await apply(actor,current.revision,cmd);
  }
  assert.equal(current.state.phase,'complete');
  assert.deepEqual(current.state.game.remaining,[0,0]);
  assert.deepEqual((await (current.you===0?peer:resumed).state(current.revision)).state,current.state);
});

test('built entry and JS are served by the same loopback server; cross-origin upgrade rejected',async t=>{
  const service=gameServer(), port=await service.listen(0);t.after(()=>service.close());
  assert.equal(service.server.address().address,'127.0.0.1');
  const base='http://127.0.0.1:'+port;
  const response=await fetch(base);assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/星屿骰夜/);
  const js=html.match(/src="([^"]+\.js)"/)[1];
  const bundle=await fetch(base+js);assert.equal(bundle.status,200);assert.match(bundle.headers.get('content-type'),/javascript/);
  assert.equal((await fetch(base+'/server/rooms.js')).status,404);
  const foreign=new WebSocket(base.replace('http:','ws:')+'/room',{origin:'https://example.invalid'});
  await once(foreign,'error');
});

test('installed WebP artwork is served byte-for-byte with the correct type',async t=>{
  const { readdir,readFile }=await import('node:fs/promises');
  const { buildRoot }=await import('../server/build-root.js');
  const folder=new URL('art/',buildRoot);
  const names=await readdir(folder).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
  const service=gameServer(),port=await service.listen(0);t.after(()=>service.close());
  if(!names.length){
    const entry=await fetch('http://127.0.0.1:'+port);
    assert.equal(entry.status,200);
    assert.doesNotMatch(await entry.text(),/src="\/art\//);
  }
  for(const name of names.filter(n=>n.endsWith('.webp'))){
    const response=await fetch('http://127.0.0.1:'+port+'/art/'+name);
    assert.equal(response.status,200,name);assert.equal(response.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.deepEqual(bytes,await readFile(new URL(name,folder)));
  }
});
