// Run on Node 22+: node --test labs/ik-facial/character-workshop.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectLocalAssetSet,matchLocalResources,validateGltfManifest} from './gltf-local-intake.js';
import {checkClipCompatibility,summarizeCharacter} from './character-workshop.js';
const fakeFile=name=>({name,size:100,webkitRelativePath:''});
test('glTF main files and companions are classified locally',()=>{
 const v=inspectLocalAssetSet([fakeFile('body.gltf'),fakeFile('body.bin'),fakeFile('albedo.png')]);
 assert.equal(v.main.length,1);assert.equal(v.companions.length,2);
});
test('local companion matching allows folder-prefixed glTF references',()=>{
 const r=matchLocalResources(['Rig/body.bin','Textures/albedo.png'],[fakeFile('body.bin'),fakeFile('albedo.png')]);
 assert.equal(r.size,2);
});
test('glTF manifests reject missing, external, and traversal resources',()=>{
 const json=files=>JSON.stringify({asset:{version:'2.0'},buffers:files.map(uri=>({uri}))});
 assert.equal(validateGltfManifest(json(['body.bin']),[fakeFile('body.bin')]).mapped.size,1);
 assert.throws(()=>validateGltfManifest(json(['missing.bin']),[]),/Missing/);
 assert.throws(()=>validateGltfManifest(json(['https://example.com/m.bin']),[fakeFile('m.bin')]),/blocked/);
 assert.throws(()=>validateGltfManifest(json(['../m.bin']),[fakeFile('m.bin')]),/Unsafe/);
 assert.throws(()=>validateGltfManifest('{"asset":{"version":"1.0"}}',[]),/glTF 2/);
});
test('ambiguous basename refuses to guess',()=>{
 assert.throws(()=>matchLocalResources(['a.bin'],[fakeFile('a.bin'),fakeFile('a.bin')]),/Ambiguous|Multiple/);
});
function sceneNode(name,children=[],isBone=false){
 const node={name,isBone,children,parent:null,traverse(callback){callback(this);for(const o of children)o.traverse(callback);},
   getObjectByProperty(k,v){let found=null;this.traverse(x=>{if(x[k]===v)found=x});return found}};
 children.forEach(x=>x.parent=node);return node;
}
const THREE={PropertyBinding:{parseTrackName(track){const idx=track.lastIndexOf('.');if(idx<0)throw Error('bad');
 return {nodeName:track.slice(0,idx),propertyName:track.slice(idx+1)};}}};
function rig(parent='Hips'){
 const head=sceneNode('Head',[],true),spine=sceneNode('Spine',[head],true),hips=sceneNode('Hips',[spine],true),mesh=sceneNode('Mesh');
 mesh.isSkinnedMesh=true;
 const root=sceneNode('Character',[hips,mesh]);return root;
}
test('strict animation binding accepts matching humanoid names/hierarchy',()=>{
 const character={root:rig()},library={scene:rig()};
 const clip={tracks:[{name:'Hips.position'},{name:'Spine.quaternion'},{name:'Head.quaternion'}]};
 const result=checkClipCompatibility(THREE,character,library,clip);
 assert.equal(result.ok,true);assert.equal(result.boneTracks,3);
});
test('missing tracks fail closed',()=>{
 const result=checkClipCompatibility(THREE,{root:rig()},{scene:rig()},{tracks:[{name:'UnknownBone.quaternion'}]});
 assert.equal(result.ok,false);assert.equal(result.missing[0],'UnknownBone');
});
test('a different bone parent relationship fails closed',()=>{
 const donor=sceneNode('Character',[sceneNode('Head',[],true),sceneNode('Hips',[],true)]);
 const result=checkClipCompatibility(THREE,{root:rig()},{scene:donor},{tracks:[{name:'Head.quaternion'}]});
 assert.equal(result.ok,false);assert.ok(result.hierarchy.some(x=>x.includes('parent')));
});
test('external humanoid animation requires a skinned target',()=>{
 const result=checkClipCompatibility(THREE,{root:sceneNode('Character',[sceneNode('Hips',[],true)])},{scene:rig()},{tracks:[{name:'Hips.quaternion'}]});
 assert.equal(result.ok,false);assert.match(result.reason,/skinned/);
});
