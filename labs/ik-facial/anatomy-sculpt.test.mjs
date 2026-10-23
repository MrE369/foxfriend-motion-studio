// Node: node --test labs/ik-facial/anatomy-sculpt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {presets,sculptBodyPositions,checkBodySculpt} from './anatomy-sculpt.js';
const makeBody=()=>{
 const vertices=[],indices=[],rings=8,layers=11;
 for(let k=0;k<layers;k++){const y=1.8*k/(layers-1),radius=.17+.085*Math.exp(-.5*((y-1.44)/.17)**2);
  for(let i=0;i<rings;i++){let theta=2*Math.PI*i/rings;vertices.push(Math.cos(theta)*radius,y,Math.sin(theta)*.12);}}
 for(let k=0;k<layers-1;k++)for(let i=0;i<rings;i++){
  let a=k*rings+i,b=k*rings+(i+1)%rings,c=(k+1)*rings+i,d=(k+1)*rings+(i+1)%rings;
  indices.push(a,b,c,b,d,c);
 }
 const idx={count:indices.length,getX:i=>indices[i]};
 return {source:new Float32Array(vertices),idx};
};
test('all presets make reversible actual vertex changes, preserving topology',()=>{
 const {source,idx}=makeBody(),prior=new Float32Array(source),ps=presets();
 let modes=[];
 for(const [name,params] of Object.entries(ps)){
  const r=sculptBodyPositions(source,params);
  assert.equal(r.positions.length,source.length);
  assert.ok(checkBodySculpt(source,r.positions,idx).passed);
  modes.push({name,changed:r.changed});
 }
 assert.equal(modes[0].changed,0);
 assert.ok(modes.slice(1).every(x=>x.changed>0));
 assert.deepEqual(source,prior);
});
test('invalid parameters and nonbody shapes fail closed',()=>{
 const {source}=makeBody();
 assert.throws(()=>sculptBodyPositions(source,{shoulders:.2}),/Invalid/);
 assert.throws(()=>sculptBodyPositions(source,{waist:NaN}),/Invalid/);
 assert.throws(()=>sculptBodyPositions(new Float32Array(30).fill(NaN)),/Non-finite/);
});
test('100% athletic and lean produce different shoulder silhouettes',()=>{
 const {source}=makeBody();
 const a=sculptBodyPositions(source,presets().athletic),b=sculptBodyPositions(source,presets().lean);
 assert.notDeepEqual(a.positions,b.positions);
 assert.ok(a.maxDisplacement>0);
});
test('quality rejects reversed/degenerate triangles',()=>{
 const {source,idx}=makeBody(),changed=new Float32Array(source);
 // Collapse ring vertex onto its neighbor to create at least one degenerate triangle.
 changed[0]=changed[3];changed[1]=changed[4];changed[2]=changed[5];
 assert.ok(!checkBodySculpt(source,changed,idx).passed);
});
