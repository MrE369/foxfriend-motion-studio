// CoLab Vector Forms -- draw-only UV outline preview projected onto the original 3D mesh.
// No changes to geometry, rigging, paint texture, exported GLB, or saved vector shapes.
export function createVectorOutlinePreview({THREE,scene,getTarget,getSession,getWorkspace,getPanelOpen}){
 const size=768,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.flipY=true;
 texture.minFilter=THREE.LinearFilter;
 texture.magFilter=THREE.LinearFilter;
 let mesh=null,guide=null;
 const xy=p=>[p[0]*size,(1-p[1])*size];
 function path(points,closed=false){
  if(!points.length)return;
  ctx.beginPath();
  const a=xy(points[0]);ctx.moveTo(a[0],a[1]);
  for(let i=1;i<points.length;i++){const q=xy(points[i]);ctx.lineTo(q[0],q[1]);}
  if(closed)ctx.closePath();
 }
 function line(points,color,width,closed=false,dashed=false){
  if(points.length<2)return;
  ctx.save();ctx.lineWidth=width;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineCap='round';
  if(dashed)ctx.setLineDash([10,8]);path(points,closed);ctx.stroke();ctx.restore();
 }
 function point(p,color,number){
  const [x,y]=xy(p);
  ctx.beginPath();ctx.arc(x,y,number===1?8:6,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#17222f';ctx.stroke();
 }
 function createGuide(target){
  const material=new THREE.MeshBasicMaterial({
   color:0xffffff,map:texture,transparent:true,opacity:1,alphaTest:0.015,
   depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4
  });
  let g;
  if(target.isSkinnedMesh){
   g=new THREE.SkinnedMesh(target.geometry,material);
   g.bindMode=target.bindMode;
   g.bind(target.skeleton,target.bindMatrix.clone());
   g.bindMatrixInverse.copy(target.bindMatrixInverse);
  }else g=new THREE.Mesh(target.geometry,material);
  if(target.morphTargetInfluences){
   g.morphTargetInfluences=target.morphTargetInfluences;
   g.morphTargetDictionary=target.morphTargetDictionary;
  }
  g.name='Vector outline live guide - preview only';
  g.userData.coLabDisplayOnly=true;
  g.matrixAutoUpdate=false;g.frustumCulled=false;
  g.renderOrder=target.renderOrder+3;
  g.raycast=()=>{};
  scene.add(g);
  return g;
 }
 function releaseGuide(){
  if(guide){scene.remove(guide);guide.material.dispose();guide=null;}
  mesh=null;
 }
 function refresh(){
  const target=getWorkspace()==='paint'&&getPanelOpen()?getTarget():null;
  const v=target?getSession(target)?.vector:null;
  const draft=v?.draft||[];
  const selected=(Number.isInteger(v?.selected)&&v.selected>=0)?v.shapes?.[v.selected]:null;
  if(!target||!v||(!draft.length&&!selected)){
   if(guide)guide.visible=false;
   return;
  }
  if(mesh!==target){releaseGuide();guide=createGuide(target);mesh=target;}
  guide.visible=true;
  ctx.clearRect(0,0,size,size);
  if(selected?.points?.length){
   const pts=selected.points;
   line(pts,'#111927',8,true);
   line(pts,'#45e6ff',4,true);
   for(let i=0;i<pts.length;i++)point(pts[i],'#45e6ff',i+1);
  }
  if(draft.length){
   line(draft,'#121923',10);
   line(draft,'#ffe76b',5);
   if(draft.length>=3){
    const last=draft[draft.length-1],first=draft[0];
    line([last,first],'rgba(0,0,0,.85)',6,false,true);
    line([last,first],'#73f1cf',3,false,true);
   }
   const hover=v.hover;
   if(hover&&draft.length){
    line([draft[draft.length-1],hover],'#121923',8);
    line([draft[draft.length-1],hover],'#ff9d5f',4,false,true);
   }
   for(let i=0;i<draft.length;i++)point(draft[i],'#ffe76b',i+1);
   if(hover)point(hover,'#ff9d5f',0);
  }
  texture.needsUpdate=true; // One upload per edit / frame, not UV triangle redraw.
 }
 function updateMatrices(){
  if(!guide?.visible||!mesh)return;
  mesh.updateWorldMatrix(true,false);
  guide.matrix.copy(mesh.matrixWorld);
  guide.matrixWorldNeedsUpdate=true;
 }
 function clear(){
  releaseGuide();ctx.clearRect(0,0,size,size);texture.needsUpdate=true;
 }
 return {refresh,updateMatrices,clear};
}