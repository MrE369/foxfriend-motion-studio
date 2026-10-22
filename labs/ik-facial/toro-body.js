/**
 * Blue Toro body-pose pilot 0.2
 * Uses Blue Toro's full proximal leg anatomy, including actual shoulder/hip
 * joints, instead of solving only his short ankle-to-toe segments.
 * Each toe position and orientation is held to the start-of-pose world pose.
 * Experimental: no guaranteed anatomical limits or physical simulation.
 */
const LEG_NAMES=[
 ['bone_6','tripo0_Left_Limb_0','tripo0_Left_Limb_1','tripo0_Left_Limb_2'],
 ['bone_11','tripo0_Right_Limb_0','tripo0_Right_Limb_1','tripo0_Right_Limb_2'],
 ['bone_16','tripo1_Left_Limb_0','tripo1_Left_Limb_1','tripo1_Left_Limb_2'],
 ['tripo1_Right_Limb_0','tripo1_Right_Limb_1','tripo1_Right_Limb_2','tripo1_Right_Limb_3']
];
export function supportsToroBody(rig){
 if(rig?.kind!=='tripo-native')return false;
 if(!['tripoSpine_0','tripoSpine_1','tripoSpine_2','tripoHead_0'].every(n=>rig.getBone(n)?.isBone))return false;
 return LEG_NAMES.every(names=>{
  const bones=names.map(n=>rig.getBone(n));
  return bones.every(b=>b?.isBone)&&bones.slice(1).every((b,i)=>b.parent===bones[i]);
 });
}
export function createToroBody(THREE,rig,model,solveLimb){
 if(!supportsToroBody(rig))throw new Error('Blue Toro requires verified connected shoulder-to-hoof chains.');
 const pelvis=rig.getBone('tripoSpine_0'),back=rig.getBone('tripoSpine_1'),shoulders=rig.getBone('tripoSpine_2');
 model.updateMatrixWorld(true);
 const getPos=bone=>bone.getWorldPosition(new THREE.Vector3());
 const stored=new Map();
 const store=bone=>{
  if(!stored.has(bone))stored.set(bone,{position:bone.position.clone(),rotation:bone.quaternion.clone()});
 };
 [pelvis,back,shoulders].forEach(store);
 const legs=LEG_NAMES.map((names,index)=>{
  const [shoulder,knee,ankle,toe]=names.map(n=>rig.getBone(n));
  [shoulder,knee,ankle,toe].forEach(store);
  const p0=getPos(shoulder),p1=getPos(knee),p2=getPos(ankle);
  const forward=p2.clone().sub(p0).normalize();
  const bend=p1.clone().sub(p0).addScaledVector(forward,-p1.clone().sub(p0).dot(forward));
  if(bend.lengthSq()<1e-10){
   bend.set(0,0,1).addScaledVector(forward,-forward.z);
   if(bend.lengthSq()<1e-10)bend.set(1,0,0).addScaledVector(forward,-forward.x);
  }
  return {
   index,shoulder,knee,ankle,toe,bones:[shoulder,knee,ankle],
   anchoredToe:getPos(toe).clone(),
   originalAnkle:p2.clone(),
   toeWorldRotation:toe.getWorldQuaternion(new THREE.Quaternion()),
   pole:p1.clone().addScaledVector(bend.normalize(),Math.max(.05,p0.distanceTo(p2)*.35))
  };
 });
 let bow=0,sway=0,footDrift=0;
 const resetTracked=()=>{
  for(const [bone,r] of stored){bone.position.copy(r.position);bone.quaternion.copy(r.rotation);}
  model.updateMatrixWorld(true);
 };
 const turn=(bone,delta)=>{
  const parentWorld=bone.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
  bone.quaternion.premultiply(parentWorld.clone().invert().multiply(delta).multiply(parentWorld)).normalize();
  bone.updateWorldMatrix(true,true);
 };
 const axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1);
 function plantToe(leg){
  const {shoulder,knee,ankle,toe}=leg;
  // The terminal toe is one segment beyond the true knee/ankle chain.
  // Correct the ankle target against the measured toe-point error.
  const ankleGoal=leg.originalAnkle.clone();
  for(let i=0;i<8;i++){
   solveLimb(shoulder,knee,ankle,ankleGoal,leg.pole);
   model.updateMatrixWorld(true);
   const missing=leg.anchoredToe.clone().sub(getPos(toe));
   if(missing.lengthSq()<1e-10)break;
   ankleGoal.addScaledVector(missing,.9);
  }
  // Preserve hoof orientation even as the upper leg and ankle rotate.
  const parentWorld=toe.parent.getWorldQuaternion(new THREE.Quaternion());
  toe.quaternion.copy(parentWorld.invert().multiply(leg.toeWorldRotation)).normalize();
  toe.updateWorldMatrix(true,true);
  return getPos(toe).distanceTo(leg.anchoredToe);
 }
 function apply(nextBow=bow,nextSway=sway){
  bow=THREE.MathUtils.clamp(Number(nextBow)||0,0,1);
  sway=THREE.MathUtils.clamp(Number(nextSway)||0,-1,1);
  resetTracked();
  if(bow>1e-5||Math.abs(sway)>1e-5){
   // Whole torso pitches, rather than making the last few leg bones fold.
   // World +X lowers the front of this specific Tripo-native bull rig.
   turn(pelvis,new THREE.Quaternion().setFromAxisAngle(axisX,.17*bow));
   if(Math.abs(sway)>1e-5){
    const parentWorld=pelvis.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
    pelvis.position.add(new THREE.Vector3(sway*.018,0,0).applyQuaternion(parentWorld.invert()));
    pelvis.updateWorldMatrix(true,true);
    turn(pelvis,new THREE.Quaternion().setFromAxisAngle(axisZ,.065*sway));
   }
   turn(back,new THREE.Quaternion().setFromAxisAngle(axisX,.54*bow));
   turn(shoulders,new THREE.Quaternion().setFromAxisAngle(axisX,-.10*bow));
   footDrift=Math.max(...legs.map(plantToe));
  }else{
   footDrift=0;
  }
  model.updateMatrixWorld(true);
  return {bow,sway,footDrift,feet:legs.length};
 }
 return {
  apply,
  get bow(){return bow;},get sway(){return sway;},get footDrift(){return footDrift;},
  reset(){resetTracked();bow=0;sway=0;footDrift=0;},
  anchors:legs.map(l=>({name:l.toe.name,world:l.anchoredToe.clone()})),
  chest:shoulders,hips:pelvis,
  get status(){return {bow,sway,footDrift,feet:legs.length};}
 };
}
