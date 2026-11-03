// Headless Codex bridge: JSON messages shared through a user-approved local folder.
// No browser clicking, no API keys, no remote uploads, and no automatic paint commits.
import {createUVOverlapInspector} from './ai-paint-uv-guard.js';
export function installHeadlessPaintBridge(api){
 const {$,getTarget,getMeshIndex,getModelHash,getModelName,getModelBlob,getSession,
  getResolution,getReferenceBlob,vectorPaint,save,finishPaint}=api;
 const inspect=createUVOverlapInspector(),schema='colab-ai-paint-recipe-v1';
 const taskFile='colab-paint-task.json',recipeFile='colab-paint-recipe.json';
 const modelFile='colab-model.glb',referenceFile='colab-reference.png';
 let folder=null,task=null,pending=null,validation=null,lastFileStamp=null,watcher=null,reading=false;
 const maxBytes=1024*1024;
 const status=message=>$('aiPaintStatus').textContent=message;
 const canvasBlob=c=>new Promise((res,rej)=>c.toBlob(blob=>blob?res(blob):rej(Error('PNG encoding failed')),'image/png'));
 function selected(){
  const mesh=getTarget(),index=getMeshIndex(),hash=getModelHash(),name=getModelName();
  if(!mesh?.geometry?.attributes?.uv||!hash||!Number.isInteger(index)||index<0)
   throw Error('Select a valid UV-mapped mesh in Paint first.');
  const resolution=getSession(mesh)?.canvas.width||getResolution();
  if(![1024,2048].includes(resolution))throw Error('Unsupported texture size.');
  return {mesh,index,hash,name,resolution};
 }
 function download(text,name){
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 async function write(name,blob){
  const handle=await folder.getFileHandle(name,{create:true}),stream=await handle.createWritable();
  try{await stream.write(blob)}finally{await stream.close()}
 }
 function createTask(){
  const m=selected(),geo=m.mesh.geometry,positions=geo.attributes.position,uv=geo.attributes.uv;
  const report=inspect.inspect(m.mesh);
  return {schema:'colab-ai-paint-task-v1',taskId:crypto.randomUUID(),createdAt:new Date().toISOString(),
   model:{name:m.name,sha256:m.hash,localFile:modelFile},mesh:{index:m.index,name:m.mesh.name||'',
    triangles:Math.floor((geo.index?.count||positions.count)/3),vertices:positions.count,uvVertices:uv.count},
   textureResolution:m.resolution,referenceFile:referenceFile,
   instruction:String($('aiPaintInstruction').value||'Propose one small flat-color outfit panel.').slice(0,4000),
   outputRecipe:recipeFile,
   recipeFormat:{schema:schema,taskId:'copy taskId',modelHash:'copy model.sha256',
    meshIndex:'copy mesh.index',meshName:'copy mesh.name',resolution:'copy textureResolution',
    forms:[{kind:'vector_fill',points:[[0.31,0.36],[0.39,0.36],[0.35,0.43]],
      color:'#5e815e',opacity:1,smooth:false,outline:0}]},
   uvPreflight:{collisionsDetected:report.overlappingCells??null,problem:report.error||null,
    caution:'UV coordinates may be shared. CoLab rejects recipes where sampled UV collisions are detected, but this heuristic cannot guarantee absence of spill.'},
   privacy:'All model and reference files remain on the local computer, inside the selected folder.'};
 }
 async function exportTask(){
  try{
   finishPaint();task=createTask();pending=null;validation=null;lastFileStamp=null;
   $('aiPaintApprove').disabled=true;$('aiPaintPreview').hidden=true;
   const json=JSON.stringify(task,null,2);
   if(folder){
    const source=getModelBlob();
    if(!(source instanceof Blob)||source.size>64*1024*1024)
     throw Error('Model must be loaded locally as a GLB under 64 MB for folder export.');
    await write(modelFile,source);
    const reference=await getReferenceBlob();
    if(reference instanceof Blob&&reference.size<12*1024*1024){
     const img=await createImageBitmap(reference),cv=document.createElement('canvas');
     cv.width=img.width;cv.height=img.height;cv.getContext('2d').drawImage(img,0,0);
     img.close?.();await write(referenceFile,await canvasBlob(cv));
    }
    const p=getSession(getTarget());
    if(p)await write('colab-current-texture.png',await canvasBlob(p.canvas));
    await write(taskFile,json);
    status('Paint task saved to your local folder with the model. Codex can now write '+recipeFile+'. CoLab watches for changes; nothing will paint without your approval.');
   }else{
    download(json,taskFile);
    status('Paint task downloaded. Connect a local folder for automatic handoff, or import the Codex recipe JSON manually.');
   }
   $('aiPaintTaskId').textContent=task.taskId;
  }catch(err){status('Could not export task: '+err.message)}
 }
 function validateRecipe(data){
  if(!data||data.schema!==schema||!task)throw Error('Unsupported recipe or missing exported task.');
  const m=selected();
  if(data.taskId!==task.taskId||data.modelHash!==m.hash||data.meshIndex!==m.index||
    data.meshName!==(m.mesh.name||'')||data.resolution!==m.resolution)
   throw Error('Recipe does not match the original task, mesh, model fingerprint, or resolution.');
  if(!Array.isArray(data.forms)||!data.forms.length||data.forms.length>32)
   throw Error('Recipe must include 1–32 filled vector forms.');
  const forms=data.forms.map((f,i)=>{
   if(f.kind!=='vector_fill'||!Array.isArray(f.points)||f.points.length<3||f.points.length>500||
    f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))
    throw Error('Invalid points for form '+(i+1));
   if(typeof f.color!=='string'||!/^#[0-9a-f]{6}$/i.test(f.color)||
    !Number.isFinite(f.opacity??1)||(f.opacity??1)<.05||(f.opacity??1)>1||
    !Number.isFinite(f.outline??0)||(f.outline??0)<0||(f.outline??0)>20||
    typeof(f.smooth??false)!=='boolean')
    throw Error('Invalid fill style for form '+(i+1));
   return {points:f.points.map(p=>p.slice()),color:f.color.toLowerCase(),
    opacity:f.opacity??1,smooth:f.smooth??false,outline:f.outline??0};
  });
  const guard=inspect.analyze(m.mesh,forms);
  if(guard.blocked)throw Error('Unsafe UV region: '+guard.reason+
    ' Choose another panel or repair the UV mapping before headless fills.');
  return {forms,guard,mesh:m.mesh};
 }
 function drawPreview(){
  const cv=$('aiPaintPreview'),ctx=cv.getContext('2d'),m=selected(),p=getSession(m.mesh);
  cv.width=cv.height=Math.min(m.resolution,1024);
  ctx.clearRect(0,0,cv.width,cv.height);
  if(p)ctx.drawImage(p.canvas,0,0,cv.width,cv.height);
  else{ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height)}
  if(!validation)return;
  for(const f of validation.forms){
   const q=pt=>[pt[0]*cv.width,(1-pt[1])*cv.height];
   ctx.save();ctx.beginPath();ctx.moveTo(...q(f.points[0]));
   if(f.smooth){
    for(let i=0;i<f.points.length;i++){
     const n=f.points.length,a=q(f.points[i]),b=q(f.points[(i+1)%n]),
      before=q(f.points[(i+n-1)%n]),after=q(f.points[(i+2)%n]);
     ctx.bezierCurveTo(a[0]+(b[0]-before[0])/6,a[1]+(b[1]-before[1])/6,
      b[0]-(after[0]-a[0])/6,b[1]-(after[1]-a[1])/6,b[0],b[1]);
    }
   }else for(let i=1;i<f.points.length;i++)ctx.lineTo(...q(f.points[i]));
   ctx.closePath();ctx.globalAlpha=f.opacity;ctx.fillStyle=f.color;ctx.fill();
   ctx.restore();
  }
 }
 async function receive(json,label){
  try{
   if(json.length>maxBytes)throw Error('Recipe is over 1 MB.');
   const result=validateRecipe(JSON.parse(json));
   pending=JSON.parse(json);validation=result;
   drawPreview();$('aiPaintPreview').hidden=false;$('aiPaintApprove').disabled=false;
   status('Codex recipe from '+label+' validated: '+result.forms.length+' vector fill(s). UV sampling found no conflicts inside those forms, but it is NOT a guarantee. Review the UV preview before approving.');
  }catch(err){
   pending=null;validation=null;$('aiPaintPreview').hidden=true;$('aiPaintApprove').disabled=true;
   status('Recipe REJECTED: '+err.message);
  }
 }
 async function scan(){
  if(!folder||reading||!task)return;
  reading=true;
  try{
   const fh=await folder.getFileHandle(recipeFile),f=await fh.getFile();
   const stamp=f.lastModified+':'+f.size;
   if(stamp!==lastFileStamp){
    lastFileStamp=stamp;
    if(f.size>maxBytes)throw Error('Codex recipe exceeds 1 MB.');
    await receive(await f.text(),recipeFile);
   }
  }catch(err){if(err?.name!=='NotFoundError')status('Recipe check: '+err.message)}
  finally{reading=false}
 }
 $('aiPaintConnect').onclick=async()=>{
  try{
   if(typeof window.showDirectoryPicker!=='function')
    throw Error('Folder picker unsupported in this browser; manual recipe import remains available.');
   folder=await window.showDirectoryPicker({mode:'readwrite'});
   if(watcher!==null)clearInterval(watcher);
   watcher=setInterval(scan,3000);
   $('aiPaintConnect').textContent='Change connected folder';
   status('Connected local folder: '+folder.name+'. Export task, then run Codex against this folder. Recipes are checked every 3 seconds.');
  }catch(err){if(err?.name!=='AbortError')status('Cannot connect folder: '+err.message)}
 };
 $('aiPaintExport').onclick=exportTask;
 $('aiPaintCheck').onclick=scan;
 $('aiPaintRecipeFile').onchange=async e=>{
  const file=e.target.files?.[0];if(file){
   if(file.size>maxBytes)status('Recipe exceeds 1 MB.');
   else await receive(await file.text(),file.name);
  }
  e.target.value='';
 };
 $('aiPaintApprove').onclick=()=>{
  if(!pending||!validation)return;
  try{
   const checked=validateRecipe(pending);
   finishPaint();const count=vectorPaint().applyHeadlessForms(checked.forms);
   pending=null;validation=null;$('aiPaintApprove').disabled=true;$('aiPaintPreview').hidden=true;
   status('Applied '+count+' editable vector form(s). Inspect the WHOLE model for UV color spill. Undo vector edit reverses this pass as one step.');
   save();
  }catch(err){status('Recipe could not be applied: '+err.message)}
 };
 $('aiPaintReject').onclick=()=>{
  pending=null;validation=null;$('aiPaintApprove').disabled=true;$('aiPaintPreview').hidden=true;
  status('Recipe discarded. Existing character painting unchanged.');
 };
 window.addEventListener('pagehide',()=>{if(watcher!==null)clearInterval(watcher)});
 return {receive,exportTask,scan};
}
