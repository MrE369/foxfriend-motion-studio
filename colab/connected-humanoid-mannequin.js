/**
 * Finn & Sylvara CoLab — connected reference mannequin v0.1
 * Display-only, follows imported THREE.Bone objects in world space.
 * Does not parent to, alter, skin, or export with the original GLB.
 * Intended for standard humanoids; other rigs retain skeletal line mode.
 */
export function createConnectedHumanoidMannequin(THREE, scene) {
  const layer = new THREE.Group();
  layer.name = 'CoLab_EDITOR_ONLY_ReferenceMannequin';
  layer.visible = false;
  scene.add(layer); // Deliberately NOT inside the loaded GLB's export root.
  const skeletonLayer = new THREE.Group(), figureLayer = new THREE.Group(), jointLayer = new THREE.Group();
  layer.add(figureLayer, skeletonLayer, jointLayer);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const ball = new THREE.SphereGeometry(1, 14, 10);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const V = () => new THREE.Vector3();
  const palettes = {
    core: 0xb9d6df,
    left: 0x86d4dc,
    right: 0xe2ba9c,
    joint: 0x223f52
  };
  const materials = Object.fromEntries(Object.entries(palettes).map(([name, color]) =>
    [name, new THREE.MeshStandardMaterial({
      color, roughness: .91, metalness: 0, transparent: true, opacity: .96, depthWrite: true
    })]));
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xffefbb, depthTest: false, depthWrite: false,
    transparent: true, opacity: .94
  });
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true, depthTest: false, depthWrite: false,
    transparent: true, opacity: .92
  });
  let rig = null, bones = [], boneByName = new Map(), sourceMeshes = [];
  let savedVisibility = null, viewMode = 'original', translucent = false;
  let scale = 1, segments = [], orbs = [], jointMarkers = [], skeletonGeometry = null;
  let skeletonLinks = [], diagnostic = {supported: false, missing: [], boneCount: 0, disconnected: []};

  const required = [
    'Hips', 'Spine', 'Chest', 'UpperChest', 'Neck', 'Head', 'HeadTop',
    'LeftShoulder', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'LeftFinger',
    'RightShoulder', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'RightFinger',
    'LeftUpperLeg', 'LeftLowerLeg', 'LeftFoot', 'LeftToes',
    'RightUpperLeg', 'RightLowerLeg', 'RightFoot', 'RightToes'
  ];
  // All lengths derive from actual parent/child bone locations each frame.
  // No geometric segment is drawn from Root to Hips: Root is a motion anchor.
  const specs = [
    ['Hips','Spine',.128,'core'], ['Spine','Chest',.146,'core'],
    ['Chest','UpperChest',.161,'core'], ['UpperChest','Neck',.102,'core'],
    ['Neck','Head',.066,'core'],
    ['UpperChest','LeftShoulder',.091,'left'],
    ['LeftShoulder','LeftUpperArm',.081,'left'],
    ['LeftUpperArm','LeftLowerArm',.076,'left'],
    ['LeftLowerArm','LeftHand',.055,'left'],
    ['LeftHand','LeftFinger',.057,'left'],
    ['UpperChest','RightShoulder',.091,'right'],
    ['RightShoulder','RightUpperArm',.081,'right'],
    ['RightUpperArm','RightLowerArm',.076,'right'],
    ['RightLowerArm','RightHand',.055,'right'],
    ['RightHand','RightFinger',.057,'right'],
    ['Hips','LeftUpperLeg',.117,'left'],
    ['LeftUpperLeg','LeftLowerLeg',.105,'left'],
    ['LeftLowerLeg','LeftFoot',.076,'left'],
    ['LeftFoot','LeftToes',.072,'left'],
    ['Hips','RightUpperLeg',.117,'right'],
    ['RightUpperLeg','RightLowerLeg',.105,'right'],
    ['RightLowerLeg','RightFoot',.076,'right'],
    ['RightFoot','RightToes',.072,'right']
  ];
  function restoreMeshVisibility() {
    if (!savedVisibility) return;
    for (const [mesh, wasVisible] of savedVisibility) mesh.visible = wasVisible;
    savedVisibility = null;
  }
  function hideSourceGuides() {
    if (!savedVisibility) savedVisibility = sourceMeshes.map(mesh => [mesh, mesh.visible]);
    for (const [mesh] of savedVisibility) mesh.visible = false;
  }
  function reset() {
    restoreMeshVisibility();
    rig = null; bones = []; boneByName.clear(); sourceMeshes = [];
    segments = []; orbs = []; jointMarkers = []; skeletonLinks = [];
    skeletonLayer.clear(); figureLayer.clear(); jointLayer.clear(); skeletonGeometry?.dispose();
    skeletonGeometry = null; layer.visible = false;
    diagnostic = {supported: false, missing: [], boneCount: 0, disconnected: []};
  }
  function sphere(name, radius, palette, opts = {}) {
    const mesh = new THREE.Mesh(ball, materials[palette]);
    mesh.name = 'Reference_' + name;
    mesh.userData.referenceOnly = true;
    figureLayer.add(mesh);
    return {mesh, name, radius, ...opts};
  }
  function setRig(model, importedBones) {
    reset();
    if (!model || !Array.isArray(importedBones) || !importedBones.length) return diagnostic;
    rig = model;
    bones = importedBones.slice();
    rig.traverse(node => { if (node.isMesh) sourceMeshes.push(node); });
    for (const b of bones) {
      if (b.name && !boneByName.has(b.name)) boneByName.set(b.name, b);
    }
    rig.updateWorldMatrix(true, true);
    const bonePositions = bones.map(b => b.getWorldPosition(V()));
    let minY = Infinity, maxY = -Infinity;
    for (const b of bones) {
      if (/^Root$/i.test(b.name)) continue;
      const p = b.getWorldPosition(V());
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    scale = Math.max(.03, Math.min(100, (maxY - minY) / 1.95 || 1));
    const missing = required.filter(name => !boneByName.has(name));
    const connected = new Set(bones);
    const disconnected = [];
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i], parent = b.parent;
      if (parent?.isBone && connected.has(parent)) {
        if (/^Root$/i.test(parent.name) && /^Hips$/i.test(b.name)) continue;
        skeletonLinks.push([bones.indexOf(parent), i]);
      } else if (parent?.isBone && !connected.has(parent)) disconnected.push(b.name || String(i));
    }
    diagnostic = {
      supported: missing.length === 0,
      missing, boneCount: bones.length, disconnected,
      scale: Number(scale.toFixed(4))
    };
    skeletonGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(skeletonLinks.length * 6);
    const colors = new Float32Array(skeletonLinks.length * 6);
    skeletonLinks.forEach(([a, b], index) => {
      const name = bones[b].name;
      const tint = name.startsWith('Left') ? 0x86d4dc :
        name.startsWith('Right') ? 0xe2ba9c : 0xb9d6df;
      const c = new THREE.Color(tint);
      for (let j = 0; j < 2; j++) c.toArray(colors, index * 6 + j * 3);
    });
    skeletonGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    skeletonGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const lines = new THREE.LineSegments(skeletonGeometry, lineMat);
    lines.frustumCulled = false; lines.renderOrder = 1000;
    skeletonLayer.add(lines);
    // Small bone markers aid anatomical reading; original Pose controls still
    // provide the larger clickable/touch targets.
    for (const b of bones) {
      if (b.name === 'Root') continue;
      const marker = new THREE.Mesh(ball, markerMat);
      marker.renderOrder = 1002; marker.name = 'ReferenceJoint_' + (b.name || 'joint');
      marker.scale.setScalar(.020 * scale);
      jointLayer.add(marker);
      jointMarkers.push({bone: b, mesh: marker});
    }
    if (diagnostic.supported) {
      for (const [a, b, radius, palette] of specs) {
        const mesh = new THREE.Mesh(cylinder, materials[palette]);
        mesh.name = 'ReferenceLimb_' + a + '_to_' + b;
        figureLayer.add(mesh);
        segments.push({a: boneByName.get(a), b: boneByName.get(b), radius, mesh});
      }
      // Overlapping volumes form continuous torso, shoulder and hip contours.
      for (const [name, radius, palette, extra] of [
        ['Hips',.183,'core',{width:1.10,height:.62,depth:.69}],
        ['Spine',.140,'core',{width:1.05,height:.82,depth:.86}],
        ['Chest',.169,'core',{width:1.04,height:.75,depth:.80}],
        ['UpperChest',.162,'core',{width:1.12,height:.76,depth:.86}],
        ['LeftShoulder',.083,'left',{}], ['RightShoulder',.083,'right',{}],
        ['LeftUpperArm',.079,'left',{}], ['RightUpperArm',.079,'right',{}],
        ['LeftLowerArm',.065,'left',{}], ['RightLowerArm',.065,'right',{}],
        ['LeftUpperLeg',.109,'left',{}], ['RightUpperLeg',.109,'right',{}],
        ['LeftLowerLeg',.077,'left',{}], ['RightLowerLeg',.077,'right',{}]
      ]) orbs.push(sphere(name, radius, palette, {bone: boneByName.get(name), extra}));
      // Simplified oval head, palms and forward-pointing shoes.
      orbs.push(sphere('HeadShell', 1, 'core', {
        between: ['Head','HeadTop'], dimensions: [.126,.183,.112]
      }));
      for (const side of ['Left', 'Right']) {
        orbs.push(sphere(side + 'Palm', 1, side.toLowerCase(), {
          between: [side + 'Hand', side + 'Finger'], dimensions: [.082,.057,.045]
        }));
        orbs.push(sphere(side + 'Shoe', 1, side.toLowerCase(), {
          between: [side + 'Foot', side + 'Toes'], dimensions: [.075,.080,.095]
        }));
      }
    }
    setMode(viewMode);
    update(true);
    return diagnostic;
  }
  function setMode(mode) {
    viewMode = ['original','skeleton','mannequin','combined'].includes(mode) ? mode : 'original';
    if (!diagnostic.supported && (viewMode === 'mannequin' || viewMode === 'combined')) viewMode = 'skeleton';
    return viewMode;
  }
  function setTranslucent(next) {
    translucent = !!next;
    for (const mat of Object.values(materials)) {
      mat.opacity = translucent ? .48 : .96;
      mat.depthWrite = !translucent;
      mat.needsUpdate = true;
    }
    return translucent;
  }
  function update(active = true) {
    if (!rig) { layer.visible = false; return; }
    const isVisible = active && rig.visible && viewMode !== 'original';
    if (!isVisible) { restoreMeshVisibility(); layer.visible = false; return; }
    hideSourceGuides();
    layer.visible = true;
    skeletonLayer.visible = viewMode === 'skeleton' || viewMode === 'combined';
    figureLayer.visible = viewMode === 'mannequin' || viewMode === 'combined';
    jointLayer.visible = true; // Joint positions remain visible over the mannequin.
    rig.updateWorldMatrix(true, true);
    const positions = bones.map(b => b.getWorldPosition(V()));
    if (skeletonGeometry) {
      const a = skeletonGeometry.attributes.position;
      skeletonLinks.forEach(([p,q],i) => {
        const x=positions[p], z=positions[q];
        a.setXYZ(i*2,x.x,x.y,x.z);
        a.setXYZ(i*2+1,z.x,z.y,z.z);
      });
      a.needsUpdate = true;
    }
    for (const x of jointMarkers) x.mesh.position.copy(x.bone.getWorldPosition(V()));
    if (!figureLayer.visible) return;
    for (const {a,b,radius,mesh} of segments) {
      const p = a.getWorldPosition(V()), q = b.getWorldPosition(V());
      const diff = q.clone().sub(p), len = diff.length();
      mesh.visible = len > 1e-6;
      if (!mesh.visible) continue;
      mesh.position.copy(p).add(q).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(yAxis, diff.divideScalar(len));
      const r = radius * scale;
      mesh.scale.set(r, len + r * .8, r);
    }
    for (const o of orbs) {
      const mesh = o.mesh, r = o.radius * scale;
      if (o.between) {
        const a=boneByName.get(o.between[0]).getWorldPosition(V());
        const b=boneByName.get(o.between[1]).getWorldPosition(V());
        const diff=b.clone().sub(a), length=diff.length();
        mesh.position.copy(a).lerp(b, .50);
        mesh.quaternion.setFromUnitVectors(yAxis,length>1e-6?diff.normalize():yAxis);
        mesh.scale.set(o.dimensions[0]*scale,o.dimensions[1]*scale,o.dimensions[2]*scale);
      } else {
        mesh.position.copy(o.bone.getWorldPosition(V()));
        mesh.quaternion.copy(o.bone.getWorldQuaternion(new THREE.Quaternion()));
        mesh.scale.set(r*(o.extra?.width || 1), r*(o.extra?.height || 1), r*(o.extra?.depth || 1));
      }
    }
  }
  function bounds() {
    if (!rig || !bones.length) return null;
    rig.updateWorldMatrix(true, true);
    const points=bones.filter(b=>b.name!=='Root').map(b=>b.getWorldPosition(V()));
    if (!points.length) return null;
    return new THREE.Box3().setFromPoints(points).expandByScalar(.05 * scale);
  }
  function pickableMeshes() {
    if (!layer.visible || !figureLayer.visible || !rig) return [];
    return figureLayer.children.filter(mesh => mesh.isMesh && mesh.visible);
  }
  function status() { return {...diagnostic, mode: viewMode, translucent, segmentCount: segments.length}; }
  return {
    setRig, setMode, setTranslucent, update, clear: reset, bounds, status, pickableMeshes,
    get mode(){return viewMode;}, get supported(){return diagnostic.supported;}
  };
}
