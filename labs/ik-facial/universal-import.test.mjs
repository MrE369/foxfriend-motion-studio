// No third-party dependencies; run in a Node/Chromium-compatible JS environment.
// "Fixture ZIP" below contains real ZIP file records (stored mode).
import {inspectZipBytes} from './zip-safe-import.js';
import {matchLocalResources,validateGltfManifest} from './gltf-local-intake.js';
import {scanOBJDependencies,classifyAsset} from './universal-loaders.js';
import {compareExportAudit} from './export-roundtrip-check.js';
const enc=s=>Uint8Array.from([...s].map(ch=>ch.charCodeAt(0)));
function put(d,i,bytes,val){bytes===2?d.setUint16(i,val,true):d.setUint32(i,val,true);}
export function fixtureZip(rows){
 const loc=[],cen=[];let pos=0;
 for(const [name,text] of rows){
  const n=enc(name),data=enc(text||''),l=new Uint8Array(30+n.length+data.length),d=new DataView(l.buffer);
  put(d,0,4,0x04034b50);put(d,4,2,20);put(d,18,4,data.length);put(d,22,4,data.length);put(d,26,2,n.length);
  l.set(n,30);l.set(data,30+n.length);loc.push(l);
  const c=new Uint8Array(46+n.length),cd=new DataView(c.buffer);
  put(cd,0,4,0x02014b50);put(cd,4,2,0x0314);put(cd,6,2,20);
  put(cd,20,4,data.length);put(cd,24,4,data.length);put(cd,28,2,n.length);
  put(cd,38,4,0o100644<<16);put(cd,42,4,pos);c.set(n,46);cen.push(c);pos+=l.length;
 }
 const clen=cen.reduce((a,b)=>a+b.length,0),e=new Uint8Array(22),d=new DataView(e.buffer);
 put(d,0,4,0x06054b50);put(d,8,2,rows.length);put(d,10,2,rows.length);put(d,12,4,clen);put(d,16,4,pos);
 const out=new Uint8Array(pos+clen+22);let at=0;
 for(const b of [...loc,...cen,e]){out.set(b,at);at+=b.length;}
 return out;
}
export function runUniversalTests(){
 const results=[],fake=s=>({name:s.split('/').at(-1),relativePath:s,size:100});
 function eq(actual,expected){if(actual!==expected)throw Error('Expected '+expected+', got '+actual);}
 function refusal(fn,label){let e='';try{fn()}catch(err){e=err.message;}if(!e.includes(label))throw Error('Expected '+label+', got '+e);}
 function test(name,fn){try{fn();results.push({name,ok:true});}catch(err){results.push({name,ok:false,error:err.message});}}
 test('real ZIP bytes: model + BIN listed',()=>{const r=inspectZipBytes(fixtureZip([['Pack/body.gltf','{}'],['Pack/body.bin','a']]));eq(r.entries.length,2);});
 test('ZIP traversal blocked',()=>refusal(()=>inspectZipBytes(fixtureZip([['../evil.glb','x']])),'traversal'));
 test('ZIP duplicate path blocked',()=>refusal(()=>inspectZipBytes(fixtureZip([['x/a.glb','x'],['x/A.glb','y']])),'Duplicate'));
 test('corrupt ZIP rejected',()=>refusal(()=>inspectZipBytes(new Uint8Array(40)),'not found'));
 test('glTF nested BIN and texture found',()=>{const r=matchLocalResources(['data/body.bin','../../Textures/albedo.png'],[fake('Pack/Char/M/data/body.bin'),fake('Pack/Textures/albedo.png')],fake('Pack/Char/M/model.gltf'));eq(r.size,2);});
 test('glTF missing BIN flagged',()=>refusal(()=>matchLocalResources(['lost.bin'],[],fake('a.gltf')),'Missing'));
 test('glTF remote URL rejected',()=>refusal(()=>matchLocalResources(['https://evil.test/b.bin'],[],fake('a.gltf')),'blocked'));
 test('glTF path traversal rejected',()=>refusal(()=>matchLocalResources(['../../../secret.bin'],[],fake('P/a.gltf')),'escapes'));
 test('glTF duplicate filename resolves by folder',()=>{const m=matchLocalResources(['tex.png'],[fake('p/a/tex.png'),fake('p/b/tex.png')],fake('p/a/hero.gltf'));eq(m.get('tex.png').relativePath,'p/a/tex.png');});
 test('ambiguous glTF texture refused',()=>refusal(()=>matchLocalResources(['tex.png'],[fake('p/a/tex.png'),fake('p/b/tex.png')],fake('p/z/hero.gltf')),'Ambiguous'));
 test('glTF manifest detects sidecar BIN and texture',()=>{const manifest=JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'body.bin'}],images:[{uri:'tex.png'}]});eq(validateGltfManifest(manifest,[fake('a/body.bin'),fake('a/tex.png')],fake('a/hero.gltf')).mapped.size,2);});
 test('BLEND, FBX and BIN categories',()=>{eq(classifyAsset(fake('x.blend')),'needs-blender');eq(classifyAsset(fake('x.fbx')),'model');eq(classifyAsset(fake('x.bin')),'companion');});
 test('OBJ links its MTL',()=>eq(scanOBJDependencies('mtllib fabric.mtl\n',[fake('a/fabric.mtl')],fake('a/mesh.obj')).found.size,1));
 test('missing OBJ MTL flagged',()=>refusal(()=>scanOBJDependencies('mtllib absent.mtl\n',[],fake('a.obj')),'Missing'));
 test('GLB roundtrip audit detects lost clips',()=>{const b={meshCount:1,triangles:12,boneCount:3,skinnedMeshes:1,clipCount:1,trackCount:6,materials:1,textures:1};eq(compareExportAudit(b,{...b,trackCount:4}).ok,false);});
 return results;
}
