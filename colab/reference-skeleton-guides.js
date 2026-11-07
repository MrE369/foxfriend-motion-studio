/**
 * CoLab Reference Skeleton Guides v0.2.
 * Visible reference bones for an existing GLB rig, without changing its skin,
 * geometry, animation clips, keyframe data, or exported model.
 * Uses the imported skeleton (not a newly invented replacement).
 */
export function createReferenceSkeletonGuides(THREE,scene){
 const layer=new THREE.Group();
 layer.name='CoLab_NonExported_ReferenceSkeleton';
 layer.renderOrder=1000;scene.add(layer);
 const linesMaterial=new THREE.LineBasicMaterial({color:0xaee7f9,depthTest:false,depthWrite:false,transparent:true,opacity:.95,vertexColors:true});
 const dotsMaterial=new THREE.PointsMaterial({size:6,sizeAttenuation:false,depthTest:false,depthWrite:false,transparent:true,opacity:.9,vertexColors:true});
 let rig=null,bones=[],links=[],lineGeometry=null,pointGeometry=null,visibleState=[],enabled=false,hidden=false;
 const v=()=>new THREE.Vector3();
 const tint=name=>/^Left/i.test(name)?new THREE.Color('#68dbe7'):/^Right/i.test(name)?new THREE.Color('#f9b16c'):new THREE.Color('#f4e9bd');
 function restoreMeshes(){
  for(const [mesh,wasVisible] of visibleState)mesh.visible=wasVisible;
  visibleState=[];hidden=false;
 }
 function hideMeshes(){
  if(!hidden){
   visibleState=[];
   rig.traverse(node=>{if(node.isMesh)visibleState.push([node,node.visible]);});
   hidden=true;
  }
  for(const [mesh] of visibleState)mesh.visible=false;
 }
 function clear(){
  restoreMeshes();
  for(const obj of [...layer.children]){layer.remove(obj);obj.geometry?.dispose();}
  rig=null;bones=[];links=[];lineGeometry=pointGeometry=null;enabled=false;layer.visible=false;
 }
 function setSkeleton(model,joints){
  clear();
  if(!model||!Array.isArray(joints)||!joints.length)return;
  rig=model;bones=joints.slice();
  bones.forEach((bone,i)=>{
   const parent=bone.parent;
   if(parent?.isBone){const a=bones.indexOf(parent);if(a>=0)links.push([a,i]);}
  });
  lineGeometry=new THREE.BufferGeometry();
  lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(links.length*6),3));
  const lineColors=new Float32Array(links.length*6);
  links.forEach(([a,b],i)=>{
   const color=tint(bones[b].name||'');
   for(let k=0;k<2;k++)color.toArray(lineColors,i*6+k*3);
  });
  lineGeometry.setAttribute('color',new THREE.BufferAttribute(lineColors,3));
  const lines=new THREE.LineSegments(lineGeometry,linesMaterial);
  lines.name='ReferenceBones';lines.frustumCulled=false;lines.renderOrder=1000;layer.add(lines);
  pointGeometry=new THREE.BufferGeometry();
  pointGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bones.length*3),3));
  const dotColors=new Float32Array(bones.length*3);
  bones.forEach((bone,i)=>tint(bone.name||'').toArray(dotColors,i*3));
  pointGeometry.setAttribute('color',new THREE.BufferAttribute(dotColors,3));
  const points=new THREE.Points(pointGeometry,dotsMaterial);
  points.name='ReferenceJoints';points.frustumCulled=false;points.renderOrder=1001;layer.add(points);
  layer.visible=false;
 }
 function setEnabled(value){
  enabled=!!value&&!!rig;
  if(!enabled){restoreMeshes();layer.visible=false;}
 }
 function update(active=true){
  if(!rig||!enabled||!active||!rig.visible){restoreMeshes();layer.visible=false;return;}
  hideMeshes();layer.visible=true;
  rig.updateWorldMatrix(true,true);
  const positions=bones.map(bone=>bone.getWorldPosition(v()));
  const linePos=lineGeometry.attributes.position,pointPos=pointGeometry.attributes.position;
  links.forEach(([a,b],i)=>{linePos.setXYZ(i*2,positions[a].x,positions[a].y,positions[a].z);linePos.setXYZ(i*2+1,positions[b].x,positions[b].y,positions[b].z);});
  positions.forEach((pos,i)=>pointPos.setXYZ(i,pos.x,pos.y,pos.z));
  linePos.needsUpdate=true;pointPos.needsUpdate=true;
 }
 function bounds(){
  if(!rig||!bones.length)return null;
  rig.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromPoints(bones.map(b=>b.getWorldPosition(v())));
  if(box.isEmpty())return null;
  box.expandByScalar(Math.max(.02,box.getSize(v()).length()*.045));
  return box;
 }
 return {setSkeleton,setEnabled,update,clear,bounds,get enabled(){return enabled;},get boneCount(){return bones.length;}};
}
