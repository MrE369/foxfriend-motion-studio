/**
 * CoLab Skeleton Point Pilot 0.1
 * Point-driven pose operations for ANY detected Three.js Bone, independent of
 * Tripo/VRM naming conventions. Safe scope: local, reversible pose transforms.
 * Root bones translate; other joints use nearest-parent CCD (up to 3 parents).
 * This is NOT anatomically constrained IK and does not preserve planted feet.
 */
export function skeletonAncestors(bone, maxParents=3){
 const result=[];
 let p=bone?.parent;
 while(p?.isBone&&result.length<maxParents){result.push(p);p=p.parent;}
 return result;
}
export function poseSkeletonPoint(THREE,bone,goal,opts={}){
 if(!bone?.isBone||!goal||!Number.isFinite(goal.x)||!Number.isFinite(goal.y)||!Number.isFinite(goal.z))
  throw Error('A valid joint and finite target position are required.');
 const parents=skeletonAncestors(bone,Math.max(1,Math.min(4,opts.maxParents??3)));
 const current=()=>bone.getWorldPosition(new THREE.Vector3());
 const maxStep=Math.max(.02,Math.min(.44,opts.maxStep??.26));
 const tolerance=Math.max(1e-5,Math.min(.03,opts.tolerance??.003));
 const maxIterations=Math.max(1,Math.min(22,opts.iterations??12));
 bone.updateWorldMatrix(true,true);
 if(!parents.length){
  // A skeleton root has no bone parent; allow translating the whole rig.
  // Exact bone.local coordinates come from its parent object's inverse transform.
  const targetLocal=bone.parent?bone.parent.worldToLocal(goal.clone()):goal.clone();
  if(!Number.isFinite(targetLocal.x)||!Number.isFinite(targetLocal.y)||!Number.isFinite(targetLocal.z))
   throw Error('Root joint target cannot be transformed.');
  bone.position.copy(targetLocal);
  bone.updateWorldMatrix(true,true);
  return {mode:'root-translation',moved:1,error:current().distanceTo(goal)};
 }
 let moved=0;
 for(let iter=0;iter<maxIterations;iter++){
  if(current().distanceTo(goal)<tolerance)break;
  for(const ancestor of parents){
   const pivot=ancestor.getWorldPosition(new THREE.Vector3());
   const from=current().sub(pivot),to=goal.clone().sub(pivot);
   if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)continue;
   const deltaWorld=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
   const capped=new THREE.Quaternion().rotateTowards(deltaWorld,maxStep);
   const parentQ=ancestor.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
   const localDelta=parentQ.clone().invert().multiply(capped).multiply(parentQ);
   ancestor.quaternion.premultiply(localDelta).normalize();
   ancestor.updateWorldMatrix(true,true);
   moved++;
  }
 }
 // Where all ancestors coincide, rotate-less IK cannot move the target.
 // Allow a small local translation of the selected joint to expose those
 // otherwise inaccessible zero-length rig points (restorable by Reset pose).
 if(!moved&&parents.length&&opts.allowCoincidentTranslation){
  const desired=bone.parent.worldToLocal(goal.clone());
  const offset=desired.sub(bone.position);
  const cap=Math.max(.01,Math.min(opts.maxTranslate??.1,1));
  if(offset.length()>cap)offset.setLength(cap);
  bone.position.add(offset);
  bone.updateWorldMatrix(true,true);
  return {mode:'coincident-joint-translation',moved:1,error:current().distanceTo(goal)};
 }
 return {mode:'parent-chain-ik',moved,error:current().distanceTo(goal),parents:parents.map(p=>p.name||'(unnamed bone)')};
}
