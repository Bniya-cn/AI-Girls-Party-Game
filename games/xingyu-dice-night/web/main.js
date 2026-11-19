import './style.css';
import { artUrl } from './art.js';
import { roomClient } from './transport.js';
import { faces } from '../rules/modules.js';

document.documentElement.style.setProperty('--evening','url("'+artUrl('evening')+'")');
for(const image of document.querySelectorAll('[data-art]')) image.src=artUrl(image.dataset.art);
const $=id=>document.getElementById(id);
const venues=['星港咖啡角','月光阅读角','星穹温室','云端音乐室','日落画室','夜航观星台'];
const roles=['deepseek','claude','gemini','gpt','qwen'];
const phaseNames={lobby:'候场',roll:'掷骰',select:'落骰',gray:'灰骰板',complete:'轮末'};
const el=(tag,content,cls)=>{
  const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(cls)node.className=cls;return node;
};
const art=(name,cls)=>{const img=el('img',undefined,cls);img.src=artUrl(name);img.alt='';return img;};
function button(parent,label,action,{disabled=false,cls='glass',pressed}={}){
  const b=el('button',label,cls);b.type='button';b.disabled=disabled;
  if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));
  b.onclick=action;parent.append(b);return b;
}
for(const dialog of document.querySelectorAll('dialog')){
  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{
    const r=dialog.getBoundingClientRect();
    if(e.target===dialog && (e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();
  });
}
let latest=null,render3D,loading3D=false,entryMode='create',viewVenue=1,group=0,lastView=null;
let lastPhase=null, transient='',timer;
const targets=venues.map((name,i)=>{
  const b=el('button',undefined,'venue');b.type='button';b.style.setProperty('--picture','url("'+artUrl('venue-'+(i+1))+'")');
  b.append(el('span',String(i+1),'face-number'),el('span',name,'venue-name'),el('span','','quantity'));
  b.onclick=()=>chooseVenue(i+1);$('targets').append(b);return b;
});
function showNotice(){
  const msg=latest?.message||transient;
  $('notice').textContent=msg||'';$('notice').hidden=!msg;
}
function toast(msg){transient=msg;showNotice();clearTimeout(timer);timer=setTimeout(()=>{transient='';showNotice();},2300);}
function openEntry(mode){
  entryMode=mode;$('entry-title').textContent=mode==='create'?'在星屿开一桌':'凭房间码入座';
  $('enter').textContent=mode==='create'?'创建房间':'加入房间';$('room-input').hidden=mode==='create';$('code').required=mode==='join';
  $('entry-dialog').showModal();$('name').focus();
}
$('create').onclick=()=>openEntry('create');$('join').onclick=()=>openEntry('join');
$('entry').onsubmit=e=>{
  e.preventDefault();const name=$('name').value.trim();
  if(!name){$('name').value='';$('name').reportValidity();return;}
  $('entry-dialog').close();client.enter(entryMode,name,$('code').value.trim().toUpperCase());
};
$('name').value=sessionStorage.getItem('star-dice-nickname')||'';
$('settings').onclick=()=>{renderOptions();$('settings-dialog').showModal();};
$('code-copy').onclick=async()=>{try{await navigator.clipboard.writeText(latest.view.room);toast('房间码已复制');}catch{toast('房间码 '+latest.view.room);}};
$('recover').onclick=()=>client.reset();
function actionable(){
  const p=latest,v=p?.view;
  return !!v&&p.online&&!p.pending&&!v.online.includes(false)&&v.state.game?.actor===v.you;
}
function legal(n){
  const s=latest.view.state;
  return actionable() && ((s.phase==='select'&&s.game.roll.some(d=>d.face===n)) || s.phase==='gray');
}
function chooseVenue(n){
  const s=latest.view.state;
  if(legal(n)){client.act(s.phase==='gray'?{kind:'gray',group,venue:n}:{kind:'place',face:n});return;}
  viewVenue=n;renderDetail();$('venue-dialog').showModal();
}
function renderDetail(){
  const s=latest.view.state,dice=s.game?.venues[viewVenue-1]||[];
  $('detail-art').src=artUrl('venue-'+viewVenue);$('venue-title').textContent=viewVenue+'号 · '+venues[viewVenue-1];
  const box=$('venue-detail');box.replaceChildren();
  if(!dice.length)box.append(el('p','场内暂无骰子。'));
  for(const owner of new Set(dice.map(d=>d.owner))){
    const owned=dice.filter(d=>d.owner===owner),name=s.players[owner]?.name || (owner==='gray'?'灰骰阵营':'中立阵营');
    box.append(el('p',name+'　'+owned.length+' 颗 · 实力 '+owned.reduce((a,d)=>a+(d.big?2:1),0)));
  }
  if(s.config.modules.some(m=>m.venue===viewVenue))box.append(el('p','F1 灰骰板'+(s.game?' · 余组 '+(s.game.groups.filter(Boolean).join(' / ')||'已取尽'):'')));
}
function renderOptions(){
  const {view,online,pending}=latest,s=view.state,box=$('options'),cfg=s.config,f1=cfg.modules[0]?.venue||0;
  box.replaceChildren();
  function choices(label,values,selected,change){
    const set=el('fieldset');set.append(el('legend',label));
    for(const [v,title] of values)button(set,title,()=>change(v),{disabled:!online||pending,cls:'choice',pressed:v===selected});
    box.append(set);
  }
  const configure=(seats,venue)=>client.act({kind:'configure',config:{seats,modules:venue?[{face:'F1',venue}]:[]}});
  choices('座位上限',[2,3,4,5].filter(n=>n>=s.players.length).map(n=>[n,n+'人']),cfg.seats,n=>configure(n,f1));
  const tile=el('div',undefined,'module-heading');tile.append(art('f1'),el('h3','灰骰板 · F1'));box.append(tile);
  choices('拼接位置',[[0,'关闭'],...venues.map((_,i)=>[i+1,(i+1)+'号'])],f1,n=>configure(cfg.seats,n));
  const details=el('details');details.append(el('summary','尚未上线的扩展（15）'),el('p',Object.values(faces).filter(f=>!f.enabled).map(f=>f.id+' '+f.name).join(' · ')));
  box.append(details);
}
function renderSeats(v){
  const s=v.state,container=$('seats');container.replaceChildren();
  for(let i=0;i<s.config.seats;i++){
    const p=s.players[i],seat=el('div',undefined,'seat'+(!p?' vacant':'')+(s.game?.actor===i?' active':''));
    seat.dataset.pos=i;
    const img=art(p?'seat-'+roles[i]:'back','portrait');
    const info=el('div',undefined,'seat-info');
    info.append(el('strong',p?(p.name+(i===v.you?' · 你':'')):'空席'),
      el('small',!p?'待入座':!v.online[i]?'已离线':s.phase==='lobby'?(p.ready?'已准备':(i===0?'房主':'未准备')):s.game.remaining[i]+' 骰 · '+s.game.chips[i]+' 筹'));
    seat.append(img,info);container.append(seat);
  }
}
function renderHUD(v,blocked){
  const s=v.state,g=s.game,actions=$('actions');actions.replaceChildren();
  actions.classList.toggle('ended',s.phase==='complete');
  $('phase-label').textContent='单轮投放　/　'+phaseNames[s.phase];
  let title='',hint='';
  const act=(label,cmd,disabled=false,cls='primary')=>button(actions,label,()=>client.act(cmd),{disabled,cls});
  if(s.phase==='lobby'){
    const ready=s.players[v.you].ready;
    title=s.players.length===1?'等朋友入座':'桌边集合';hint=s.players.length===1?'把右上角的房间码发给朋友。':'全员准备后，由房主开始。';
    if(s.players.length===1)actions.append(art('empty','empty-art'));
    act(ready?'取消准备':'准备入座',{kind:'ready',value:!ready},blocked,ready?'glass':'primary');
    if(v.you===0)act('开局',{kind:'start'},blocked||s.players.length<2||v.online.includes(false)||!s.players.every(p=>p.ready));
  }else if(s.phase==='complete'){
    title='本轮投放完成';hint='轻点场地查看各阵营实力。';actions.append(art('ribbons','ribbons'));
    button(actions,'回到大厅',()=>client.reset(),{cls:'primary'});
  }else{
    const mine=g.actor===v.you,locked=!actionable();title=mine?'轮到你了':s.players[g.actor].name+' 的回合';
    if(s.phase==='roll'){hint='掷出手中全部骰子。';if(mine)act('掷骰　×'+g.remaining[v.you],{kind:'roll'},locked);}
    if(s.phase==='select'){
      hint=mine?'点亮的场地可接收整组同点骰。':'等待选择场地。';
      const tray=el('div',undefined,'roll-tray');tray.setAttribute('aria-label','本次骰面');
      for(const d of g.roll)tray.append(el('span',String(d.face),d.big?'big':''));
      actions.append(tray);
      if(mine){const b=act('跳过 · 1筹码',{kind:'pass'},locked||!g.chips[v.you],'glass');b.prepend(art('chip','chip-icon'));}
    }
    if(s.phase==='gray'){
      hint=mine?'选一组灰骰，再点目标场地。':'等待灰骰落位。';
      if(!g.groups[group])group=g.groups.findIndex(n=>n>0);
      const groups=el('div',undefined,'groups');actions.append(groups);
      g.groups.forEach((n,i)=>{if(n)button(groups,'×'+n,()=>{group=i;renderHUD(v,blocked);},{disabled:locked,cls:'choice',pressed:group===i});});
    }
    if(v.online.includes(false))hint='席位离线，等待原玩家重连。';
  }
  $('turn-title').textContent=title;$('hint').textContent=hint;
}
function render(packet){
  latest=packet;const {view,online,pending,saved}=packet;
  $('lobby').hidden=!!view;$('room').hidden=!view;$('recover').hidden=!saved||online;
  $('create').disabled=$('join').disabled=saved;showNotice();
  if(!view){lastView=null;lastPhase=null;document.body.classList.remove('playing');return;}
  document.body.classList.add('playing');
  const s=view.state;
  sessionStorage.setItem('star-dice-nickname',s.players[view.you].name);
  $('code-copy').textContent='房间 '+view.room+'　⧉';
  $('settings').hidden=view.you!==0||s.phase!=='lobby';
  if($('settings-dialog').open){if($('settings').hidden)$('settings-dialog').close();else renderOptions();}
  if($('venue-dialog').open)renderDetail();
  if(lastPhase!==s.phase && s.phase==='gray')group=s.game.groups.findIndex(n=>n>0);
  lastPhase=s.phase;
  renderSeats(view);renderHUD(view,!online||pending);
  targets.forEach((b,i)=>{
    const n=i+1,valid=legal(n),tile=s.config.modules.some(m=>m.venue===n);
    b.classList.toggle('legal',valid);b.classList.toggle('attached',tile);
    const rollCount=s.phase==='select'?s.game.roll.filter(d=>d.face===n).length:0;
    const num=s.game?.venues[i].length||0;
    b.lastChild.textContent=valid?(s.phase==='gray'?'放灰骰':'落骰 ×'+rollCount):num?num+' 颗':'';
    b.setAttribute('aria-label',n+'号 '+venues[i]+(valid?'，可投放':'，查看场地')+(tile?'，灰骰板':''));
  });
  if(lastView!==s){render3D?.(s);lastView=s;}
  if(!loading3D){loading3D=true;import('./table.js').then(({makeTable})=>{
    render3D=makeTable($('stage'),targets);if(latest.view)render3D(latest.view.state);
  }).catch(()=>toast('已切换为平面牌桌，操作方式相同'));}
}
const client=roomClient(render);client.connect();
