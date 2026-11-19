import './style.css';
import { artUrl } from './art.js';
import { roomClient } from './transport.js';
import { guidedHint, lessons } from './tutorial.js';
import { boards, sample, boardName, pickTable, boardStatus, eventText, viewJournal, moduleBadge, arrangement } from './royale-ui.js';
import { faces } from '../rules/modules.js';

document.documentElement.style.setProperty('--evening','url("'+artUrl('evening')+'")');
for(const image of document.querySelectorAll('[data-art]')) image.src=artUrl(image.dataset.art);
const $=id=>document.getElementById(id);
const venues=['星港咖啡角','月光阅读角','星穹温室','云端音乐室','日落画室','夜航观星台'];
const roles=['deepseek','claude','gemini','gpt','qwen'];
const phaseNames={decision:'拼板行动',lobby:'候场',roll:'掷骰',select:'落骰',gray:'灰骰板',between:'轮末',complete:'终局'};
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
let guideOn = sessionStorage.getItem('star-guide-active') === 'on', lesson=0;
function setGuide(enabled) {
  guideOn=enabled;
  localStorage.setItem('star-guide-preference', enabled?'on':'off');
  sessionStorage.setItem('star-guide-active', enabled?'on':'off');
}
function practice(f1=false) {
  const name = $('name').value.trim() || sessionStorage.getItem('star-dice-nickname') || '旅行者';
  if (latest?.view) client.reset();
  setGuide(localStorage.getItem('star-guide-preference') !== 'off');
  client.enter('practice',name,undefined,f1);
}
function lessonPage(index) {
  lesson=index;
  $('lesson-page').textContent='玩法教程　'+(index+1)+' / '+lessons.length;
  [$('lesson-name').textContent,$('lesson-content').textContent]=lessons[index];
  $('lesson-prev').disabled=index===0;
  $('lesson-next').disabled=index===lessons.length-1;
  $('guide-start').textContent=latest?.view?'开启桌边指引':index===lessons.length-1?'跟着练 · 灰骰板':'跟着练 · 基础桌';
}
function openHelp(){lessonPage(0);$('help-dialog').showModal();}
$('practice').onclick=()=>practice();
$('sample-table').onclick=()=>practice(sample);
$('custom-table').onclick=()=>pickTable(sample,slots=>practice(slots),true);
$('ledger-button').onclick=()=>{const v=latest.view;viewJournal(v.state,v.you);$('ledger-dialog').showModal();};
$('lobby-help').onclick=openHelp;$('room-help').onclick=openHelp;
$('lesson-prev').onclick=()=>lessonPage(lesson-1);
$('lesson-next').onclick=()=>lessonPage(lesson+1);
$('guide-start').onclick=()=>{
  $('help-dialog').close();setGuide(true);
  if(latest.view) render(latest); else practice(lesson===lessons.length-1);
};
$('skip-guide').onclick=()=>{setGuide(false);render(latest);};
$('quit-practice').onclick=()=>{$('exit-dialog').close();client.reset();};
const targets=venues.map((name,i)=>{
  const b=el('button',undefined,'venue');b.type='button';b.style.setProperty('--picture','url("'+artUrl('venue-'+(i+1))+'")');
  b.append(el('span',String(i+1),'face-number'),el('span',name,'venue-name'),el('span','','prize'),el('span','','quantity'));
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
$('code-copy').onclick=async()=>{if(latest.view.practice){$('exit-dialog').showModal();return;}try{await navigator.clipboard.writeText(latest.view.room);toast('房间码已复制');}catch{toast('房间码 '+latest.view.room);}};
$('recover').onclick=()=>client.reset();
function actionable(){
  const p=latest,v=p?.view;
  return !!v&&p.online&&!p.pending&&!v.online.includes(false)&&(v.state.game?.pending?.seat??v.state.game?.actor)===v.you;
}
function legal(n){
  const s=latest.view.state;
  return actionable() && n!==s.game?.boards?.closed && ((s.phase==='select'&&s.game.roll.some(d=>d.face===n)) || s.phase==='gray');
}
function chooseVenue(n){
  const s=latest.view.state;
  if(legal(n)){client.act(s.phase==='gray'?{kind:'gray',group,venue:n}:{kind:'place',face:n});return;}
  viewVenue=n;renderDetail();$('venue-dialog').showModal();
}
const valueLabel=value=>(value/10000)+' 万';
function ownerLabel(s,owner){
  if(Number.isInteger(owner))return s.players[owner].name;
  return owner==='neutral'?'中立骰':owner==='gray'?'灰骰':'无人领取';
}
function awardText(s,award){
  const result=ownerLabel(s,award.owner)+(Number.isInteger(award.owner)?'':' · 归堆');
  return valueLabel(award.value)+' → '+result;
}
function showResults(){
  const s=latest.view.state,g=s.game,final=s.phase==='complete';
  $('result-round').textContent=final?'终局记分　/　三轮完成':'轮末分账　/　第 '+g.round+' 轮';
  const standings=$('standings'),accounts=$('accounts');
  standings.replaceChildren();accounts.replaceChildren();
  if(final){
    const winners=g.scores.filter(row=>row.winner).map(row=>s.players[row.seat].name);
    $('result-title').textContent=winners.join('、')+(winners.length>1?' 并列获胜':' 获胜');
    for(const row of g.scores){
      const line=el('article',undefined,'score-row');
      line.append(el('strong',s.players[row.seat].name),el('b',valueLabel(row.total)),
        el('small',row.cards+' 张奖金牌 · '+valueLabel(row.cash)+'　＋　'+row.chips+' 枚筹码 · '+valueLabel(row.chips*10000)));
      standings.append(line);
    }
  }else{
    $('result-title').textContent='第 '+g.round+' 轮结算';
    standings.append(el('p','下轮先手　'+s.players[g.history.at(-1).nextStarter].name));
  }
  for(const entry of [...g.history].reverse()){
    const details=el('details');details.open=!final && entry.round===g.round;
    details.append(el('summary','第 '+entry.round+' 轮 · 六场明细'));
    entry.venues.forEach((venue,i)=>{
      const tied=venue.ranks.filter(r=>r.tied).map(r=>ownerLabel(s,r.owner));
      details.append(el('p',(i+1)+' 号　'+venue.awards.map(a=>awardText(s,a)).join('　／　')+
        (tied.length?'；同实力退出：'+tied.join('、'):'')));
    });
    for(const e of entry.events??[])details.append(el('p',eventText(e,s)));
    accounts.append(details);
  }
  if(!$('result-dialog').open)$('result-dialog').showModal();
}
$('back-to-table').onclick=()=>$('result-dialog').close();
function renderDetail(){
  const s=latest.view.state,dice=s.game?.venues[viewVenue-1]||[];
  $('detail-art').src=artUrl('venue-'+viewVenue);$('venue-title').textContent=viewVenue+'号 · '+venues[viewVenue-1];
  const box=$('venue-detail');box.replaceChildren();
  if(s.game){
    box.append(el('p','场地奖金　'+s.game.prizes[viewVenue-1].map(valueLabel).join(' / ')));
    if(s.phase==='between'||s.phase==='complete'){
      const entry=s.game.history.at(-1).venues[viewVenue-1];
      box.append(el('p',entry.awards.map(a=>awardText(s,a)).join('　／　')));
    }
  }
  if(!dice.length)box.append(el('p','场内暂无骰子。'));
  for(const owner of new Set(dice.map(d=>d.owner))){
    const owned=dice.filter(d=>d.owner===owner),name=s.players[owner]?.name || (owner==='gray'?'灰骰阵营':'中立阵营');
    box.append(el('p',name+'　'+owned.length+' 颗 · 实力 '+owned.reduce((a,d)=>a+(d.big?2:1),0)));
  }
  const slot=s.config.modules.find(m=>m.venue===viewVenue);
  if(slot)box.append(moduleBadge(slot.face),el('h3',boardName(slot.face)),el('p',boards[slot.face][1]),el('p',boardStatus(slot.face,s)),arrangement(slot.face,s));
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
  choices('座位上限',[2,3,4,5].filter(n=>n>=s.players.length).map(n=>[n,n+'人']),cfg.seats,n=>client.act({kind:'configure',config:{...cfg,seats:n}}));
  const lineup=cfg.modules.map(m=>m.venue+'号 '+boardName(m.face)).join(' · ');
  box.append(el('p',lineup||'基础桌 · 未接扩展'));
  button(box,'挑选拼板',()=>{ $('settings-dialog').close();pickTable(cfg.modules,modules=>client.act({kind:'configure',config:{seats:cfg.seats,mode:'custom',modules}}),false);});
  if(!cfg.mode)choices('经典 F1 练习',[[0,'关闭'],...venues.map((_,i)=>[i+1,(i+1)+'号'])],f1,n=>configure(cfg.seats,n));
  else button(box,'恢复基础桌',()=>configure(cfg.seats,0));
  const details=el('details');details.append(el('summary','尚未上线的三面'),el('p',Object.values(faces).filter(f=>!f.enabled).map(f=>f.id+' '+f.name).join(' · ')));
  box.append(details);
}
function renderSeats(v){
  const s=v.state,container=$('seats');container.replaceChildren();
  for(let i=0;i<s.config.seats;i++){
    const p=s.players[i],seat=el('div',undefined,'seat'+(!p?' vacant':'')+((s.game?.pending?.seat??s.game?.actor)===i?' active':''));
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
  let title='',hint='';
  const act=(label,cmd,disabled=false,cls='primary')=>button(actions,label,()=>client.act(cmd),{disabled,cls});
  if(s.phase==='lobby'){
    const ready=s.players[v.you].ready;
    title=s.players.length===1?'等朋友入座':'桌边集合';hint=s.players.length===1?'把右上角的房间码发给朋友。':'全员准备后，由房主开始。';
    if(s.players.length===1)actions.append(art('empty','empty-art'));
    act(ready?'取消准备':'准备入座',{kind:'ready',value:!ready},blocked,ready?'glass':'primary');
    if(v.you===0)act('开局',{kind:'start'},blocked||s.players.length<2||v.online.includes(false)||!s.players.every(p=>p.ready));
  }else if(s.phase==='between'){
    title='第 '+g.round+' 轮已结算';hint='下轮先手：'+s.players[g.history.at(-1).nextStarter].name;
    button(actions,'查看分账',showResults);
    if(v.you===0)act('进入第 '+(g.round+1)+' 轮',{kind:'nextRound'},blocked||v.online.includes(false));
  }else if(s.phase==='complete'){
    title='三轮对局完成';hint='查看总分与每轮的场地明细。';button(actions,'终局记分',showResults);actions.append(art('ribbons','ribbons'));
    if(v.practice)button(actions,'再玩一局',()=>practice(s.config.mode==='custom'?s.config.modules:s.config.modules.length>0),{cls:'primary'});
    button(actions,'回到大厅',()=>client.reset(),{cls:'primary'});
  }else{
    const mine=g.actor===v.you,locked=!actionable();title=mine?'轮到你了':s.players[g.actor].name+' 的回合';
    if(s.phase==='roll'){hint='掷出手中全部骰子。';if(mine)act('掷骰　×'+g.remaining[v.you],{kind:'roll'},locked);}
    if(mine && g.power?.length)button(actions,'使用领先令牌',()=>{
      const box=$('power-options');box.replaceChildren();
      for(const o of g.power)button(box,o.label,()=>{$('power-dialog').close();client.act({kind:'power',key:o.key});});
      $('power-dialog').showModal();
    },{disabled:locked});
    if(s.phase==='decision'){
      const p=g.pending;
      actions.append(arrangement(p.face,s));
      title=boardName(p.face);hint=p.prompt;
      if(p.seat===v.you){
        const options=el('div',undefined,'mini-choices');
        options.setAttribute('aria-label',p.prompt);actions.append(options);
        for(const o of p.options)button(options,o.label,()=>client.act({kind:'decide',id:p.id,key:o.key}),{disabled:locked,cls:'choice'});
      }else if(p.committed)hint+=' · 你已藏 '+p.committed+' 枚';
    }
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
  $('turn-title').textContent=title;
  $('hint').textContent=guideOn && s.phase!=='decision' && !v.online.includes(false) ? guidedHint(v) : hint;
  const last=g?.events?.at(-1);
  if(last && s.phase!=='decision')$('hint').append(el('span','　'+eventText(last,s),'event-line'));
  $('skip-guide').hidden=!guideOn;
  $('phase-label').textContent=(g?'第 '+g.round+' / 3 轮':'三轮对局')+(guideOn?' · 指引':'')+'　/　'+phaseNames[s.phase];
}
function render(packet){
  latest=packet;const {view,online,pending,saved}=packet;
  $('lobby').hidden=!!view;$('room').hidden=!view;$('recover').hidden=!saved||online;
  $('sample-table').disabled=$('custom-table').disabled=$('practice').disabled=$('lobby-help').disabled=$('create').disabled=$('join').disabled=saved;showNotice();
  if(!view){lastView=null;lastPhase=null;document.body.classList.remove('playing');return;}
  document.body.classList.add('playing');
  const s=view.state;
  sessionStorage.setItem('star-dice-nickname',s.players[view.you].name);
  $('code-copy').textContent=view.practice?'退出练习':'房间 '+view.room+'　⧉';
  $('code-copy').title=view.practice?'退出练习':'复制房间码';
  $('ledger-button').hidden=!s.game?.boards;
  if($('ledger-dialog').open)viewJournal(s,view.you);
  $('settings').hidden=view.you!==0||s.phase!=='lobby';
  if($('settings-dialog').open){if($('settings').hidden)$('settings-dialog').close();else renderOptions();}
  if($('venue-dialog').open)renderDetail();
  if(lastPhase!==s.phase && s.phase==='gray')group=s.game.groups.findIndex(n=>n>0);
  if(s.phase==='complete' && lastPhase!=='complete')showResults();
  if(s.phase==='roll' && $('result-dialog').open)$('result-dialog').close();
  lastPhase=s.phase;
  renderSeats(view);renderHUD(view,!online||pending);
  targets.forEach((b,i)=>{
    const n=i+1,valid=legal(n),slot=s.config.modules.find(m=>m.venue===n),tile=!!slot;
    const last=s.game?.events?.at(-1);
    b.classList.toggle('deciding',!!slot && slot.face===s.game?.pending?.face);
    const salary=s.game?.events?.findLast(e=>e.face==='D1' && e.venues);
    b.classList.toggle('income',!!salary && last?.face==='D1' && last.id<=salary.id+1 && salary.venues.includes(n));
    b.dataset.face=slot?.face||'';b.classList.toggle('closed',n===s.game?.boards?.closed);
    const current=b.querySelector('.board-art');if(current?.dataset.face!==slot?.face){current?.remove();if(slot){const icon=moduleBadge(slot.face);icon.dataset.face=slot.face;b.prepend(icon);}}
    b.classList.toggle('legal',valid);b.classList.toggle('attached',tile);
    const rollCount=s.phase==='select'?s.game.roll.filter(d=>d.face===n).length:0;
    const num=s.game?.venues[i].length||0;
    const prize=b.querySelector('.prize');
    prize.textContent=s.game?s.game.prizes[i].map(value=>value/10000).join(' / ')+' 万':'';
    b.lastChild.textContent=valid?(s.phase==='gray'?'放灰骰':'落骰 ×'+rollCount):num?num+' 颗':'';
    b.setAttribute('aria-label',n+'号 '+venues[i]+(valid?'，可投放':'，查看场地')+(tile?'，'+boardName(slot.face):'')+(s.game?'，奖金 '+prize.textContent:''));
  });
  if(lastView!==s){render3D?.(s);lastView=s;}
  if(!loading3D){loading3D=true;import('./table.js').then(({makeTable})=>{
    render3D=makeTable($('stage'),targets);if(latest.view)render3D(latest.view.state);
  }).catch(()=>toast('已切换为平面牌桌，操作方式相同'));}
}
const client=roomClient(render);client.connect();
