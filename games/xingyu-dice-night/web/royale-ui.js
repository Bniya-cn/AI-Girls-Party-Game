import { strengths } from '../rules/payout.js';
import { artUrl } from './art.js';
export const boards={
 A1:['藏星猜拳','藏 1–3 枚，由左手边的玩家猜。猜错才给藏方奖励。'],
 A2:['星光奖池','额外两骰同点或合计 7 即领奖，否则奖池升一格。'],
 B1:['星港支援','落骰即召回未被封场的黑骰，重掷并选择支援地点。黑骰在主场提供实力。'],
 B2:['猜高猜低','先掷两骰，再猜下次合计更高或更低；相等也输。随时收手领当前格。'],
 C1:['五星时刻','首位入场后达到至少 5 点实力的玩家获令牌并当场领 10 万。'],
 C2:['失运警报','落骰后立刻比较各玩家在此处的实力，含零点。并列最低者各付 5 万，可用筹码或纸币找零。'],
 D1:['星屿发薪日','每个有己骰的主场算一处。1／2 处领筹码，3–6 处领对应万元。'],
 D2:['领跑特权','入场且独自领先可持标。保持领先时每回合可用一骰定面，落点正常触发。'],
 E1:['此路暂封','选另一个场地封锁进出。改变封场才推进奖励轨，留在原地没有奖励。'],
 E2:['吧台歇脚','对手从手中交一骰到吧台，每席最多两颗。随后收回你在吧台的骰。'],
 F1:['整组灰骰','选择一整组灰骰，全部放到同一开放场地，独立竞争奖金。'],
 F2:['灰骰交换','取走开放主场的一灰，占一个空格获得筹码、现金或移动己骰的机会。'],
 G1:['星屿盲盒','左邻把六枚奖片暗分两盒，落骰者根据两盒数量选一盒，当场揭晓领奖。'],
 G2:['双线夺奖','可把本场的己骰移到副板。完成调动即按副板名次领差额，首位 6 万、次位 3 万，每人每轮最高 6 万。'],
 H2:['任选星签','掷两枚黑骰自选其一。4 借用其他板，5 改点或收骰，6 占金框。每人每轮首次占金框领 6 万。'],
 H1:['好骰占位','用本次掷出的一骰占对应点数槽。旧骰回对应主场，当场按槽领奖，每人每点槽每轮限领一次。']
};
export const party=['A1','B2','C2','F1','G1','H2'].map((face,i)=>({face,venue:i+1}));
export const sample=['A1','D1','F1'].map((face,i)=>({face,venue:i+1}));
export const boardName=id=>id+' '+boards[id][0];
function create(tag,text,cls){
 const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;
}
function action(text,callback,cls='choice'){
 const b=create('button',text,cls);b.type='button';b.onclick=callback;return b;
}
// Edits stay in this local draft until Start/Save.
export function pickTable(initial,done,launch,study){
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
 const lesson=document.getElementById('board-lesson');lesson.hidden=!study;
 lesson.onclick=()=>{dialog.close();study(selected);};
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
 for(const t of g.payments??[]){
   const amounts=cards=>cards.map(c=>c/10000+'万').join('、')||'无';
   box.append(create('p','第 '+t.round+' 轮 C2 收据 · 交出 '+amounts(t.paid)+' 和 '+t.chips+' 枚筹码，找回 '+amounts(t.back)+'，实扣 '+t.net+' 万'));
 }
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
 E2:[0,3],F1:[4,1],F2:[5,1],G2:[1,3],H1:[5,1],C2:[2,3],G1:[5,0],H2:[3,1]
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
 case 'C2':add('最低实力 · 付5万');break;
 case 'G1':add('左盒');add('右盒');break;
 case 'H2':add('金框 · '+(b.gold?name(b.gold.owner):'空'));break;
 case 'A1':for(let i=0;i<3;i++)add('◆');break;
 case 'A2':track(['3万','4万','5万','6万','7万','8万'],b.jackpot-3);break;
 case 'B1':add('即时支援骰 ×2');break;
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

export function landingPreview(s,seat,n) {
 const g=s.game,group=g.roll.filter(d=>d.face===n);
 const ladder=strengths([...g.venues[n-1],...group]),mine=ladder.find(r=>r.owner===seat);
 const rank=ladder.filter(r=>!r.tied).findIndex(r=>r.owner===seat);
 const standing=mine?.tied?'平手退出':rank===0?'暂列头奖':rank===1?'暂列次奖':'暂无奖金';
 return group.length+'颗 · '+standing;
}
export function entryEffect(s,n,seat){
 const g=s.game,id=s.config.modules.find(m=>m.venue===n)?.face;
 if(!id)return '';
 const b=g.boards;
 if(id==='D1'){
   const count=g.venues.filter((ds,i)=>i===n-1||ds.some(d=>d.owner===seat)).length;
   return '即领 '+count+(count<3?' 筹':' 万');
 }
 if(id==='A2')return '奖池 '+b.jackpot+' 万';
 if(id==='C2'){
   const after=[...g.venues[n-1],...g.roll.filter(d=>d.face===n)];
   const points=s.players.map(p=>after.filter(d=>d.owner===p.id).reduce((v,d)=>v+(d.big?2:1),0));
   const low=Math.min(...points);
   return points[seat]===low?'你也要付罚款':'对手面临罚款';
 }
 if(id==='C1'){
   const own=[...g.venues[n-1],...g.roll.filter(d=>d.face===n)].filter(d=>d.owner===seat);
   return b.high!==null?'令牌已领':own.reduce((v,d)=>v+(d.big?2:1),0)>=5?'即领 10 万':'累计五星';
 }
 return ({A1:'藏数让对手猜',B1:'派出支援骰',B2:'猜大小或收手',D2:'争领先令牌',E1:'封住一场',E2:'扣骰／取回',F1:'调动一组灰骰',F2:'用灰骰换奖励',G1:'对手分盒，你开盒',G2:'调骰争 6 万',H1:'占点槽即领奖',H2:'掷两签选一签'})[id];
}

// The divider builds their private partition locally and submits it once.
let draftId=null, mask=0;
export function drawEncounter(view,locked,submit){
 const s=view.state,p=s.game?.pending,stage=document.getElementById('encounter');
 if(!p){if(!stage.hidden)stage.replaceChildren();stage.hidden=true;draftId=null;return;}
 stage.hidden=false;
 const key=view.room+'/'+p.id;
 if(draftId!==key){draftId=key;mask=0;stage.scrollTop=0;}
 const mine=p.seat===view.you;
 const oldFocus=stage.contains(document.activeElement)?document.activeElement?.dataset.key:null;
 stage.dataset.face=p.face;stage.replaceChildren();
 const head=create('div',null,'encounter-heading');
 head.append(moduleBadge(p.face));const titles=create('div');
 titles.append(create('small',s.players[p.seat].name+' · '+(mine?'由你决定':'正在操作')),create('h2',boards[p.face][0]));
 head.append(titles);stage.append(head,create('p',p.prompt));
 if(p.committed)stage.append(create('p','你已锁定 '+p.committed+' 枚'));
 stage.append(arrangement(p.face,s));
 const box=create('div',null,'encounter-options');stage.append(box);
 const add=(label,id,cb,disabled=false,parent=box)=>{
   const b=action(label,cb,'encounter-choice');b.dataset.key=id;b.disabled=disabled||locked;parent.append(b);return b;
 };
 if(mine && p.step==='split'){
   const tokens=[6,2,2,0,0,0];
   const trays=[create('div',null,'token-box'),create('div',null,'token-box')];
   const left=tokens.filter((_,i)=>mask&(1<<i));
   trays[0].append(create('strong','左盒 · '+left.length+' 枚'));
   trays[1].append(create('strong','右盒 · '+(6-left.length)+' 枚'));
   box.append(...trays);box.classList.add('divide-boxes');
   tokens.forEach((v,i)=>{
     const selected=Boolean(mask&(1<<i));
     const b=add(v?v+'万':'空',String(i),()=>{
       mask^=1<<i;drawEncounter(view,locked,submit);stage.querySelector('[data-key="'+i+'"]')?.focus();
     },false,trays[selected?0:1]);
     b.setAttribute('aria-label',(v?v+'万':'空片')+'，移到'+(selected?'右':'左')+'盒');b.setAttribute('aria-pressed',String(selected));
   });
   add('封好两盒','seal',()=>submit(String(mask)),!p.options.some(o=>o.key===String(mask)));
 }else if(mine){
   for(const o of p.options){
     let label=o.label;
     if(p.face==='B2' && ['up','down'].includes(o.key)){
       let wins=0;
       for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(o.key==='up'?a+b>p.total:a+b<p.total)wins++;
       label+=' · '+Math.round(100*wins/36)+'%';
     }
     const b=add(label,o.key,()=>submit(o.key));
     if(p.step==='box'){b.classList.add('mystery-box');b.prepend(piece('G1',''));}
     if(p.step==='sign'){b.classList.add('fortune-die');b.prepend(create('span','⚀⚁⚂⚃⚄⚅'[Number(o.key)-1],'pip'));}
     if(p.face==='A1'){b.classList.add('secret-hand');b.prepend(create('span','●'.repeat(Number(o.key)),'chip-count'));}

   }
 }else{
   box.append(create('span',p.face==='G1'?'奖片已遮住，开盒后揭晓。':'等对方确认后继续。'));
 }
 if(oldFocus)Array.from(box.querySelectorAll('button')).find(b=>b.dataset.key===oldFocus && !b.disabled)?.focus();
}
