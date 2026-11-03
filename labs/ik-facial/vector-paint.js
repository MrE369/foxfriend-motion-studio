// CoLab Vector Forms v0.1 -- local UV-space shapes over a separate raster shading layer.
// All changes are opt-in and never modify the source model or its UV coordinates.
export function installVectorPaintStudio(api){
 const {$,getTarget,getSession,startSession,finishPaint,selectMode,setMode,getMode,controls,overlay,hitForPaint,preview,save,notice}=api;
 const MAX_SHAPES=128,MAX_POINTS=512;
 const editor=$('vectorEditor'),ctx=editor.getContext('2d');
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const makeCanvas=size=>{const c=document.createElement('canvas');c.width=c.height=size;return c};
 const canvasBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Vector layer could not be saved.')),'image/png'));
 const safeHex=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
 const clone=obj=>JSON.parse(JSON.stringify(obj));
 let drag=null,editorDown=false;
 function targetSession(create=false){
  const m=getTarget();if(!m)return null;
  let p=getSession(m);
  if(!p&&create)p=startSession(m,Number($('paintResolution').value));
  return p||null;
 }
 function ensure(p){
  if(!p)return null;
  if(p.vector)return p.vector;
  const size=p.canvas.width,underlay=makeCanvas(size),shade=makeCanvas(size);
  underlay.getContext('2d').drawImage(p.canvas,0,0);
  p.vector={schema:'colab-vector-v1',underlay,shade,shadeCtx:shade.getContext('2d',{willReadFrequently:true}),
   shapes:[],draft:[],selected:-1,undo:[],shadeUndo:[],pendingShadeUndo:null};
  return p.vector;
 }
 function validateShapes(shapes){
  if(!Array.isArray(shapes)||shapes.length>MAX_SHAPES)throw Error('Too many vector forms.');
  return shapes.map((shape,i)=>{
   if(!shape||!Array.isArray(shape.points)||shape.points.length<3||shape.points.length>MAX_POINTS
      ||shape.points.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v)||v<0||v>1)))
       throw Error('Invalid vector contour '+(i+1)+'.');
   if(!safeHex(shape.color)||!Number.isFinite(shape.opacity)||shape.opacity<0.05||shape.opacity>1
      ||!Number.isFinite(shape.outline)||shape.outline<0||shape.outline>20
      ||typeof shape.smooth!=='boolean')throw Error('Invalid vector fill or outline '+(i+1)+'.');
   return {points:shape.points.map(q=>q.slice()),color:shape.color,
     opacity:shape.opacity,outline:shape.outline,smooth:shape.smooth};
  });
 }
 function tracePath(drawCtx,points,size,smooth,closed=true){
  if(points.length<2)return;
  const xy=q=>[q[0]*size,(1-q[1])*size],n=points.length;
  const first=xy(points[0]);drawCtx.beginPath();drawCtx.moveTo(first[0],first[1]);
  if(smooth&&n>=3&&closed){
   for(let i=0;i<n;i++){
    const a=xy(points[i]),b=xy(points[(i+1)%n]),before=xy(points[(i+n-1)%n]),after=xy(points[(i+2)%n]);
    drawCtx.bezierCurveTo(a[0]+(b[0]-before[0])/6,a[1]+(b[1]-before[1])/6,
      b[0]-(after[0]-a[0])/6,b[1]-(after[1]-a[1])/6,b[0],b[1]);
   }
  }else{
   for(let i=1;i<n;i++){const q=xy(points[i]);drawCtx.lineTo(q[0],q[1])}
  }
  if(closed)drawCtx.closePath();
 }
 function paintShape(drawCtx,shape,size){
  drawCtx.save();tracePath(drawCtx,shape.points,size,shape.smooth);
  drawCtx.globalAlpha=shape.opacity;drawCtx.fillStyle=shape.color;drawCtx.fill();
  if(shape.outline>0){drawCtx.lineWidth=shape.outline;drawCtx.strokeStyle=shape.color;drawCtx.lineJoin='round';drawCtx.stroke()}
  drawCtx.restore();
 }
 function composite(p){
  const v=p?.vector;if(!v)return;
  const size=p.canvas.width;
  p.ctx.save();p.ctx.setTransform(1,0,0,1,0,0);p.ctx.globalAlpha=1;p.ctx.globalCompositeOperation='source-over';
  p.ctx.clearRect(0,0,size,size);p.ctx.drawImage(v.underlay,0,0);
  for(const sh of v.shapes)paintShape(p.ctx,sh,size);
  p.ctx.drawImage(v.shade,0,0);
  p.ctx.restore();p.tex.needsUpdate=true;p.painted=true;
  preview();drawEditor();
 }
 function remember(v){
  v.undo.push({shapes:clone(v.shapes),selected:v.selected});
  if(v.undo.length>24)v.undo.shift();
 }
 function drawEditor(){
  const p=targetSession(),v=p?.vector;
  if(!p){ctx.clearRect(0,0,editor.width,editor.height);return}
  if(editor.width!==p.canvas.width||editor.height!==p.canvas.height){editor.width=editor.height=p.canvas.width}
  ctx.clearRect(0,0,editor.width,editor.height);ctx.drawImage(p.canvas,0,0);
  if(!v)return;
  const scale=editor.width;
  if(v.draft.length){
   ctx.save();ctx.strokeStyle='#fff89b';ctx.lineWidth=Math.max(2,scale/350);
   ctx.setLineDash([9,6]);tracePath(ctx,v.draft,scale,false,false);ctx.stroke();ctx.setLineDash([]);
   for(const q of v.draft)drawHandle(q,'#fff89b',scale);
   ctx.restore();
  }
  if(v.selected>=0&&v.selected<v.shapes.length){
   const sh=v.shapes[v.selected];
   ctx.save();ctx.lineWidth=Math.max(1.5,scale/450);ctx.strokeStyle='#47ecff';ctx.setLineDash([5,4]);
   tracePath(ctx,sh.points,scale,sh.smooth);ctx.stroke();ctx.restore();
   for(const q of sh.points)drawHandle(q,'#47ecff',scale);
  }
 }
 function drawHandle(q,color,size){
  ctx.beginPath();ctx.arc(q[0]*size,(1-q[1])*size,Math.max(5,size/160),0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();ctx.lineWidth=Math.max(1.2,size/800);ctx.strokeStyle='#182330';ctx.stroke();
 }
 function setInfo(message){
  $('vectorStatus').textContent=message;
 }
 function listShapes(){
  const p=targetSession(),v=p?.vector,sel=$('vectorShapeSelect');
  sel.replaceChildren();
  const opt=document.createElement('option');opt.value='-1';opt.textContent='New outline / unselected';sel.append(opt);
  if(v)for(let i=0;i<v.shapes.length;i++){
   const o=document.createElement('option');o.value=String(i);
   o.textContent='Form '+(i+1)+' · '+v.shapes[i].color+(v.shapes[i].opacity<1?' · shade':'');sel.append(o);
  }
  sel.value=String(v?.selected??-1);
 }
 function sync(){
  const p=targetSession(),exists=!!p;
  for(const id of ['vectorNew','vectorClose','vectorUndoPoint','vectorUndo','vectorDelete','vectorRaise','vectorLower','vectorShapeSelect','vectorTrace'])
   $(id).disabled=!getTarget();
  $('vectorClose').disabled=!p?.vector||p.vector.draft.length<3;
  $('vectorUndoPoint').disabled=!p?.vector||!p.vector.draft.length;
  $('vectorUndo').disabled=!p?.vector||!p.vector.undo.length;
  $('vectorDelete').disabled=!p?.vector||p.vector.selected<0;
  $('vectorTrace').setAttribute('aria-pressed',String(getMode()==='vectorTrace'));
  $('vectorTrace').textContent=getMode()==='vectorTrace'?'Stop model tracing':'Trace points on 3D model';
  listShapes();drawEditor();
 }
 function begin(){
  const p=targetSession(true);if(!p){setInfo('Select a UV-ready paint surface first.');return}
  finishPaint();const v=ensure(p);
  v.draft=[];v.selected=-1;setInfo('New contour: click the large UV canvas, or use Trace points on 3D model. Three or more points are required.');
  sync();
 }
 function addPoint(q){
  const p=targetSession(true);if(!p)return;
  const v=ensure(p);
  if(v.draft.length>=MAX_POINTS){setInfo('This form reached the 512-point limit. Close it before continuing.');return}
  const xy=q.map(x=>clamp(x,0,1));
  if(v.draft.length){
   const last=v.draft[v.draft.length-1];
   if(Math.hypot(last[0]-xy[0],last[1]-xy[1])>0.6)
    setInfo('Large UV jump detected: the outline may cross an island seam. Work on one UV island at a time.');
  }
  v.selected=-1;v.draft.push(xy);
  drawEditor();$('vectorClose').disabled=v.draft.length<3;
 }
 function shapeSettings(){
  return {color:$('vectorColor').value,opacity:Number($('vectorOpacity').value)/100,
    smooth:$('vectorCurve').value==='smooth',outline:Number($('vectorOutline').value)};
 }
 function close(){
  const p=targetSession(),v=p?.vector;
  if(!v||v.draft.length<3)return setInfo('Add at least three outline points first.');
  if(v.shapes.length>=MAX_SHAPES)return setInfo('128 forms per mesh maximum; export this stage before adding more.');
  remember(v);v.shapes.push({...shapeSettings(),points:v.draft.map(q=>q.slice())});
  v.draft=[];v.selected=v.shapes.length-1;composite(p);save();
  setInfo('Closed, filled form '+v.shapes.length+'. Select it below to drag its control points or adjust the fill. Add another form for hard-edged shading.');
  sync();
 }
 function removeSelected(){
  const p=targetSession(),v=p?.vector;
  if(!v||v.selected<0)return;
  remember(v);v.shapes.splice(v.selected,1);v.selected=-1;composite(p);save();sync();
 }
 function undo(){
  const p=targetSession(),v=p?.vector;if(!v?.undo.length)return;
  const item=v.undo.pop();v.shapes=item.shapes;v.selected=item.selected;v.draft=[];
  composite(p);save();sync();setInfo('Previous vector shape edit restored.');
 }
 function reorder(delta){
  const p=targetSession(),v=p?.vector;const i=v?.selected??-1,j=i+delta;
  if(i<0||j<0||j>=v.shapes.length)return;
  remember(v);[v.shapes[i],v.shapes[j]]=[v.shapes[j],v.shapes[i]];v.selected=j;
  composite(p);save();sync();
 }
 function updateSelected(){
  const p=targetSession(),v=p?.vector;if(!v||v.selected<0)return;
  const sh=v.shapes[v.selected],newValues=shapeSettings();
  if(sh.color===newValues.color&&sh.opacity===newValues.opacity&&sh.smooth===newValues.smooth&&sh.outline===newValues.outline)return;
  remember(v);Object.assign(sh,newValues);composite(p);save();sync();
 }
 function editorUv(event){
  const r=editor.getBoundingClientRect();
  return [clamp((event.clientX-r.left)/r.width,0,1),clamp(1-(event.clientY-r.top)/r.height,0,1)];
 }
 function nearbyAnchor(v,uv){
  if(v.selected<0)return -1;
  const sh=v.shapes[v.selected];if(!sh)return -1;
  const size=editor.getBoundingClientRect().width||300,threshold=18/size;
  let best=-1,bestDist=threshold;
  for(let i=0;i<sh.points.length;i++){
   const q=sh.points[i],d=Math.hypot(q[0]-uv[0],q[1]-uv[1]);
   if(d<bestDist){best=i;bestDist=d}
  }
  return best;
 }
 editor.addEventListener('pointerdown',e=>{
  const p=targetSession(true);if(!p)return;
  const v=ensure(p),uv=editorUv(e),handle=nearbyAnchor(v,uv);
  if(handle>=0){
   remember(v);drag={p,v,idx:handle,moved:false};
   editor.setPointerCapture(e.pointerId);
  }else{
   addPoint(uv);
  }
  editorDown=true;e.preventDefault();
 });
 editor.addEventListener('pointermove',e=>{
  if(!drag)return;
  drag.v.shapes[drag.v.selected].points[drag.idx]=editorUv(e);
  drag.moved=true;
  composite(drag.p);e.preventDefault();
 });
 const endDrag=e=>{
  if(!drag)return;
  if(drag.moved){save();setInfo('Control point repositioned. Texture updated on the model.');}
  else drag.v.undo.pop(); // No actual movement: avoid an empty undo step.
  drag=null;sync();
 };
 editor.addEventListener('pointerup',endDrag);
 editor.addEventListener('pointercancel',endDrag);
 overlay.addEventListener('pointerdown',e=>{
  if(getMode()!=='vectorTrace')return;
  const hit=hitForPaint(e);
  if(hit?.uv)addPoint([hit.uv.x,hit.uv.y]);
  else setInfo('Tap the selected UV-mapped surface, not the background or another mesh.');
  e.preventDefault();e.stopImmediatePropagation();
 },true);
 $('vectorTrace').onclick=()=>{
  if(getMode()==='vectorTrace'){
   selectMode(false);
  }else{
   const p=targetSession(true);
   if(!p)return setInfo('Select a UV-ready mesh first.');
   ensure(p);finishPaint();selectMode(false);setMode('vectorTrace');
   controls.enabled=false;overlay.style.pointerEvents='auto';overlay.style.cursor='crosshair';
   setInfo('Click/tap individual contour points on the 3D model. Use Close outline to fill; switch to Navigate to orbit.');
  }
  sync();
 };
 $('vectorNew').onclick=begin;
 $('vectorClose').onclick=close;
 $('vectorUndoPoint').onclick=()=>{
  const v=targetSession()?.vector;if(!v?.draft.length)return;
  v.draft.pop();drawEditor();sync();
 };
 $('vectorUndo').onclick=undo;
 $('vectorDelete').onclick=removeSelected;
 $('vectorRaise').onclick=()=>reorder(1);
 $('vectorLower').onclick=()=>reorder(-1);
 $('vectorShapeSelect').onchange=()=>{
  const v=targetSession()?.vector;if(!v)return;
  v.selected=Number($('vectorShapeSelect').value);
  if(v.selected>=0){const sh=v.shapes[v.selected];
   $('vectorColor').value=sh.color;$('vectorOpacity').value=String(Math.round(sh.opacity*100));
   $('vectorOpacityValue').textContent=$('vectorOpacity').value+'%';
   $('vectorCurve').value=sh.smooth?'smooth':'corners';
   $('vectorOutline').value=String(sh.outline);
  }
  drawEditor();
 };
 for(const id of ['vectorColor','vectorOpacity','vectorCurve','vectorOutline'])$(id).addEventListener('change',updateSelected);
 $('vectorOpacity').oninput=()=>$('vectorOpacityValue').textContent=$('vectorOpacity').value+'%';
 $('vectorUseBrushColor').onclick=()=>{$('vectorColor').value=$('paintColor').value;updateSelected()};
 $('vectorZoom').oninput=()=>{
  const pct=Number($('vectorZoom').value);
  editor.style.width=pct+'%';$('vectorZoomValue').textContent=pct+'%';
 };
 function brushDot(p,x,y,size,color,opacity){
  if(!p.vector)return;
  const shade=p.vector.shadeCtx;shade.save();shade.globalCompositeOperation='source-over';
  shade.fillStyle=color;shade.globalAlpha=opacity;shade.beginPath();shade.arc(x,y,size/2,0,Math.PI*2);shade.fill();shade.restore();
 }
 function strokeStart(p){
  if(p?.vector)p.vector.pendingShadeUndo=p.vector.shadeCtx.getImageData(0,0,p.canvas.width,p.canvas.height);
 }
 function strokeEnd(p,hasStroke){
  if(!p?.vector)return;
  if(hasStroke&&p.vector.pendingShadeUndo){
   p.vector.shadeUndo.push(p.vector.pendingShadeUndo);
   if(p.vector.shadeUndo.length>8)p.vector.shadeUndo.shift();
  }
  p.vector.pendingShadeUndo=null;
 }
 function brushUndo(p){
  if(!p?.vector)return false;
  if(!p.vector.shadeUndo.length){setInfo('Earlier raster strokes are part of the vector underlay. Only strokes made after starting Vector Forms can be undone here.');return true}
  p.vector.shadeCtx.putImageData(p.vector.shadeUndo.pop(),0,0);
  if(p.undo?.length)p.undo.pop();
  if(p.strokes?.length)p.strokes.pop();
  composite(p);save();return true;
 }
 function reset(p){
  if(!p)return;
  p.vector=null;drag=null;setInfo('Vector forms cleared with the paint reset.');sync();
 }
 function asJSON(p){
  if(!p?.vector)return null;
  return {schema:'colab-vector-v1',shapes:clone(p.vector.shapes),
   underlayPng:p.vector.underlay.toDataURL('image/png'),
   shadePng:p.vector.shade.toDataURL('image/png')};
 }
 function verifyData(obj,kind='url'){
  if(!obj||obj.schema!=='colab-vector-v1')throw Error('Unsupported vector layer format.');
  const shapes=validateShapes(obj.shapes);
  if(kind==='url'){
   for(const key of ['underlayPng','shadePng'])
    if(typeof obj[key]!=='string'||obj[key].length>33000000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(obj[key]))
     throw Error('Invalid '+key+' vector texture.');
  }else{
   if(!(obj.underlay instanceof Blob)||!(obj.shade instanceof Blob)||obj.underlay.size>32*1024*1024||obj.shade.size>32*1024*1024)
    throw Error('Saved vector layers are incomplete or too large.');
  }
  return shapes;
 }
 async function readImage(src){
  if(src instanceof Blob){const bitmap=await createImageBitmap(src);return bitmap;}
  return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(Error('Cannot decode vector layer PNG.'));im.src=src;});
 }
 async function restore(p,obj,kind='url'){
  const shapes=verifyData(obj,kind),size=p.canvas.width;
  const a=await readImage(kind==='url'?obj.underlayPng:obj.underlay);
  const b=await readImage(kind==='url'?obj.shadePng:obj.shade);
  try{
   if(a.width!==size||a.height!==size||b.width!==size||b.height!==size)throw Error('Vector layer dimensions do not match selected paint resolution.');
   p.vector=null;const v=ensure(p);v.underlay.getContext('2d').clearRect(0,0,size,size);
   v.underlay.getContext('2d').drawImage(a,0,0);v.shadeCtx.clearRect(0,0,size,size);
   v.shadeCtx.drawImage(b,0,0);v.shapes=shapes;v.selected=-1;v.undo=[];v.shadeUndo=[];
   composite(p);sync();
  }finally{if(typeof a.close==='function')a.close();if(typeof b.close==='function')b.close();}
 }
 async function forRecovery(p){
  if(!p?.vector)return null;
  return {schema:'colab-vector-v1',shapes:clone(p.vector.shapes),
   underlay:await canvasBlob(p.vector.underlay),shade:await canvasBlob(p.vector.shade)};
 }
 // Initial UI is safe before a model is loaded.
 sync();
 return {sync,reset,asJSON,restore,forRecovery,brushDot,strokeStart,strokeEnd,brushUndo};
}
