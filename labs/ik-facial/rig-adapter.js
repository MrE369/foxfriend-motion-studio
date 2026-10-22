/**
 * CoLab Rig Adapter 0.1 — engine-friendly bridge between imported rigs and pose tools.
 * No Three.js import: the adapter consumes the live GLTFLoader result and returns
 * real Object3D bone references, plus serializable diagnostics.
 * Never assumes bone-local XYZ are anatomical hinge axes.
 */
export const RIG_ADAPTER_SCHEMA = 'colab-rig-adapter-v1';
export const VRM_HUMAN_BONES = Object.freeze([
  'hips','spine','chest','upperChest','neck','head','jaw','leftEye','rightEye',
  'leftShoulder','leftUpperArm','leftLowerArm','leftHand',
  'rightShoulder','rightUpperArm','rightLowerArm','rightHand',
  'leftUpperLeg','leftLowerLeg','leftFoot','leftToes',
  'rightUpperLeg','rightLowerLeg','rightFoot','rightToes',
]);
const clean = name => String(name || '').replace(/[^a-zA-Z0-9_]/g, '');
const isBone = obj => Boolean(obj?.isBone);
const parentIs = (child,parent) => Boolean(child && parent && child.parent === parent);
const objectChildren = object => { const arr=[];object?.traverse?.(o=>arr.push(o));return arr; };
const positionArray = b => b?.position?.toArray?.() || null;
const rotationArray = b => b?.quaternion?.toArray?.() || null;
const safeName = b => b?.name || '(unnamed)';
function connectedTriple(nodes) {
  return nodes.length === 3 && parentIs(nodes[1],nodes[0]) && parentIs(nodes[2],nodes[1]);
}
function uniqueChains(chains) {
  const ids = new Set();
  return chains.filter(ch => {const key=ch.bones.map(b=>b.uuid || b.name).join('/');
    if(ids.has(key))return false;ids.add(key);return true;});
}
function chain(id,label,bones,confidence,category,notes='') {
  return {id,label,bones,confidence,category,notes};
}
function part(id,label,bone,confidence,category='body') {
  return {id,label,bone,confidence,category};
}
export async function createRigAdapter(gltf) {
  if(!gltf?.scene?.traverse) throw new Error('Rig Adapter expects a GLTFLoader result containing scene.');
  const nodes=objectChildren(gltf.scene);
  const bones=nodes.filter(isBone);
  const byName=new Map(),byCanonicalName=new Map();
  for(const b of bones){if(!byName.has(b.name))byName.set(b.name,b);
    const normalized=clean(b.name);if(normalized&&!byCanonicalName.has(normalized))byCanonicalName.set(normalized,b);}
  const get = name => byName.get(name) || byCanonicalName.get(clean(name)) || null;
  const meshes=nodes.filter(n=>n.isSkinnedMesh);
  const morphs=nodes.filter(n=>n.isMesh && n.morphTargetInfluences?.length);
  const warnings=[];
  const parts=[];
  let chains=[];
  const meta=gltf.parser?.json?.extensions?.VRMC_vrm || gltf.userData?.gltfExtensions?.VRMC_vrm || gltf.scene.userData?.gltfExtensions?.VRMC_vrm || null;
  let kind='unknown',layout='unknown',confidence='low';
  const humanBones={};
  if(meta && meta.humanoid && meta.humanoid.humanBones) {
    kind='vrm1-humanoid';layout='humanoid';confidence='high';
    const defs=meta.humanoid.humanBones;
    for(const [role,definition] of Object.entries(defs)) {
      const idx=definition?.node;
      if(!Number.isInteger(idx)){warnings.push('VRM bone '+role+' has no valid node index.');continue;}
      try {
        const resolved=await gltf.parser?.getDependency?.('node',idx);
        if(isBone(resolved)&&bones.includes(resolved))humanBones[role]=resolved;
        else warnings.push('VRM '+role+' node '+idx+' was not resolved to a scene bone.');
      }catch(err){warnings.push('VRM '+role+' could not be resolved: '+String(err?.message||err));}
    }
    for(const [role,label] of [['head','Head'],['neck','Neck'],['spine','Spine'],['chest','Chest'],['upperChest','Upper chest'],['hips','Hips'],
      ['leftHand','Left hand'],['rightHand','Right hand'],['leftFoot','Left foot'],['rightFoot','Right foot']]){
      if(humanBones[role])parts.push(part(role,label,humanBones[role],'high'));
    }
    for(const [id,label,roles] of [
      ['leftArm','Left arm',['leftUpperArm','leftLowerArm','leftHand']],
      ['rightArm','Right arm',['rightUpperArm','rightLowerArm','rightHand']],
      ['leftLeg','Left leg',['leftUpperLeg','leftLowerLeg','leftFoot']],
      ['rightLeg','Right leg',['rightUpperLeg','rightLowerLeg','rightFoot']]
    ]) {
      const selected=roles.map(r=>humanBones[r]);
      if(selected.every(Boolean)&&connectedTriple(selected))chains.push(chain(id,label,selected,'high','limb'));
      else if(selected.every(Boolean))warnings.push(label+' needs a non-direct chain adapter before IK (VRM bones are not direct parent/child/child).');
    }
    if(!Object.keys(humanBones).length){warnings.push('VRM extension detected but no humanoid bones could be resolved.');confidence='low';}
  } else {
    const tripoBones=bones.filter(b=>/^tripo(?:[:_]|Root|Head|Spine|\d)/i.test(b.name));
    if(tripoBones.length>=3){
      kind='tripo-native';confidence='medium';layout='creature';
      const groups=new Map();
      for(const b of bones){
        const match=/^tripo(\d+)_(left|right)_limb_(\d+)$/i.exec(clean(b.name));
        if(!match)continue;
        const key=match[1]+'_'+match[2].toLowerCase();
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push({index:Number(match[3]),bone:b,group:match[1],side:match[2].toLowerCase()});
      }
      for(const [key,group] of groups) {
        group.sort((a,b)=>a.index-b.index);
        // A native Tripo limb may have an extra root bone: the distal 3 joints
        // form a direct two-segment IK candidate. Verify each actual hierarchy.
        for(let offset=group.length-3;offset>=0;offset--){
          const candidate=group.slice(offset,offset+3).map(x=>x.bone);
          if(connectedTriple(candidate)){
            const side=group[0].side;
            const label='Group '+group[0].group+' · '+side+' limb';
            chains.push(chain('tripo-'+key,label,candidate,'medium','limb','Anatomical limb assignment and bend constraints not yet verified.'));
            break;
          }
        }
      }
      const head=get('tripoHead_1')||get('tripoHead_0');
      if(head)parts.push(part('head','Head',head,'medium'));
      for(const [id,label,name] of [
        ['neck','Neck / upper spine','tripoSpine_2'],
        ['spine','Spine','tripoSpine_1'],
        ['hips','Spine base / hips','tripoSpine_0']
      ]){const b=get(name);if(b)parts.push(part(id,label,b,'low'));}
      if(chains.length===4 && get('tripoHead_0') && get('tripoSpine_0')) layout='four-limbed creature (unverified anatomy)';
      warnings.push('Tripo native rigs do not supply standard anatomical rotation limits or guaranteed leg/wing labels.');
      if(!chains.length)warnings.push('Native Tripo skeleton found, but no directly connected three-bone limb chains were identified.');
    } else if(bones.length){
      kind='generic-skeleton';layout='unknown';confidence='low';
      for(const b of bones){if(/head/i.test(b.name))parts.push(part('possibleHead','Possible head',b,'low'));}
      warnings.push('Unknown skeleton convention. Automatic IK is disabled unless a validated chain is available.');
    } else {
      kind='unrigged';layout='static-mesh';confidence='high';
      warnings.push('No bones in this model.');
    }
  }
  chains=uniqueChains(chains);
  // A single common pose object backs both future joint and IK manipulators.
  // Controlled tools must explicitly take ownership before they write transforms.
  const rest=bones.map(b=>({
    bone:b,position:b.position?.clone?.(),rotation:b.quaternion?.clone?.(),scale:b.scale?.clone?.()
  }));
  let activeTool=null;
  const pose={
    get owner(){return activeTool;},
    acquire(tool){if(tool!=='joint'&&tool!=='ik')throw new Error('Expected joint or ik tool');activeTool=tool;return true;},
    canWrite(tool){return activeTool===tool;},
    release(tool){if(!tool||activeTool===tool)activeTool=null;},
    reset(){for(const r of rest){if(r.position)r.bone.position.copy(r.position);if(r.rotation)r.bone.quaternion.copy(r.rotation);if(r.scale)r.bone.scale.copy(r.scale);} },
    snapshot(){return bones.map(b=>({name:b.name,quaternion:rotationArray(b),position:positionArray(b)}));},
  };
  const details={
    schema:RIG_ADAPTER_SCHEMA,kind,layout,confidence,boneCount:bones.length,
    skinnedMeshCount:meshes.length,morphMeshCount:morphs.length,
    parts:parts.map(p=>({id:p.id,label:p.label,bone:safeName(p.bone),confidence:p.confidence})),
    chains:chains.map(ch=>({id:ch.id,label:ch.label,bones:ch.bones.map(safeName),confidence:ch.confidence,category:ch.category,notes:ch.notes})),
    humanBoneRoles:Object.keys(humanBones),warnings,
    limits:'No joint rotation limits inferred from the skeleton alone.'
  };
  return {schema:RIG_ADAPTER_SCHEMA,kind,layout,confidence,bones,meshes,morphs,parts,chains,humanBones,warnings,pose,details,
    getBone:get,getPart:id=>parts.find(p=>p.id===id)||null,getChain:id=>chains.find(ch=>ch.id===id)||null,
    diagnostics:()=>({...details,restBones:rest.map(r=>({name:safeName(r.bone),parent:safeName(r.bone.parent),translation:positionArray(r.bone),rotation:rotationArray(r.bone)}))})};
}
