import test from 'node:test';
import assert from 'node:assert/strict';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { modelRegistry } from '../web/models.js';
const settled=()=>new Promise(ok=>setImmediate(ok));

test('geometry instances are independent; blank, small and big dice use replaceable visual instances',()=>{
  const registry=modelRegistry(), a=registry.table(), b=registry.table();
  a.position.x=3;assert.equal(b.position.x,0);
  for(const item of [a,b,registry.venue(),registry.chip(),registry.tile()]) assert.ok(item.children[0].isMesh);
  assert.equal(registry.die({owner:'gray'}).children[0].children.length,0);
  assert.equal(registry.die({owner:2,face:6,big:true}).children[0].children.length,6);
});
test('missing glTF retains the placeholder; parsed glTF replaces each instance and requests redraw',async()=>{
  const paths={table:'/models/table.gltf',chip:'/models/missing.glb'};
  let requests=0,repaints=0;
  const registry=modelRegistry(paths,async url=>{
    requests++;
    if(url.endsWith('.glb')) throw Error('missing');
    return new GLTFLoader().parseAsync(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'VerifiedNode'}]}),'');
  },()=>repaints++);
  const first=registry.table(),second=registry.table(),chip=registry.chip();
  assert.ok(first.children[0].isMesh);
  await settled();
  assert.ok(first.getObjectByName('VerifiedNode'));
  assert.ok(second.getObjectByName('VerifiedNode'));
  assert.notEqual(first.children[0],second.children[0]);
  assert.ok(chip.children[0].isMesh);
  assert.equal(requests,2);assert.equal(repaints,2);
});
