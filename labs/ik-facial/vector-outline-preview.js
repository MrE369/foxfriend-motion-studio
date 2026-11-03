// CoLab Vector Forms: screen-space live contour guide.
// Draw exact 3D hit points on a transparent CSS canvas over the viewport.
// IMPORTANT: never put a "guide texture" on the character's UVs. Mirrored and
// overlapping UV islands repeat that texture and can obscure the character.
// This read-only guide never affects materials, GLB exports, or paint layers.
export function createVectorOutlinePreview({THREE,camera,view,getTarget,getSession,getWorkspace,getPanelOpen}){
 const canvas=document.createElement('canvas');
 canvas.setAttribute('aria-hidden','true');
 canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;';
 view.append(canvas);
 const ctx=canvas.getContext('2d');
 const uvCache=new WeakMap(),GRID=32;
 let dirty=true,lastCam=[],lastTarget=[],lastW=0,lastH=0;
 const isFinite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
 function screenSize(){
  const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight);
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  if(w!==lastW||h!==lastH||canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
   lastW=w;lastH=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
   ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;
  }
  return {w,h};
 }
 function makeUvIndex(g){
  if(uvCache.has(g))return uvCache.get(g);
  const uv=g.attributes.uv,position=g.attributes.position,index=g.index;
  if(!uv||!position)return null;
  const count=Math.floor((index?index.count:uv.count)/3);
  const bins=Array.from({length:GRID*GRID},()=>[]);
  const faceVerts=t=>{
   const i=t*3;
   return index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2];
  };
  // Built once per original geometry, only when a UV-editor anchor needs to
  // be shown on the 3D viewer. Drawing traced hits does not require this index.
  for(let t=0;t<count;t++){
   const ix=faceVerts(t),x=[uv.getX(ix[0]),uv.getX(ix[1]),uv.getX(ix[2])],y=[uv.getY(ix[0]),uv.getY(ix[1]),uv.getY(ix[2])];
   if(x.some(v=>!Number.isFinite(v))||y.some(v=>!Number.isFinite(v)))continue;
   const minX=Math.max(0,Math.floor(Math.min(...x)*GRID)),maxX=Math.min(GRID-1,Math.floor(Math.max(...x)*GRID));
   const minY=Math.max(0,Math.floor(Math.min(...y)*GRID)),maxY=Math.min(GRID-1,Math.floor(Math.max(...y)*GRID));
   for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++)bins[cy*GRID+cx].push(t);
  }
  const item={uv,position,faceVerts,bins,memo:new Map()};
  uvCache.set(g,item);return item;
 }
 function localFromUv(mesh,uvPoint){
  if(!uvPoint||uvPoint.length!==2||uvPoint.some(v=>!Number.isFinite(v)))return null;
  const data=makeUvIndex(mesh.geometry);if(!data)return null;
  const [u,v]=uvPoint,key=u.toFixed(6)+','+v.toFixed(6);
  if(data.memo.has(key))return data.memo.get(key);
  const cx=Math.min(GRID-1,Math.max(0,Math.floor(u*GRID))),cy=Math.min(GRID-1,Math.max(0,Math.floor(v*GRID)));
  let found=null;
  for(const t of data.bins[cy*GRID+cx]){
   const ix=data.faceVerts(t),uv=data.uv;
   const ax=uv.getX(ix[0]),ay=uv.getY(ix[0]),bx=uv.getX(ix[1]),by=uv.getY(ix[1]),cx=uv.getX(ix[2]),cy=uv.getY(ix[2]);
   const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
   if(Math.abs(d)<1e-12)continue;
   const a=((by-cy)*(u-cx)+(cx-bx)*(v-cy))/d,
     b=((cy-ay)*(u-cx)+(ax-cx)*(v-cy))/d,c=1-a-b;
   if(Math.min(a,b,c)<-0.0001||Math.max(a,b,c)>1.0001)continue;
   const pos=data.position;
   found=[a*pos.getX(ix[0])+b*pos.getX(ix[1])+c*pos.getX(ix[2]),
          a*pos.getY(ix[0])+b*pos.getY(ix[1])+c*pos.getY(ix[2]),
          a*pos.getZ(ix[0])+b*pos.getZ(ix[1])+c*pos.getZ(ix[2])];
   break;
  }
  if(data.memo.size>1800)data.memo.clear();
  data.memo.set(key,found);return found;
 }
 function projected(mesh,uv,anchor,w,h){
  const local=isFinite3(anchor)?anchor:localFromUv(mesh,uv);
  if(!local)return null;
  const v=new THREE.Vector3(...local).applyMatrix4(mesh.matrixWorld).project(camera);
  if(!Number.isFinite(v.x)||!Number.isFinite(v.y)||!Number.isFinite(v.z)||v.z< -1||v.z>1)return null;
  return [(v.x+1)*w/2,(1-v.y)*h/2];
 }
 function drawSegment(a,b,width,dark,color,dashed=false){
  if(!a||!b)return;
  // Avoid giant discontinuous lines across UV island or model-space jumps.
  if(Math.hypot(a[0]-b[0],a[1]-b[1])>Math.max(lastW,lastH)*0.7)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(dashed)ctx.setLineDash([8,7]);
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);
  ctx.strokeStyle=dark;ctx.lineWidth=width+3;ctx.stroke();
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.restore();
 }
 function drawPath(mesh,uvPoints,anchors,w,h,color,closed=false,hover=null,hoverAnchor=null){
  if(!uvPoints?.length)return;
  const pts=uvPoints.map((p,i)=>projected(mesh,p,anchors?.[i],w,h));
  for(let i=1;i<pts.length;i++)drawSegment(pts[i-1],pts[i],4,'#121920',color);
  if(closed&&pts.length>2)drawSegment(pts[pts.length-1],pts[0],3,'#18202c',color,true);
  const first=pts[0];
  if(!closed&&pts.length>=3)drawSegment(pts[pts.length-1],first,2,'#0a2535','#67f0cd',true);
  if(hover&&pts.length){
   const hpt=projected(mesh,hover,hoverAnchor,w,h);
   drawSegment(pts[pts.length-1],hpt,3,'#141825','#ffad65',true);
  }
  pts.forEach((p,i)=>{
   if(!p)return;
   ctx.beginPath();ctx.arc(...p,i===0?6:5,0,Math.PI*2);
   ctx.fillStyle=color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#111925';ctx.stroke();
  });
 }
 function redraw(){
  dirty=false;
  const {w,h}=screenSize();
  ctx.clearRect(0,0,w,h);
  const mesh=getWorkspace()==='paint'&&getPanelOpen()?getTarget():null;
  const v=mesh?getSession(mesh)?.vector:null;
  const draft=v?.draft,sel=Number.isInteger(v?.selected)&&v.selected>=0?v.shapes?.[v.selected]:null;
  canvas.style.display=mesh&&(draft?.length||sel)?'block':'none';
  if(!mesh||!v||(!draft?.length&&!sel))return;
  mesh.updateWorldMatrix(true,false);
  camera.updateMatrixWorld();
  if(sel?.points?.length)drawPath(mesh,sel.points,sel.anchors,w,h,'#47e6ff',true);
  if(draft?.length)drawPath(mesh,draft,v.draftAnchors,w,h,'#ffe76b',false,v.hover,v.hoverAnchor);
 }
 function refresh(){dirty=true;redraw();}
 function updateMatrices(){
  if(!getPanelOpen()||getWorkspace()!=='paint'){if(canvas.style.display!=='none')refresh();return}
  const mesh=getTarget();
  if(!mesh){if(canvas.style.display!=='none')refresh();return}
  const transform=mesh.matrixWorld?.elements||[];
  const cam=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements];
  if(cam.some((n,i)=>n!==lastCam[i])||transform.some((n,i)=>n!==lastTarget[i])){
   lastCam=cam.slice();lastTarget=Array.from(transform);dirty=true;
  }
  if(view.clientWidth!==lastW||view.clientHeight!==lastH)dirty=true;
  if(dirty)redraw();
 }
 function clear(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  canvas.style.display='none';dirty=true;lastCam=[];lastTarget=[];
 }
 return {refresh,updateMatrices,clear};
}