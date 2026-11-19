// The public edition draws its own pieces. A private illustrated pack can provide the same slots.
const generated = new Map();
const localSlots = new Set(__ART_SLOTS__);
export function artUrl(name) {
  if (localSlots.has(name)) return '/art/' + name + '.webp';
  if (generated.has(name)) return generated.get(name);
  const c=document.createElement('canvas'), landscape=name==='evening';
  c.width=landscape?1200:256;c.height=landscape?680:256;
  const p=c.getContext('2d');
  function disc(x,y,r,color){p.beginPath();p.arc(x,y,r,0,Math.PI*2);p.fillStyle=color;p.fill();}
  function rectangle(x,y,w,h,color){p.fillStyle=color;p.fillRect(x,y,w,h);}
  function polygon(pts,color){p.beginPath();pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();p.fillStyle=color;p.fill();}
  function star(x,y,r,color){polygon(Array.from({length:8},(_,i)=>[x+Math.cos(i*Math.PI/4)*(i%2?r*.27:r),y+Math.sin(i*Math.PI/4)*(i%2?r*.27:r)]),color);}
  const gold='#d9b97c',blue='#344e66',cream='#f6e5c1';
  if(landscape){
    const light=p.createLinearGradient(0,0,1200,680);light.addColorStop(0,'#ead6b4');light.addColorStop(.65,'#c4b09b');light.addColorStop(1,'#6a798a');
    p.fillStyle=light;p.fillRect(0,0,c.width,c.height);
    rectangle(754,0,450,487,blue);
    for(let i=0;i<38;i++)star(765+(i*107)%420,20+(i*79)%350,2+i%4,cream);
    disc(1086,103,44,cream);disc(1103,91,41,blue);
    for(let x=760;x<1200;x+=139)rectangle(x,0,9,487,gold);
    rectangle(754,265,445,9,gold);rectangle(739,473,469,20,'#9a7962');
    polygon([[0,680],[0,603],[1200,528],[1200,680]],'#a17d67');
  }else if(name.startsWith('venue-')){
    const number=Number(name.slice(-1)),hues=['#957452','#687493','#6a8e7f','#697f99','#aa8074','#717a99'];
    polygon([[19,200],[123,146],[238,199],[129,250]],hues[number-1]);
    const symbols=['☕','▤','♧','♫','✎','☾'];
    disc(128,119,76,cream);disc(128,119,68,blue);
    p.font='74px serif';p.textAlign='center';p.textBaseline='middle';p.fillStyle=cream;p.fillText(symbols[number-1],128,122);
  }else if(name.startsWith('seat-')||name==='host'||name==='empty'){
    const colors=['#446a85','#aa735c','#609281','#8978a0','#aa906c'];
    const index=['seat-deepseek','seat-claude','seat-gemini','seat-gpt','seat-qwen'].indexOf(name);
    const color=colors[Math.max(index,0)];
    polygon([[78,208],[104,126],[153,126],[181,208]],color);disc(128,90,41,color);
    rectangle(63,207,130,17,gold);rectangle(53,224,150,10,blue);star(128,90,23,cream);
  }else if(name==='f1'){
    for(const [x,y] of [[45,113],[110,128],[88,66]]){rectangle(x,y,65,65,blue);rectangle(x+5,y+5,55,8,gold);}
  }else if(name==='ribbons'){
    for(let i=0;i<16;i++)star(i%2?221-i%12:20+i%17,i*16,7+i%7,gold);
  }else{disc(128,128,79,blue);disc(128,128,69,gold);disc(128,128,60,blue);star(128,128,52,cream);}
  const url=c.toDataURL();generated.set(name,url);return url;
}
