// CoLab Universal Import staging UI. The original File/ZIP objects are read-only.
// Preview is isolated from the working scene until explicit user acceptance.
import {unpackZipFile} from './zip-safe-import.js';
import {classifyAsset} from './universal-loaders.js';
import {sourcePath} from './gltf-local-intake.js';
const supported=new Set(['model','image','needs-blender']);
const mb=n=>(n/1048576).toFixed(1)+' MB';
export function installUniversalImport({THREE,scene,camera,controls,workingGroup,load,onAccept,onAnimation,onReference,notify}){
 const $=id=>document.getElementById(id);
 const sets=[],choices=[];let preview=null,current=-1,busy=false,previewURL=null,sessionBytes=0;
 const SESSION_MAX=185*1024*1024;
 const holder=new THREE.Group();holder.name='CoLab_Import_Preview_Only';scene.add(holder);
 const status=s=>{$('uaStatus').textContent=s;notify?.(s);};
 function cleanPreview(){
  if(preview?.release)preview.release();
  holder.clear();preview=null;
  if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null;}
  $('uaImage').hidden=true;$('uaImage').removeAttribute('src');
  $('uaAccept').disabled=true;$('uaUseAnimations').disabled=true;
  workingGroup.visible=true;
 }
 function currentChoice(){return choices[current]||null;}
 function updateList(){
  const sel=$('uaCandidates');sel.replaceChildren();
  for(let i=0;i<choices.length;i++){
   const item=choices[i],o=document.createElement('option');o.value=String(i);
   o.textContent=(i+1)+'. '+item.file.name+' · '+item.kind+' · '+item.source;
   sel.append(o);
  }
  if(current>=0&&current<choices.length)sel.value=String(current);
  $('uaCount').textContent=choices.length+' candidates from '+sets.length+' intake(s)';
  $('uaPreview').disabled=!choices.length||busy;
  $('uaAccept').disabled=!preview||busy;
  $('uaUseAnimations').disabled=!preview||busy||!preview.clips?.length;
 }
 function describe(){
  const x=currentChoice();
  if(!x){$('uaDetails').textContent='Choose a file or ZIP pack to list its models, animations and reference images.';return;}
  $('uaDetails').textContent='Source: '+x.source+'\nPath: '+sourcePath(x.file)+
    '\nFormat: '+x.file.name.split('.').at(-1).toUpperCase()+
    '\nFile size: '+mb(x.file.size)+
    '\nOriginal files: preserved in this browser session\n'+
    (x.kind==='needs-blender'?'Requires a configured Blender backend. None connected.':
     x.kind==='image'?'Reference image; does not create a 3D model.':
     'Click Preview to inspect before adding it to the scene.');
 }
 async function stage(files,origin='Selected files'){
  if(busy)return;busy=true;updateList();
  try{
   if(!files?.length)return status('Nothing selected.');
   const raw=Array.from(files);let modelFiles=[],archiveCount=0,total=0;
   for(const f of raw){
    if(/\.zip$/i.test(f.name)){
     status('Checking ZIP safety: '+f.name+'…');
     const unpacked=await unpackZipFile(f,msg=>status(msg),SESSION_MAX-sessionBytes);
     sessionBytes+=unpacked.manifest.uncompressedBytes;
     if(archiveCount++>=8)throw Error('Import at most eight ZIPs at a time.');
     const entry={source:f.name,files:unpacked.files,manifest:unpacked.manifest};
     sets.push(entry);
     for(const child of unpacked.files){if(supported.has(classifyAsset(child)))modelFiles.push({file:child,set:entry});}
   }else{
     total+=f.size;
   }
   }
   const loose=raw.filter(f=>!/\.zip$/i.test(f.name));
   if(loose.length){
     if(sessionBytes+total>SESSION_MAX)throw Error('Session assets exceed the 185 MB mobile memory guard.');
     sessionBytes+=total;
     const entry={source:origin,files:loose,manifest:null};
     sets.push(entry);
     for(const f of loose)if(supported.has(classifyAsset(f)))modelFiles.push({file:f,set:entry});
   }
   // Show actual model candidates first; Quaternius archives can contain
   // hundreds of texture images and must not hide their character files.
   const rank={model:0,image:1,'needs-blender':2};
   modelFiles.sort((a,b)=>(rank[classifyAsset(a.file)]??9)-(rank[classifyAsset(b.file)]??9));
   for(const {file,set} of modelFiles){
     if(choices.length>=450){status('Import catalogue capped at 450 candidate assets.');break;}
     choices.push({file,files:set.files,source:set.source,kind:classifyAsset(file)});
   }
   current=choices.length?Math.max(0,choices.length-modelFiles.length):-1;
   updateList();describe();
   status('Catalogued '+modelFiles.length+' candidate assets. Choose one and tap Preview. No working model was changed.');
  }catch(e){status('Import stopped: '+e.message);}
  finally{busy=false;updateList();}
 }
 function frame(root){
   if(!root)return;
   root.updateWorldMatrix(true,true);
   const box=new THREE.Box3().setFromObject(root);
   if(box.isEmpty())return;
   const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
   const d=Math.max(.3,size.length()*1.4);
   controls.target.copy(center);
   camera.position.copy(center).add(new THREE.Vector3(d*.36,d*.22,d));
   camera.near=Math.max(.001,d/1000);camera.far=Math.max(100,d*100);
   camera.updateProjectionMatrix();controls.update();
 }
 async function showPreview(){
  const choice=currentChoice();if(!choice||busy)return;
  busy=true;cleanPreview();updateList();
  try{
   if(choice.kind==='needs-blender')throw Error('.blend conversion requires an authorized Blender backend; browser decoding is unavailable.');
   status('Inspecting '+sourcePath(choice.file)+'…');
   const item=await load(choice.file,choice.files);
   let sha256=null;
   try{
     const digest=await crypto.subtle.digest('SHA-256',await choice.file.arrayBuffer());
     sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
   }catch{ /* Secure context or memory limit; preserve source filename/size. */ }
   preview={...item,choice,sha256};
   $('uaWarnings').textContent=(item.warnings||[]).join('\n')+(sha256?'\nSource SHA-256: '+sha256:'\nHash not available in this browser.');
   if(item.kind==='image'){
      previewURL=URL.createObjectURL(item.file);
      $('uaImage').src=previewURL;$('uaImage').hidden=false;
      $('uaMeta').textContent='Reference image · '+mb(item.file.size)+' · not added to the 3D scene';
   }else{
      if(!item.root)throw Error('Loader returned no scene.');
      let meshCount=0,bones=0;item.root.traverse(o=>{if(o.isMesh)meshCount++;if(o.isBone)bones++;});
      preview.meshCount=meshCount;preview.bones=bones;
      if(meshCount){holder.add(item.root);workingGroup.visible=false;frame(item.root);}
      $('uaMeta').textContent='Preview: '+meshCount+' meshes · '+bones+' bones · '+item.clips.length+' clips · '+item.format;
      if(!meshCount&&!item.clips.length)throw Error('No geometry or animations found.');
   }
   $('uaAccept').textContent=preview.kind==='image'?'Keep reference image':preview.meshCount?'✓ Add preview to scene':'✓ Add animation to library';
   $('uaUseAnimations').textContent=preview.clips?.length?'♫ Import '+preview.clips.length+' animations without mannequin':'♫ No animations to import';
   status('Preview ready; choose Add only if this is the asset you want.');
  }catch(e){
   cleanPreview();$('uaMeta').textContent='Preview failed.';
   status('Preview failed: '+e.message);
  }finally{busy=false;updateList();}
 }
 async function accept(){
  if(!preview||busy)return;
  busy=true;const item=preview;
  try{
   if(item.kind==='image')await onReference(item);
   else if(item.meshCount===0)await onAnimation(item);
   else{
     holder.remove(item.root);
     await onAccept({...item,name:sourcePath(item.choice.file),size:item.choice.file.size});
   }
   preview=null;cleanPreview();
   status('Accepted '+sourcePath(item.choice.file)+'. Original source files unchanged.');
  }catch(e){status('Could not accept preview: '+e.message);if(!preview)preview=item;}
  finally{busy=false;updateList();}
 }
 $('asAdd').onclick=()=>$('asFiles').click();
 $('asFiles').onchange=async e=>{const fs=[...e.target.files];e.target.value='';await stage(fs,'Selected files');};
 $('uaFolderButton').onclick=()=>$('uaFolder').click();
 $('uaFolder').onchange=async e=>{const fs=[...e.target.files];e.target.value='';await stage(fs,'Selected folder');};
 $('uaCandidates').onchange=e=>{cleanPreview();current=Number(e.target.value);describe();updateList();};
 async function useAnimations(){
   if(!preview?.clips?.length||busy)return status('This asset has no animation clips.');
   busy=true;const item=preview;
   try{
     await onAnimation(item);
     holder.remove(item.root);
     preview=null;cleanPreview();
     status('Added '+item.clips.length+' animations from '+sourcePath(item.choice.file)+
       '. Its source mannequin was NOT inserted into the assembly.');
   }catch(e){status('Animation library import failed: '+e.message);}
   finally{busy=false;updateList();}
 }
 $('uaPreview').onclick=showPreview;$('uaAccept').onclick=accept;
 $('uaUseAnimations').onclick=useAnimations;
 $('uaCancel').onclick=()=>{cleanPreview();status('Preview discarded. Original assets stay available for selection.');};
 const target=$('uaDrop');
 for(const event of ['dragenter','dragover']){
  target.addEventListener(event,e=>{e.preventDefault();target.classList.add('ua-hover');});
 }
 target.addEventListener('dragleave',()=>target.classList.remove('ua-hover'));
 target.addEventListener('drop',async e=>{
  e.preventDefault();target.classList.remove('ua-hover');
  const fs=[...e.dataTransfer.files];
  await stage(fs,'Dropped files');
 });
 updateList();describe();
 return {stage,clearPreview:cleanPreview,isPreviewing:()=>!!preview};
}
