// Node 22+: node --test labs/ik-facial/rigged-female-s04.test.mjs
// Synthetic 7376-vertex upright body used only for deterministic code safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {riggedFemalePreview} from './rigged-female-s04.js';
function fixture(){
 const names=['root','pelvis','spine_01','spine_02','spine_03','clavicle_l','clavicle_r','upperarm_l','upperarm_r'];
 while(names.length<65)names.push('aux_'+names.length);
 const count=7376,ring=8,layers=count/ring,coords=new Float32Array(count*3),faces=[];
 for(let k=0;k<layers;k++){
   const y=k*1.8/(layers-1),radius=.18+.09*Math.exp(-.5*((y-1.375)/.17)**2);
   for(let i=0;i<ring;i++){
     const n=k*ring+i,theta=2*Math.PI*i/ring;
     coords[n*3]=radius*Math.cos(theta);
     coords[n*3+1]=y;
     coords[n*3+2]=.1*Math.sin(theta);
   }
 }
 for(let k=0;k<layers-1;k++)for(let i=0;i<ring;i++){
   const a=k*ring+i,b=k*ring+(i+1)%ring,c=(k+1)*ring+i,d=(k+1)*ring+(i+1)%ring;
   faces.push(a,b,c,b,d,c);
 }
 const indices=new Float32Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){indices[i*4]=4;weights[i*4]=1;}
 const attr=(array,n)=>({
    array,count:array.length/n,itemSize:n,
    getX:i=>array[i*n]||0,getY:i=>array[i*n+1]||0,
    getZ:i=>array[i*n+2]||0,getW:i=>array[i*n+3]||0
 });
 const mesh={name:'Superhero_Female',isSkinnedMesh:true,skeleton:{bones:names.map(name=>({name}))},
   geometry:{morphAttributes:{},getAttribute:name=>name==='position'?attr(coords,3):
     name==='skinIndex'?attr(indices,4):name==='skinWeight'?attr(weights,4):null,
     index:{count:faces.length,getX:i=>faces[i]}
   }};
 return {mesh,coords,indices,weights};
}
test('S-04 validates input intensity and exact rig gate',()=>{
 const {mesh}=fixture();
 assert.throws(()=>riggedFemalePreview(mesh,1.1),/Intensity/);
 assert.throws(()=>riggedFemalePreview({...mesh,isSkinnedMesh:false}),/skinned/);
 assert.throws(()=>riggedFemalePreview({...mesh,name:'UnknownFemale'}),/Superhero_Female/);
});
test('S-04 modifies positions, not original geometry or weights',()=>{
 const {mesh,coords,indices,weights}=fixture();
 const a=coords.slice(),i=indices.slice(),w=weights.slice();
 const result=riggedFemalePreview(mesh,1);
 assert.ok(result.stats.verticesChanged>0);
 assert.ok(result.stats.maxDisplacementMm>0);
 assert.equal(result.stats.reversed,0);
 assert.deepEqual(coords,a);assert.deepEqual(indices,i);assert.deepEqual(weights,w);
});
test('S-04 zero-intensity preview equals source exactly',()=>{
 const {mesh,coords}=fixture();
 assert.deepEqual(riggedFemalePreview(mesh,0).positions,coords);
});
