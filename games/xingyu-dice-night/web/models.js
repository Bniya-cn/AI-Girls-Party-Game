import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Reviewed static assets only. Keys may also be specific, e.g. die.p0.6.
export const modelPaths = Object.freeze({});
export const seatColors = [0x365dcc, 0xd27147, 0x368b79, 0x9d64ac, 0xae903d];
const mesh = (geometry, color) => new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
const box = (w,h,d,color) => mesh(new THREE.BoxGeometry(w,h,d),color);
const pipPatterns = [[], [[0,0]], [[-1,-1],[1,1]], [[-1,-1],[0,0],[1,1]], [[-1,-1],[-1,1],[1,-1],[1,1]],
  [[-1,-1],[-1,1],[0,0],[1,-1],[1,1]], [[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]];
function dieModel(owner, face) {
  const color = owner === 'gray' ? 0x939aa4 : owner === 'neutral' ? 0x35404d : seatColors[owner];
  const die = box(1,1,1,color);
  for (const [x,z] of pipPatterns[face || 0]) {
    const pip = mesh(new THREE.CylinderGeometry(.085,.085,.015,10),0xfff9dd);
    pip.position.set(x*.27,.503,z*.27);
    die.add(pip);
  }
  return die;
}
export function modelRegistry(paths = modelPaths, load = url => new GLTFLoader().loadAsync(url), invalidate = () => {}) {
  const templates = new Map(), loading = new Map();
  function instance(key, make) {
    if (!templates.has(key)) templates.set(key, make());
    const root = new THREE.Group();
    root.add(templates.get(key).clone(true));
    if (Object.hasOwn(paths, key)) {
      if (!loading.has(key)) loading.set(key, Promise.resolve().then(() => load(paths[key])).then(gltf => gltf.scene).catch(() => null));
      loading.get(key).then(template => {
        if (template) { root.clear(); root.add(template.clone(true)); invalidate(); }
      });
    }
    return root;
  }
  return {
    table: () => instance('table', () => box(12,.32,8,0xe7dcc4)),
    venue: () => instance('venue', () => box(3.45,.12,2.14,0x899eb3)),
    chip: () => instance('chip', () => mesh(new THREE.CylinderGeometry(.24,.24,.09,24),0xd6ae63)),
    tile: () => instance('tile.F1', () => box(1.22,.15,.38,0x728490)),
    die: d => instance('die.' + d.owner + '.' + (d.face || 0), () => dieModel(d.owner,d.face))
  };
}
