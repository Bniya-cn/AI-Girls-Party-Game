import * as THREE from 'three';
import { artUrl } from './art.js';
import { modelRegistry } from './models.js';

const venueColors = ['#d0a47e','#a5a5be','#9eb2a1','#9db1c7','#d4ab95','#969eba'];
function canvasMap(width,height,paint) {
  const c=document.createElement('canvas'); c.width=width; c.height=height;
  paint(c.getContext('2d'),width,height);
  const map=new THREE.CanvasTexture(c); map.colorSpace=THREE.SRGBColorSpace; return map;
}
function roundedSlab(width,depth,height,radius,material) {
  const s=new THREE.Shape(),x=-width/2,y=-depth/2,w=width,h=depth,r=radius;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const geometry=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:3,curveSegments:8});
  geometry.rotateX(-Math.PI/2);
  return new THREE.Mesh(geometry,material);
}
function cloth() {
  const map=canvasMap(128,128,(ctx,w,h)=>{
    ctx.fillStyle='#284453';ctx.fillRect(0,0,w,h);
    for(let i=0;i<w;i+=3){ctx.fillStyle='rgba(200,227,227,.047)';ctx.fillRect(i,0,1,h);
      ctx.fillStyle='rgba(0,0,0,.07)';ctx.fillRect(0,i,w,1);}
  });
  map.wrapS=map.wrapT=THREE.RepeatWrapping; map.repeat.set(.85,.85);return map;
}
const place=(group,object,x,y,z)=>{object.position.set(x,y,z);group.add(object);return object;};
export function makeTable(stage,buttons) {
  const canvas=stage.querySelector('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75)); renderer.setClearColor(0,0);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,80);
  camera.position.set(0,16,8.3); camera.lookAt(0,0,0);camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xfff4df,0xa1b5c3,2.25));
  const lamp=new THREE.DirectionalLight(0xffe7c6,2);lamp.position.set(-2,8,4);scene.add(lamp);
  let frame=0, start=0, rollKey='', moving=[], current=null, centers=[];
  let flights=[];
  const models=modelRegistry(undefined,undefined,invalidate);
  const furniture=new THREE.Group(), pieces=new THREE.Group();scene.add(furniture,pieces);
  const table=place(furniture,models.table(),0,-.36,0);
  const textile=cloth();
  const felt=new THREE.MeshBasicMaterial({map:textile});
  const surfaceGroup=new THREE.Group();
  surfaceGroup.add(roundedSlab(12,8,.16,.85,new THREE.MeshStandardMaterial({color:0x745440})));
  place(surfaceGroup,roundedSlab(11.9,7.9,.04,.81,new THREE.MeshBasicMaterial({color:0xc19d68})),0,.18,0);
  place(surfaceGroup,roundedSlab(11.73,7.73,.05,.74,felt),0,.23,0);
  table.clear();table.add(surfaceGroup);
  const artLoader=new THREE.TextureLoader();
  const faces=buttons.map((button,i)=>{
    const plate=place(furniture,models.venue(),0,.02,0);
    plate.children[0].material=new THREE.MeshStandardMaterial({color:0xb49265,roughness:.7});
    const map=canvasMap(640,460,(ctx,w,h)=>{
      const wash=ctx.createLinearGradient(0,0,w,h);wash.addColorStop(0,'#f8e9d1');wash.addColorStop(.58,venueColors[i]);wash.addColorStop(1,'#b49779');
      ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#f7e9cc';ctx.lineWidth=4;ctx.strokeRect(9,9,w-18,h-18);
      ctx.lineWidth=1;ctx.strokeRect(17,17,w-34,h-34);
      ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(w/2,h/2,h*.39,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    });
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(3.34,2.34),new THREE.MeshBasicMaterial({map}));
    surface.rotation.x=-Math.PI/2;
    furniture.add(surface);
    const picture=artLoader.load(artUrl('venue-'+(i+1)),invalidate);
    picture.colorSpace=THREE.SRGBColorSpace;
    const art=new THREE.Mesh(new THREE.PlaneGeometry(2.30,2.30),new THREE.MeshBasicMaterial({map:picture,transparent:true,depthWrite:false}));
    art.rotation.x=-Math.PI/2;furniture.add(art);
    return {plate,surface,art};
  });
  const attachments=new Map();
  function mountBoards(slots){
    const used=new Set(slots.map(m=>m.face));
    for(const [id,part] of attachments)part.visible=used.has(id);
    for(const {face,venue} of slots){
      let part=attachments.get(face);
      if(!part){
        part=new THREE.Group();
        const base=models.tile(face);base.scale.set(.67,1,.85);part.add(base);
        const map=artLoader.load(artUrl(face.toLowerCase()),invalidate);map.colorSpace=THREE.SRGBColorSpace;
        const badge=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false}));
        badge.scale.set(.82,.82,1);badge.position.y=.24;part.add(badge);
        attachments.set(face,part);furniture.add(part);
      }
      const [x,z]=centers[venue-1];part.position.set(x+.87,.18,z-.76);part.visible=true;
    }
  }
  function layout(){
    const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
    const cols=w/h<1.12?2:3, rows=6/cols;
    const width=cols*3.64+.45, depth=rows*2.72+1.1;
    centers=buttons.map((_,i)=>[((i%cols)-(cols-1)/2)*3.64,(Math.floor(i/cols)-(rows-1)/2)*2.72-.12]);
    table.scale.set(width/12,1,depth/8);
    const cameraHeight=Math.max(depth*.91+.3,(width+.32)*h/w);
    camera.top=cameraHeight/2;camera.bottom=-camera.top;camera.right=camera.top*w/h;camera.left=-camera.right;
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    const project=(x,y,z)=>{
      const p=new THREE.Vector3(x,y,z).project(camera);
      return [(p.x+1)*w/2,(1-p.y)*h/2];
    };
    centers.forEach(([x,z],i)=>{
      const {plate,surface,art}=faces[i];plate.scale.z=2.42/2.14;
      plate.position.set(x,.045,z);surface.position.set(x,.116,z);art.position.set(x,.128,z-.15);
      const [l,t]=project(x-1.67,.13,z-1.17),[r,b]=project(x+1.67,.13,z+1.17);
      Object.assign(buttons[i].style,{left:l+'px',top:t+'px',width:(r-l)+'px',height:(b-t)+'px'});
    });
    if(current) update(current);invalidate();
  }
  function update(state) {
    const previous=current;
    current=state;if(!centers.length)return;
    const front=Math.max(...centers.map(p=>p[1]))+1.56;
    const fromTray=previous?.phase==='select' && previous.game.round===state.game?.round?previous.game.roll:[];
    const lastFlight=new Map(flights.filter(f=>performance.now()-f.start<300).map(f=>[f.id,f]));
    flights=[];
    pieces.clear();moving=[];
    const g=state.game;mountBoards(state.config.modules);
    g?.venues.forEach((dice,i)=>dice.forEach((d,j)=>{
      const [x,z]=centers[i],size=d.big ? .33 : .245;
      const die=place(pieces,models.die(d),x-1.34+(j%8)*.37,.14+size/2+Math.floor(j/16)*.34,z+.36+(Math.floor(j/8)%2)*.32);
      die.scale.setScalar(size);
      const trayIndex=fromTray.findIndex(r=>r.id===d.id);
      const flight=lastFlight.get(d.id);
      if(trayIndex!==-1 || flight){
        flights.push({id:d.id,die,to:die.position.clone(),from:flight?.from??new THREE.Vector3(-.6+trayIndex*.43,.23,front),start:flight?.start??performance.now()});
      }
    }));
    g?.chips.forEach((count,i)=>{for(let j=0;j<count;j++){
      const chip=place(pieces,models.chip(),-2.93+i*.41,.05+j*.075,front);chip.scale.setScalar(.72);
    }});
    const tray=state.phase==='select'?g.roll:[];
    const key=JSON.stringify(tray);
    if(key!==rollKey)start=performance.now();
    rollKey=key;
    for(const [i,d] of tray.entries()){
      const item=place(pieces,models.die(d),-.6+i*.43,.23,front);
      item.scale.setScalar(d.big ? .37 : .30);moving.push(item);
    }
    invalidate();
  }
  function invalidate(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(now){frame=0;
    const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.max(0,Math.min(1,(now-start)/430));
    for(const die of moving){die.rotation.x=(1-t)*Math.PI*2;die.position.y=.23+Math.sin(t*Math.PI)*.48;}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let traveling=false;
    for(const f of flights){
      const ratio=reduced?1:Math.min(1,Math.max(0,(now-f.start)/290));
      f.die.position.lerpVectors(f.from,f.to,ratio);
      f.die.position.y+=Math.sin(Math.PI*ratio)*.6;
      if(ratio<1)traveling=true;
    }
    renderer.render(scene,camera);if(traveling || (moving.length&&t<1))invalidate();
  }
  const resize=new ResizeObserver(layout);resize.observe(stage);window.addEventListener('resize',layout);
  stage.classList.remove('flat');stage.classList.add('spatial');layout();
  return update;
}
