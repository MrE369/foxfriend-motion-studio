/**
 * Blue Toro body-pose pilot — isolated from production Unified Studio.
 *
 * Works with the shared rig adapter's live bones. Transforms are captured
 * when body posing starts; applying a value is absolute against that snapshot.
 * Feet are held near their original world positions with independently solved
 * leg IK chains. Joint limits and anatomical validity are NOT guaranteed.
 */
export function supportsToroBody(rig) {
  if(rig?.kind!=='tripo-native')return false;
  const must=['tripoSpine_0','tripoSpine_1','tripoSpine_2','tripoHead_0'];
  if(!must.every(name=>rig.getBone(name)?.isBone))return false;
  const ids=['tripo-0_left','tripo-0_right','tripo-1_left','tripo-1_right'];
  return ids.every(id=>rig.getChain(id)?.bones.length===3);
}
export function createToroBody(THREE,rig,model,solveLimb){
  if(!supportsToroBody(rig))throw new Error('Blue Toro body pilot requires the verified four-leg native rig.');
  const pelvis=rig.getBone('tripoSpine_0');
  const back=rig.getBone('tripoSpine_1');
  const shoulders=rig.getBone('tripoSpine_2');
  const torso=[pelvis,back,shoulders];
  const ids=['tripo-0_left','tripo-0_right','tripo-1_left','tripo-1_right'];
  const legs=ids.map(id=>{
    const bones=rig.getChain(id).bones;
    const [upper,middle,end]=bones;
    upper.updateWorldMatrix(true,true);
    const p0=upper.getWorldPosition(new THREE.Vector3()),p1=middle.getWorldPosition(new THREE.Vector3()),p2=end.getWorldPosition(new THREE.Vector3());
    const direction=p2.clone().sub(p0).normalize();
    const bend=p1.clone().sub(p0).addScaledVector(direction,-p1.clone().sub(p0).dot(direction));
    if(bend.lengthSq()<1e-8){
      bend.set(0,0,1).addScaledVector(direction,-direction.z);
      if(bend.lengthSq()<1e-8)bend.set(1,0,0).addScaledVector(direction,-direction.x);
    }
    const pole=p1.clone().addScaledVector(bend.normalize(),Math.max(.08,p0.distanceTo(p2)*.5));
    return {id,bones,foot:p2.clone(),pole};
  });
  const tracked=new Map();
  const capture=b=>{if(b&&!tracked.has(b))tracked.set(b,{position:b.position.clone(),quaternion:b.quaternion.clone()});};
  torso.forEach(capture);
  legs.forEach(leg=>leg.bones.slice(0,2).forEach(capture));
  let bow=0,sway=0,footDrift=0;
  function turn(bone,deltaWorld){
    const parentRot=new THREE.Quaternion();
    if(bone.parent)bone.parent.getWorldQuaternion(parentRot);
    bone.quaternion.premultiply(parentRot.clone().invert().multiply(deltaWorld).multiply(parentRot)).normalize();
    bone.updateWorldMatrix(true,true);
  }
  function resetTracked(){
    for(const [bone,t] of tracked){bone.position.copy(t.position);bone.quaternion.copy(t.quaternion);}
    model.updateMatrixWorld(true);
  }
  function apply(nextBow=bow,nextSway=sway){
    bow=THREE.MathUtils.clamp(Number(nextBow)||0,0,1);
    sway=THREE.MathUtils.clamp(Number(nextSway)||0,-1,1);
    resetTracked();
    // Hip sway is deliberately small: slight lateral shift + gentle roll.
    const pWorld=pelvis.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
    pelvis.position.add(new THREE.Vector3(sway*.018,0,0).applyQuaternion(pWorld.invert()));
    model.updateMatrixWorld(true);
    turn(pelvis,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),sway*.065));
    // Front shoulders descend as upper spine pitches, with a small counter-arch.
    turn(back,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),bow*.32));
    turn(shoulders,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-bow*.035));
    for(let pass=0;pass<3;pass++){
      for(const leg of legs)solveLimb(...leg.bones,leg.foot,leg.pole);
    }
    model.updateMatrixWorld(true);
    footDrift=Math.max(...legs.map(l=>l.bones[2].getWorldPosition(new THREE.Vector3()).distanceTo(l.foot)));
    return {bow,sway,footDrift,feet:legs.length};
  }
  return {apply,get bow(){return bow;},get sway(){return sway;},get footDrift(){return footDrift;},
    reset(){resetTracked();bow=0;sway=0;footDrift=0;},
    anchors:legs.map(l=>({name:l.id,world:l.foot.clone()})),
    chest:shoulders,hips:pelvis,
    get status(){return {bow,sway,footDrift,feet:legs.length};}
  };
}
