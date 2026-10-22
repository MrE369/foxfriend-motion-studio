import {installSculptTools} from './sculpt-tools.js';
// CoLab Multi-GLB Assembly Lab — isolated experimental workspace.
// Original GLBs are never overwritten. Nothing is uploaded to a server.
export function installAssemblyLab({THREE,GLTFLoader,GLTFExporter,scene,camera,renderer,controls,getOriginal,getCandidate}){
 const $=id=>document.getElementById(id);
 const group=new THREE.Group();group.name='CoLab_MultiGLB_Assembly';group.visible=false;scene.add(group);
 const guides=new THREE.Group();guides.visible=false;scene.add(guides);
 guides.add(new THREE.GridHelper(2,20,0x69869b,0x3d5265));
 const loaded=[];const undo=[];let current=-1,active=false,busy=false,drag=null,outline=null;
 const sculpt=installSculptTools({THREE,renderer,camera,controls,getSelected:()=>selected(),getActive:()=>active,onUpdate:()=>{if(outline)outline.update();}});
 const inputs=['asX','asY','asZ','asPitch','asYaw','asRoll','asScale'];
 const msg=t=>{$('asStatus').textContent=t};
 const selected=()=>loaded[current]||null;
 const bounds=()=>new THREE.Box3().setFromObject(group);
 function update(){
  const list=$('asList');list.replaceChildren();
  for(let i=0;i<loaded.length;i++){const opt=document.createElement('option');opt.value=i;opt.textContent=(i+1)+' · '+loaded[i].name;list.append(opt);}
  if(current>=0)list.value=String(current);
  const entry=selected(),r=entry?.root;
  $('asSelected').textContent=entry?'Selected: '+entry.name:'Choose a model in the list or tap it in the viewer.';
  const vals=r?[r.position.x,r.position.y,r.position.z,r.rotation.x*180/Math.PI,r.rotation.y*180/Math.PI,r.rotation.z*180/Math.PI,r.scale.x]:[];
  inputs.forEach((id,i)=>{$(id).disabled=!r||busy;if(r)$(id).value=Number(vals[i].toFixed(4));});
  for(const id of ['asLeft','asRight','asUp','asDown','asBack','asForward','asTiltLeft','asTiltRight','asReset','asRemove'])$(id).disabled=!r||busy;
  $('asUndo').disabled=!undo.length||busy;$('asExport').disabled=!loaded.length||busy;
  $('asHeight').disabled=!loaded.length||busy;$('asPreset').disabled=loaded.length<2||busy;
  const b=bounds();$('asInfo').textContent=loaded.length+' GLB(s) · '+(b.isEmpty()?0:b.getSize(new THREE.Vector3()).y).toFixed(3)+' m high';
  if(outline){guides.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}
  if(r){outline=new THREE.BoxHelper(r,0xffd566);guides.add(outline);}
 }
 function choose(n){sculpt.cancel();current=(Number.isInteger(n)&&n>=0&&n<loaded.length)?n:-1;update();}
 function save(){const r=selected()?.root;if(!r)return;undo.push({root:r,pos:r.position.toArray(),rot:[r.rotation.x,r.rotation.y,r.rotation.z],scale:r.scale.toArray()});if(undo.length>30)undo.shift();}
 function change(){update();}
 function setField(id,v){
  const r=selected()?.root,ix=inputs.indexOf(id);if(!r||ix<0)return;
  v=Number(v);
  if(!Number.isFinite(v)||ix<3&&Math.abs(v)>10||ix>=3&&ix<6&&Math.abs(v)>180||ix===6&&(v<.02||v>20))return msg('Invalid value: positions ±10, angles ±180°, scale 0.02–20.');
  save();
  if(ix<3)r.position[['x','y','z'][ix]]=v;
  else if(ix<6)r.rotation[['x','y','z'][ix-3]]=THREE.MathUtils.degToRad(v);
  else r.scale.setScalar(v);
  change();msg('Moved '+selected().name+'. Original file preserved.');
 }
 function nudge(axis,delta){const r=selected()?.root;if(!r)return;save();if(axis==='pitch')r.rotation.x+=THREE.MathUtils.degToRad(delta);else r.position[axis]+=delta;change();}
 function frame(){
  if(!loaded.length)return;
  const b=bounds(),center=b.getCenter(new THREE.Vector3()),d=Math.max(.2,b.getSize(new THREE.Vector3()).length()*1.45);
  controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.38,d*.25,d));
  camera.up.set(0,1,0);camera.near=Math.max(.001,d/1000);camera.far=Math.max(100,d*100);camera.updateProjectionMatrix();controls.update();
 }
 async function check(file){
  if(file.size<20||file.size>80*1024*1024)throw Error('GLB must be under 80 MB.');
  const b=await file.slice(0,12).arrayBuffer(),d=new DataView(b);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==file.size)
   throw Error('Invalid GLB. If downloaded as ZIP, extract it first.');
 }
 async function add(files){
  if(busy)return;busy=true;update();
  try{
   for(const file of [...files]){
    try{
     if(loaded.length>=12)throw Error('12-item safety limit');
     if(file.size+loaded.reduce((n,x)=>n+x.size,0)>180*1024*1024)throw Error('180 MB project safety limit');
     await check(file);msg('Loading '+file.name+'…');
     const gltf=await new GLTFLoader().parseAsync(await file.arrayBuffer(),'');
     let meshCount=0;gltf.scene.traverse(o=>{if(o.isMesh)meshCount++;});if(!meshCount)throw Error('Model has no meshes.');
     gltf.scene.name='Part_'+(loaded.length+1)+'_'+file.name.replace(/[^a-z0-9_-]/gi,'_');
     group.add(gltf.scene);loaded.push({name:file.name,root:gltf.scene,size:file.size,clips:gltf.animations});
     choose(loaded.length-1);if(loaded.length===1)frame();
     msg('Added '+file.name+' alongside the other models.');
    }catch(e){msg('Could not load '+file.name+': '+e.message);}
   }
  }finally{busy=false;update();}
 }
 function normalize(){
  if(!loaded.length)return;
  group.scale.setScalar(1);group.position.set(0,0,0);const b=bounds(),h=b.max.y-b.min.y;
  if(!Number.isFinite(h)||h<.001)return msg('Invalid assembly height.');
  const s=1.753/h;group.scale.setScalar(s);group.position.y=-b.min.y*s;
  update();msg('Overall height set to 1.753 m (5 feet 9 inches).');
 }
 function preset(){
  const h=loaded.find(x=>/head/i.test(x.name)),b=loaded.find(x=>/body/i.test(x.name));
  if(!h||!b||h===b)return msg('Finn preset needs separate files named head and body.');
  if(!confirm('Apply initial Finn fit to these two GLBs? You can adjust each afterward.'))return;
  group.scale.setScalar(1);group.position.set(0,0,0);
  choose(loaded.indexOf(b));save();b.root.position.set(0,0,0);b.root.rotation.set(0,0,0);b.root.scale.setScalar(1);
  choose(loaded.indexOf(h));save();h.root.position.set(0,.90,0);h.root.rotation.set(THREE.MathUtils.degToRad(-8),0,0);h.root.scale.setScalar(.24);
  normalize();frame();msg('Finn preset placed head and body. Select head to adjust its position and neck tilt.');
 }
 function remove(){
  const s=selected();if(!s||!confirm('Remove '+s.name+' from the assembly? Source file stays untouched.'))return;
  group.remove(s.root);loaded.splice(current,1);undo.length=0;choose(Math.min(current,loaded.length-1));msg('Removed only from this workspace.');
 }
 function saveDownload(name,blob){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
 }
 async function exportGLB(){
  if(!loaded.length||busy)return;
  if(!confirm('Export a NEW combined GLB? It will keep component meshes separate internally.'))return;
  busy=true;update();msg('Exporting a new GLB locally…');
  try{
   let tooLarge=false;
   group.traverse(o=>{const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m)for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap']){const im=m[key]?.image||m[key]?.source?.data;if(im&&(im.width>4096||im.height>4096))tooLarge=true;}});
   if(tooLarge&&!confirm('Some textures are above 4096 px and may downsample on export. Continue?')){msg('Export cancelled.');return;}
   const clips=loaded.flatMap(x=>x.clips);
   const bytes=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:false,animations:clips,maxTextureSize:4096});
   saveDownload('CoLab_MultiGLB_Assembly_TEST.glb',new Blob([bytes],{type:'model/gltf-binary'}));
   msg('Exported. Reimport into Inspect and check mesh positions, materials, and animations.');
  }catch(e){msg('Export failed: '+e.message);}finally{busy=false;update();}
 }
 function recipe(){
  const data={schema:'colab-multiglb-assembly-v1',parts:loaded.map(x=>({name:x.name,size:x.size,position:x.root.position.toArray(),rotation:[x.root.rotation.x,x.root.rotation.y,x.root.rotation.z],scale:x.root.scale.toArray()})),assembly:{position:group.position.toArray(),scale:group.scale.toArray()},sourceFilesRequired:true};
  saveDownload('CoLab_Assembly_Recipe.json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 }
 const ray=new THREE.Raycaster(),point=new THREE.Vector2();
 function aim(e){
  const rect=renderer.domElement.getBoundingClientRect();
  point.set(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height);ray.setFromCamera(point,camera);
 }
 function down(e){
  if(sculpt.isEditing()||!active||!loaded.length||e.button!==0)return;
  aim(e);const hits=ray.intersectObjects(loaded.map(x=>x.root),true);if(!hits.length)return;
  let node=hits[0].object;while(node&&!loaded.some(x=>x.root===node))node=node.parent;
  const i=loaded.findIndex(x=>x.root===node);if(i<0)return;choose(i);
  if(!$('asDrag').checked)return;
  const r=selected().root,plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),r.getWorldPosition(new THREE.Vector3()));
  const start=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!start)return;
  save();drag={id:e.pointerId,root:r,plane,start:start.clone(),initial:r.position.clone()};
  controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();
 }
 function move(e){
  if(sculpt.isEditing()||!active||!drag||drag.id!==e.pointerId)return;
  aim(e);const p=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!p)return;
  const delta=p.sub(drag.start).divide(group.scale);drag.root.position.copy(drag.initial).add(delta);
  if(outline)outline.update();e.preventDefault();
 }
 function end(e){if(!drag||e&&e.pointerId!==drag.id)return;drag=null;controls.enabled=true;update();}
 renderer.domElement.addEventListener('pointerdown',down);
 renderer.domElement.addEventListener('pointermove',move);
 renderer.domElement.addEventListener('pointerup',end);
 renderer.domElement.addEventListener('pointercancel',end);
 $('asAdd').onclick=()=>$('asFiles').click();
 $('asFiles').onchange=e=>{const fs=[...(e.target.files||[])];e.target.value='';add(fs);};
 $('asList').onchange=e=>choose(Number(e.target.value));
 for(const id of inputs)$(id).onchange=e=>setField(id,e.target.value);
 const step=()=>Number($('asStep').value)||.01;
 for(const [id,axis,sign] of [['asLeft','x',-1],['asRight','x',1],['asDown','y',-1],['asUp','y',1],['asBack','z',-1],['asForward','z',1]])$(id).onclick=()=>nudge(axis,sign*step());
 $('asTiltLeft').onclick=()=>nudge('pitch',-1);$('asTiltRight').onclick=()=>nudge('pitch',1);
 $('asFrame').onclick=frame;$('asHeight').onclick=normalize;$('asPreset').onclick=preset;
 $('asExport').onclick=exportGLB;$('asRecipe').onclick=recipe;$('asRemove').onclick=remove;
 $('asUndo').onclick=()=>{while(undo.length){const h=undo.pop();const i=loaded.findIndex(x=>x.root===h.root);if(i<0)continue;choose(i);h.root.position.fromArray(h.pos);h.root.rotation.set(...h.rot);h.root.scale.fromArray(h.scale);update();msg('Undid placement change.');break;}};
 $('asReset').onclick=()=>{const r=selected()?.root;if(!r||!confirm('Reset this part’s transform?'))return;save();r.position.set(0,0,0);r.rotation.set(0,0,0);r.scale.setScalar(1);update();};
 update();
 return {setActive(flag){if(!flag)sculpt.setActive(false);active=flag;group.visible=flag;guides.visible=flag;if(!flag){end();return;}const a=getOriginal(),b=getCandidate();if(a)a.visible=false;if(b)b.visible=false;controls.enabled=true;if(loaded.length)frame();},isActive:()=>active};
}
