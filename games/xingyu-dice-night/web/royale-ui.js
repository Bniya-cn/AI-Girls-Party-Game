import { artUrl } from './art.js';
export const boards={
 A1:['藏星猜拳','藏 1–3 枚，由左手边的玩家猜。猜错才给藏方奖励。'],
 A2:['星光奖池','额外两骰同点或合计 7 即领奖，否则奖池升一格。'],
 B1:['压轴加骰','轮末本场头奖席可将 0–2 颗黑骰放到对应场地，再结算整桌。'],
 B2:['猜高猜低','先掷两骰，再猜下次合计更高或更低；相等也输。随时收手领当前格。'],
 C1:['五星时刻','首位入场后达到至少 5 点实力的玩家获令牌，轮末领 10 万。'],
 D1:['星屿发薪日','每个有己骰的主场算一处。1／2 处领筹码，3–6 处领对应万元。'],
 D2:['领跑特权','入场且独自领先可持标。保持领先时每回合可用一骰定面，落点正常触发。'],
 E1:['此路暂封','选另一个场地封锁进出。改变封场才推进奖励轨，留在原地没有奖励。'],
 E2:['吧台歇脚','对手从手中交一骰到吧台，每席最多两颗。随后收回你在吧台的骰。'],
 F1:['整组灰骰','选择一整组灰骰，全部放到同一开放场地，独立竞争奖金。'],
 F2:['灰骰交换','取走开放主场的一灰，占一个空格获得筹码、现金或移动己骰的机会。'],
 G2:['双线夺奖','可把本场的己骰移到副板。副板独立剔平，轮末前两名领 6 万和 3 万。'],
 H1:['好骰占位','用本次掷出的一骰占对应点数槽。旧骰回对应主场，轮末按槽奖励。']
};
export const sample=['A1','D1','F1'].map((face,i)=>({face,venue:i+1}));
export const boardName=id=>id+' '+boards[id][0];
function create(tag,text,cls){
 const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;
}
function action(text,callback,cls='choice'){
 const b=create('button',text,cls);b.type='button';b.onclick=callback;return b;
}
// Edits stay in this local draft until Start/Save.
export function pickTable(initial,done,launch){
 const dialog=document.getElementById('board-picker'),list=document.getElementById('board-list'),slots=document.getElementById('board-slots');
 let draft=structuredClone(initial),selected=draft[0]?.face??'A1';
 const draw=()=>{
   list.replaceChildren();slots.replaceChildren();
   for(const id of Object.keys(boards)){
     const b=action(boardName(id),()=>{selected=id;draw();},'board-choice');
     const icon=create('img');icon.src=artUrl(id.toLowerCase());icon.alt='';
     b.prepend(icon);b.setAttribute('aria-pressed',String(id===selected));list.append(b);
   }
   document.getElementById('board-hint').textContent=boards[selected][1]+' 选择下方场地拼入，可替换原板。';
   for(let n=1;n<=6;n++){
     const attached=draft.find(m=>m.venue===n);
     const slot=create('div',null,'mount');
     slot.append(action(n+'号 · '+(attached?boardName(attached.face):'空位'),()=>{
       draft=draft.filter(m=>m.venue!==n && m.face[0]!==selected[0]);draft.push({face:selected,venue:n});draw();
     }));
     if(attached)slot.append(action('移除 '+n+' 号',()=>{draft=draft.filter(m=>m.venue!==n);draw();},'unmount'));
     slots.append(slot);
   }
 };
 document.getElementById('board-sample').onclick=()=>{draft=structuredClone(sample);selected='A1';draw();};
 const apply=document.getElementById('board-apply');apply.textContent=launch?'开局 · 固定三轮':'保存拼板';
 apply.onclick=()=>{dialog.close();done(draft.sort((a,b)=>a.venue-b.venue));};
 draw();dialog.showModal();
}
export function boardStatus(id,s){
 const g=s.game,b=g?.boards, owner=n=>s.players[n]?.name??'待领取';
 if(id==='F1')return '灰骰组 '+(g?.groups.filter(Boolean).join('／')||'无');
 if(!b)return '';
 switch(id){
 case 'A2':return '奖池 '+b.jackpot+' 万';
 case 'C1':return '五星令牌 · '+owner(b.high);
 case 'D2':return '领先令牌 · '+owner(b.lead);
 case 'E1':return b.closed?'封住 '+b.closed+' 号 · 奖励轨 '+b.gate:'封条尚未放置';
 case 'E2':return '吧台 · '+s.players.map(p=>p.name+' '+b.bar.filter(d=>d.owner===p.id).length+'颗').join('／');
 case 'F2':return '九个奖励格 · '+b.handicap.map((d,i)=>d?'●':i<2?'筹':i<5?'钱':'移').join(' ');
 case 'G2':return '副板实力 · '+s.players.map(p=>p.name+' '+b.double.filter(d=>d.owner===p.id).reduce((n,d)=>n+(d.big?2:1),0)).join('／');
 case 'H1':return b.nice.map((d,i)=>(i+1)+'点 '+(d?owner(d.owner):'空')).join(' · ');
 default:return '';
 }
}
export function eventText(e,s){
 return e.face+'　'+(Number.isInteger(e.seat)?s.players[e.seat].name+' · ':'')+e.text;
}
export function viewJournal(s,you){
 const g=s.game,box=document.getElementById('royale-ledger');box.replaceChildren();
 const held=g.wallet??[];
 box.append(create('p','我的奖金牌　'+(held.map(v=>v/10000+'万').join('、')||'暂无')+'　筹码 '+g.chips[you]));
 const counts=new Map();
 for(const value of g.bank)counts.set(value,(counts.get(value)??0)+1);
 box.append(create('p','银行　'+Array.from(counts).sort(([a],[b])=>a-b).map(([v,n])=>v/10000+'万×'+n).join('　')));
 for(const {face,venue} of s.config.modules)box.append(create('p',venue+'号 '+boardName(face)+'　'+boardStatus(face,s)));
 const prior=g.history.filter(h=>h.round<g.round).flatMap(h=>h.events??[]);
 for(const e of [...prior,...g.events].reverse())box.append(create('p','第 '+e.round+' 轮　'+eventText(e,s)));
}
export function moduleBadge(id){
 const image=create('img',null,'board-art');image.alt='';image.src=artUrl(id.toLowerCase());return image;
}

const cell={
 A1:[0,1],A2:[2,2],B1:[3,1],B2:[0,4],C1:[4,2],D1:[1,0],D2:[3,2],E1:[5,2],
 E2:[0,3],F1:[4,1],F2:[5,1],G2:[1,3],H1:[5,1]
};
function piece(id,label){
 const span=create('span',label,'module-piece'),[col,row]=cell[id];
 span.style.setProperty('--glyph',col*20+'% '+row*25+'%');return span;
}
export function arrangement(id,s){
 const line=create('div',null,'arrangement'),g=s.game,b=g?.boards;
 line.setAttribute('aria-label',boardName(id));
 const name=owner=>s.players[owner]?.name??'空';
 const add=label=>line.append(piece(id,label));
 const track=(values,index)=>values.forEach((label,i)=>{const node=piece(id,label);if(i===index)node.classList.add('on-track');line.append(node);});
 if(id==='F1'){(g?.groups??[]).forEach(n=>add(n?'×'+n:'空'));return line;}
 if(!b)return line;
 switch(id){
 case 'A1':for(let i=0;i<3;i++)add('◆');break;
 case 'A2':track(['3万','4万','5万','6万','7万','8万'],b.jackpot-3);break;
 case 'B1':add('轮末额外骰 ×2');break;
 case 'B2':track(['0','1筹','3万','4万','6万'],g.pending?.face==='B2'?g.pending.progress:-1);break;
 case 'C1':add(name(b.high)+' · 10万');break;
 case 'D1':for(const [i,d] of g.venues.entries())if(d.some(x=>x.owner===g.actor))add((i+1)+'号');break;
 case 'D2':add(name(b.lead)+' · 领先');break;
 case 'E1':track(['起点','2筹','空','3万','空','1筹'],b.gate);break;
 case 'E2':s.players.forEach(p=>add(p.name+' '+b.bar.filter(d=>d.owner===p.id).length+'/2'));break;
 case 'F2':b.handicap.forEach((d,i)=>add((i+1)+' '+(d?'已占':i<2?'1筹':i<5?'3万':'移骰')));break;
 case 'G2':s.players.forEach(p=>add(p.name+' ×'+b.double.filter(d=>d.owner===p.id).length));break;
 case 'H1':b.nice.forEach((d,i)=>add((i+1)+'点 '+(d?name(d.owner):'空')));break;
 }
 return line;
}
