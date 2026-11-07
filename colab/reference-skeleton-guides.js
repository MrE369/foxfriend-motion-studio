/**
 * CoLab Reference Skeleton Guides v0.1.
 * Render-only joint markers + colored bone connections for bone-only GLBs.
 * Geometry belongs to the overlay scene, NEVER to the exported model.
 * This is NOT an invented skeleton or a retargeter.
 */
export function createReferenceSkeletonGuides(THREE,scene){
 const overlay=new THREE.Group();
 overlay.name='CoLab_NonExported_Skeleton_Guides';
 overlay.visible=false;
 scene.add(overlay);
 let rig=null,bones=[],links=[],lineGeometry=null,pointGeometry=null;
 const lineMaterial=new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.95});
 const pointMaterial=new THREE.PointsMaterial({vertexColors:true,size:7,sizeAttenuation:false,depthTest:false,depthWrite:false,transparent:true,opacity:.95});
 const vec=()=>new THREE.Vector3();
 function tint(name){
  if(/(^|[_ .-])(?:left|l)(?=[_ .-]|[A-Z]|$)/i.test(name)||/^Left/i.test(name))return new THREE.Color('#68dbe7');
  if(/(^|[_ .-])(?:right|r)(?=[_ .-]|[A-Z]|$)/i.test(name)||/^Right/i.test(name))return new THREE.Color('#f9a56c');
  return new THREE.Color('#dbe9fb');
 }
 function clear(){
  rig=null;bones=[];links=[];overlay.visible=false;
  for(const node of [...overlay.children]){overlay.remove(node);node.geometry?.dispose();}
  lineGeometry=null;pointGeometry=null;
 }
 function setSkeleton(model,list,meshless){
  clear();
  if(!model||!meshless||!Array.isArray(list)||!list.length)return;
  rig=model;bones=list.slice();
  for(let i=0;i<bones.length;i++){
   const bone=bones[i],p=bone.parent;
   if(p?.isBone){const parentIndex=bones.indexOf(p);if(parentIndex>=0)links.push([parentIndex,i]);}
  }
  lineGeometry=new THREE.BufferGeometry();
  lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(links.length*6),3));
  const colorLines=new Float32Array(links.length*6);
  links.forEach(([parent,child],i)=>{
   const color=tint(bones[child].name||'');
   for(let j=0;j<2;j++)color.toArray(colorLines,i*6+j*3);
  });
  lineGeometry.setAttribute('color',new THREE.BufferAttribute(colorLines,3));
  const lines=new THREE.LineSegments(lineGeometry,lineMaterial);
  lines.frustumCulled=false;lines.renderOrder=1001;overlay.add(lines);
  pointGeometry=new THREE.BufferGeometry();
  pointGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bones.length*3),3));
  const pointColors=new Float32Array(bones.length*3);
  bones.forEach((b,i)=>tint(b.name||'').toArray(pointColors,i*3));
  pointGeometry.setAttribute('color',new THREE.BufferAttribute(pointColors,3));
  const points=new THREE.Points(pointGeometry,pointMaterial);
  points.frustumCulled=false;points.renderOrder=1002;overlay.add(points);
  update();
 }
 function update(){
  if(!rig){overlay.visible=false;return;}
  overlay.visible=rig.visible;
  if(!overlay.visible)return;
  rig.updateWorldMatrix(true,true);
  const positions=bones.map(b=>b.getWorldPosition(vec()));
  const la=lineGeometry.attributes.position,pa=pointGeometry.attributes.position;
  links.forEach(([a,b],i)=>{la.setXYZ(i*2,positions[a].x,positions[a].y,positions[a].z);la.setXYZ(i*2+1,positions[b].x,positions[b].y,positions[b].z)});
  positions.forEach((p,i)=>pa.setXYZ(i,p.x,p.y,p.z));
  la.needsUpdate=true;pa.needsUpdate=true;
 }
 function bounds(){
  if(!rig||!bones.length)return null;
  rig.updateWorldMatrix(true,true);
  const result=new THREE.Box3().setFromPoints(bones.map(b=>b.getWorldPosition(vec())));
  // Zero-length / coincident rig roots still deserve a usable camera frame.
  if(result.isEmpty())return null;
  result.expandByScalar(Math.max(.025,result.getSize(vec()).length()*.05));
  return result;
 }
 return {setSkeleton,update,clear,bounds,get active(){return !!rig;},get boneCount(){return bones.length;}};
}
