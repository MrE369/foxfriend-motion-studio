// CoLab Character Workshop CW-01/02: read-only rig audit and strictly matched animation preview.
// No automatic retargeting, no shared-skeleton assumption, no source-file overwrites.
export function summarizeCharacter(entry){
 if(!entry?.root)throw Error('Choose a loaded character or outfit.');
 const meshes=[],bones=[],materials=new Set(),textures=new Set(),nodes=[];
 let vertices=0,triangles=0,skinned=0,weightProblems=0;
 entry.root.traverse(o=>{
   nodes.push({name:o.name||'(unnamed)',type:o.type,parent:o.parent?.name||''});
   if(o.isBone)bones.push({name:o.name,parentBone:nearestBone(o)?.name||null});
   if(!o.isMesh)return;
   const g=o.geometry;
   const count=g?.attributes?.position?.count||0;
   const tris=g?.index?.count?Math.floor(g.index.count/3):Math.floor(count/3);
   vertices+=count;triangles+=tris;
   if(o.isSkinnedMesh)skinned++;
   const w=g?.getAttribute('skinWeight');
   if(o.isSkinnedMesh&&!w)weightProblems++;
   else if(w)for(let i=0;i<w.count;i++){
     const sum=w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i);
     if(!Number.isFinite(sum)||Math.abs(sum-1)>.08)weightProblems++;
   }
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
     if(!m)continue;materials.add(m);
     for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap'])if(m[key])textures.add(m[key]);
   }
   meshes.push({name:o.name||'(unnamed)',vertices:count,triangles:tris,skinned:!!o.isSkinnedMesh,hasUV:!!g?.attributes?.uv,hasWeights:!!w,material:o.material?.name||'(multiple/default)'});
 });
 return {source:entry.name,resources:entry.resources||[entry.name],meshes,vertices,triangles,skinnedMeshes:skinned,bones,boneCount:bones.length,materials:materials.size,textures:textures.size,clips:(entry.clips||[]).map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length})),nodes:nodes.slice(0,200),weightProblems,notes:[
 'Counts may include duplicated vertices across mesh primitives.',
 'Skin weights are checked for approximate normalization, not deformation quality.',
 'FBX, OBJ and ZIP archives require conversion or extraction before this pilot.',
 'Rig and animation correctness require live pose and export/reimport testing.'
 ]};
}
function nearestBone(o){let p=o?.parent;while(p){if(p.isBone)return p;p=p.parent;}return null;}
function indexNodes(root){
 const lookup=new Map(),duplicates=new Set();
 root.traverse(o=>{
  if(!o.name)return;
  if(lookup.has(o.name))duplicates.add(o.name);else lookup.set(o.name,o);
 });
 return {lookup,duplicates};
}
export function checkClipCompatibility(THREE,target,donor,clip){
 if(!target?.root||!clip?.tracks?.length)return {ok:false,reason:'Select a character and nonempty animation.',missing:[],duplicates:[],hierarchy:[]};
 const own=donor===target;
 const dest=indexNodes(target.root),src=donor?.scene?indexNodes(donor.scene):donor?.root?indexNodes(donor.root):null;
 const missing=[],duplicates=[],hierarchy=[],properties=new Set(),matchedBones=new Set();
 let parsed=0;
 for(const track of clip.tracks){
  let binding;
  try{binding=THREE.PropertyBinding.parseTrackName(track.name);}catch{missing.push('Unreadable track '+track.name);continue;}
  const name=binding.nodeName;
  const targetNode=dest.lookup.get(name);
  if(!targetNode){missing.push(name||track.name);continue;}
  if(dest.duplicates.has(name)){duplicates.push(name);continue;}
  if(!['position','quaternion','scale','morphTargetInfluences'].includes(binding.propertyName)){
   missing.push(track.name+' (unsupported property)');continue;
  }
  if(targetNode.isBone)matchedBones.add(name);
  if(src&&!own){
   const sourceNode=src.lookup.get(name);
   if(!sourceNode||src.duplicates.has(name)){missing.push(name+' (ambiguous/missing in source)');continue;}
   if(!!sourceNode.isBone!==!!targetNode.isBone){hierarchy.push(name+' (bone type mismatch)');continue;}
   if(sourceNode.isBone){
     const a=nearestBone(sourceNode)?.name||null,b=nearestBone(targetNode)?.name||null;
     if(a!==b)hierarchy.push(name+' (parent: '+a+' vs '+b+')');
   }
  }
  properties.add(binding.propertyName);parsed++;
 }
 const problems=[...new Set([...missing,...duplicates,...hierarchy])];
 const ok=problems.length===0&&parsed===clip.tracks.length;
 const destSkinned=target.root.getObjectByProperty('isSkinnedMesh',true);
 if(!own&&!destSkinned)return {ok:false,reason:'External humanoid animation requires a skinned character.',missing,duplicates,hierarchy,matched:parsed,total:clip.tracks.length};
 return {ok,reason:ok?'All animation targets found with matching bone hierarchy. This does not guarantee matching bind poses or good motion.':'Missing, duplicated or incompatible animation bindings.',missing:[...new Set(missing)],duplicates:[...new Set(duplicates)],hierarchy:[...new Set(hierarchy)],matched:parsed,total:clip.tracks.length,boneTracks:matchedBones.size,properties:[...properties]};
}
export function installCharacterWorkshop({THREE,GLTFLoader,loadLocalGltf,getSelected,getEntries,getVisible,notify}){
 const $=id=>document.getElementById(id);
 let library=[],mixer=null,playing=false,current=null,action=null,playback=0,active=true,lastStamp=0,report=null;
 const status=txt=>{$('cwStatus').textContent=txt;notify?.(txt);};
 const hasUI=()=>!!$('cwClip');
 function stop(){
   playing=false;
   if(mixer)mixer.stopAllAction();
   mixer=null;action=null;current=null;playback=0;
   $('cwPlay').textContent='▶ Play animation';
   $('cwScrub').value=0;$('cwClock').textContent='0.00 s';
 }
 function options(){
   if(!hasUI())return;
   stop();
   const sel=$('cwClip');sel.replaceChildren();
   const first=document.createElement('option');first.value='';first.textContent='Choose an animation';sel.append(first);
   const entry=getSelected();
   for(let i=0;i<(entry?.clips?.length||0);i++){
     const c=entry.clips[i],o=document.createElement('option');
     o.value='self:'+i;o.textContent='Character · '+c.name+' ('+c.duration.toFixed(1)+'s)';sel.append(o);
   }
   library.forEach((src,i)=>src.clips.forEach((c,j)=>{const o=document.createElement('option');
     o.value=i+':'+j;o.textContent=src.name+' · '+c.name+' ('+c.duration.toFixed(1)+'s)';sel.append(o);}));
   $('cwClipCount').textContent=(sel.options.length-1)+' available clips';
 }
 function resolve(){
   const v=$('cwClip').value;
   if(!v)return null;
   if(v.startsWith('self:')){const target=getSelected(),clip=target?.clips?.[Number(v.split(':')[1])];return target&&clip?{donor:target,clip}:null;}
   const [a,b]=v.split(':').map(Number),donor=library[a],clip=donor?.clips[b];
   return donor&&clip?{donor,clip}:null;
 }
 function check(){
   const target=getSelected(),r=resolve();
   if(!target||!r){$('cwCompat').textContent='Select an animation and an assembled character.';return null;}
   const result=checkClipCompatibility(THREE,target,r.donor,r.clip);
   $('cwCompat').textContent=(result.ok?'✓ Strict name/hierarchy check passed. ':'✕ Not compatible. ')+result.reason+
    ' '+(result.missing?.length?'Missing: '+result.missing.slice(0,6).join(', ')+'. ':'')+
    (result.hierarchy?.length?'Hierarchy: '+result.hierarchy.slice(0,6).join(', ')+'.':'');
   return result;
 }
 function inspect(){
   stop();options();
   const entry=getSelected();
   if(!entry){$('cwReport').textContent='Load a body GLB or glTF and select it for inspection.';report=null;return;}
   report=summarizeCharacter(entry);
   const b=new THREE.Box3().setFromObject(entry.root),size=b.getSize(new THREE.Vector3());
   report.extentsMeters=size.toArray().map(n=>+n.toFixed(5));
   const lines=[
    entry.name+' · '+report.meshes.length+' mesh(es) · '+report.vertices+' vertices · '+report.triangles+' triangles',
    'Size XYZ: '+report.extentsMeters.join(' × ')+' (glTF coordinate units; verify real-world scale)',
    'Skinned meshes '+report.skinnedMeshes+' · bones '+report.boneCount+' · materials '+report.materials+' · textures '+report.textures,
    'Animation clips embedded '+report.clips.length+' · weight warnings '+report.weightProblems,
    '--- Mesh details ---',
    ...report.meshes.slice(0,18).map(x=>(x.skinned?'🦴 ':'◇ ')+x.name+' · '+x.triangles+' tris · UV '+(x.hasUV?'yes':'no')+' · weights '+(x.hasWeights?'yes':'no')),
    ...(report.meshes.length>18?['… more meshes in JSON report']:[]),
    '--- Bones (first 30) ---',
    ...report.bones.slice(0,30).map(x=>x.name+' ← '+(x.parentBone||'root')),
    ...(report.bones.length>30?['… more bones in JSON report']:[])
   ];
   $('cwReport').textContent=lines.join('\n');
   $('cwCompat').textContent='Choose an animation to run the strict compatibility check.';
 }
 async function importAnimations(files){
   if(!files?.length)return;
   $('cwAnimFiles').disabled=true;
   try{
    const primary=Array.from(files).filter(f=>/\.(glb|gltf)$/i.test(f.name));
    if(!primary.length)throw Error('Select a .glb or .gltf file with animation clips.');
    for(const file of primary){
      if(file.size>90*1024*1024)throw Error('Animation file exceeds 90 MB safety limit.');
      const {gltf}=await loadLocalGltf(THREE,GLTFLoader,file,files);
      if(!gltf.animations.length){status(file.name+' has no animation clips.');continue;}
      library.push({name:file.name,scene:gltf.scene,clips:gltf.animations});
      if(library.length>16)library.shift();
      status('Imported '+gltf.animations.length+' animation clips from '+file.name+'.');
    }
   }catch(e){status('Animation import failed: '+e.message);}
   finally{$('cwAnimFiles').disabled=false;$('cwAnimFiles').value='';options();}
 }
 function play(){
   const target=getSelected(),r=resolve();
   if(!target||!r)return status('Select a model and animation first.');
   if(playing){playing=false;$('cwPlay').textContent='▶ Resume animation';status('Animation paused.');return;}
   const test=check();
   if(!test?.ok)return status('Animation blocked because binding validation failed.');
   if(!action||current?.root!==target.root||current?.clip!==r.clip){
     stop();
     mixer=new THREE.AnimationMixer(target.root);
     action=mixer.clipAction(r.clip);
     current={root:target.root,clip:r.clip};
     playback=0;
   }
   action.setLoop($('cwLoop').checked?THREE.LoopRepeat:THREE.LoopOnce,Infinity);
   action.clampWhenFinished=true;action.paused=false;action.play();
   playing=true;$('cwPlay').textContent='⏸ Pause animation';
   $('cwScrub').max=Math.max(.0001,r.clip.duration);
   $('cwScrub').step=.01;
   status('Playing '+r.clip.name+'. Watch elbows, shoulders, knees and feet.');
 }
 function scrub(value){
   const r=resolve(),target=getSelected();if(!r||!target)return;
   const test=check();if(!test?.ok)return;
   if(!action||current?.root!==target.root||current?.clip!==r.clip){
     stop();mixer=new THREE.AnimationMixer(target.root);action=mixer.clipAction(r.clip);action.play();current={root:target.root,clip:r.clip};
   }
   playing=false;action.paused=false;
   playback=Math.min(Math.max(0,Number(value)||0),r.clip.duration);
   mixer.setTime(playback);action.paused=true;$('cwClock').textContent=playback.toFixed(2)+' s';
   $('cwPlay').textContent='▶ Resume animation';
 }
 function update(delta){
   if(!playing||!mixer||!current||!getVisible())return;
   const d=Math.min(.05,Math.max(0,delta||0));
   mixer.update(d);
   playback=mixer.time;
   const duration=current.clip.duration||0;
   $('cwScrub').max=Math.max(.0001,duration);
   $('cwScrub').value=duration&&$('cwLoop').checked?playback%duration:Math.min(playback,duration);
   $('cwClock').textContent=Number($('cwScrub').value).toFixed(2)+' s';
   if(!$('cwLoop').checked&&playback>=duration){playing=false;$('cwPlay').textContent='▶ Play animation';}
 }
 function downloadReport(){
   if(!report)return status('Inspect a selected model first.');
   const blob=new Blob([JSON.stringify({schema:'colab-character-inspection-cw01',created:new Date().toISOString(),...report},null,2)],{type:'application/json'});
   const a=document.createElement('a'),url=URL.createObjectURL(blob);
   a.href=url;a.download='CoLab_Character_Inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
 }
 $('cwAnimFiles').addEventListener('change',e=>importAnimations([...e.target.files]));
 $('cwClip').onchange=()=>{stop();check();};
 $('cwPlay').onclick=play;
 $('cwStop').onclick=()=>{stop();status('Animation stopped and original rest pose restored where supported.');};
 $('cwScrub').oninput=e=>scrub(e.target.value);
 $('cwReportDownload').onclick=downloadReport;
 options();inspect();
 return {onSelect:inspect,onAssetAdded:inspect,setActive(v){active=v;if(!v)stop();},tick:update,inspect,clear:stop,
   addLibrarySource(item){
     if(!item?.clips?.length)throw Error('This file contains no animation clips.');
     library.push({name:item.name,scene:item.root,clips:item.clips});
     if(library.length>16)library.shift();
     options();
     status('Animation library added: '+item.name+' ('+item.clips.length+' clips). Choose a character and animation.');
   },
   validatedExportClip(){
     const target=getSelected(),r=resolve();
     if(!target||!r)return null;
     const check=checkClipCompatibility(THREE,target,r.donor,r.clip);
     return check.ok?r.clip:null;
   }
 };
}
