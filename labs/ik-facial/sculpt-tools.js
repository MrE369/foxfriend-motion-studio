import {presets,sculptBodyPositions,checkBodySculpt} from './anatomy-sculpt.js';
import {riggedFemalePreview} from './rigged-female-s04.js';
// CoLab Sculpt Lab v0.1 — reversible local geometry edits to selected Assembly GLBs.
// No network calls. Imported source bytes stay untouched. Static meshes only.
// Brush units are WORLD meters, accounting for Assembly parent scales.
export function installSculptTools({THREE,renderer,camera,controls,getSelected,getActive,onUpdate}){
 const $=id=>document.getElementById(id);
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),inWorld=new THREE.Vector3();
 const history=[],baselines=new Map(),adjacencyCache=new WeakMap(),anatomyBase=new WeakMap();
 let enabled=false,gesture=null,lastCursor=null;
 const status=t=>$('sculptStatus').textContent=t;
 const cursor=document.createElement('div');
 Object.assign(cursor.style,{position:'absolute',display:'none',pointerEvents:'none',zIndex:'7',border:'1.5px solid #ffdf77',borderRadius:'50%',boxShadow:'0 0 0 1px #152c3b, 0 0 10px #0008',transform:'translate(-50%,-50%)'});
 renderer.domElement.parentElement.append(cursor);
 function setEnabled(value){
   if(value&&!getActive())return status('Open Assemble first.');
   if(value&&!getSelected())return status('Add and select a GLB first.');
   if(value&&$('asDrag').checked){$('asDrag').checked=false;}
   enabled=!!value;gesture=null;controls.enabled=true;
   $('sculptToggle').classList.toggle('active',enabled);
   $('sculptToggle').textContent=enabled?'✋ Sculpt ON · touch model':'🖌 Start sculpting selected GLB';
   $('sculptOrbit').textContent=enabled?'↻ Orbit · stop sculpting':'↻ Orbit camera';
   cursor.style.display='none';onUpdate?.();
   status(enabled?'Sculpt active. Touch the selected mesh. Orbit mode is paused during a stroke.':'Orbit mode. Choose Sculpt to resume.');
 }
 function pointer(e){
   const r=renderer.domElement.getBoundingClientRect();
   mouse.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);
   ray.setFromCamera(mouse,camera);
   return r;
 }
 function getHit(e){
   const part=getSelected()?.root;if(!part)return null;
   part.updateMatrixWorld(true);pointer(e);
   return ray.intersectObject(part,true).find(hit=>hit.object.isMesh && !!hit.object.geometry?.attributes?.position)||null;
 }
 function canEdit(mesh){
   const g=mesh.geometry,p=g?.getAttribute('position');
   if(mesh.isSkinnedMesh||mesh.skeleton||g.morphAttributes?.position?.length||Object.keys(g.morphAttributes||{}).some(k=>g.morphAttributes[k]?.length))
     throw Error('Sculpting rigged or morph-target meshes is disabled until deformation-safe editing is tested. Use an unrigged head.');
   if(!p||p.itemSize!==3||p.count>80000||p.count<3)throw Error('Sculpt supports static meshes with 3–80,000 vertices.');
   if(g.index?.count>400000)throw Error('This mesh is too dense for the phone sculpt pilot.');
   return p;
 }
 function editable(mesh){
   canEdit(mesh);
   let base=baselines.get(mesh);
   if(!base){
     const original=mesh.geometry,geometry=original.clone();
     mesh.geometry=geometry;
     base={original,editable:geometry};
     baselines.set(mesh,base);
   }
   return mesh.geometry.getAttribute('position');
 }
 function normals(mesh){
   const g=mesh.geometry;
   g.computeVertexNormals();
   g.computeBoundingBox();g.computeBoundingSphere();
   g.getAttribute('position').needsUpdate=true;
   g.getAttribute('normal').needsUpdate=true;
 }
 function neighbors(mesh){
   const g=mesh.geometry,p=g.getAttribute('position');
   const old=adjacencyCache.get(g);if(old)return old;
   const links=Array.from({length:p.count},()=>new Set());
   const ids=g.index;
   const count=ids?ids.count:p.count;
   for(let i=0;i+2<count;i+=3){
      const a=ids?ids.getX(i):i,b=ids?ids.getX(i+1):i+1,c=ids?ids.getX(i+2):i+2;
      links[a].add(b);links[a].add(c);links[b].add(a);links[b].add(c);links[c].add(a);links[c].add(b);
   }
   const result=links.map(s=>Array.from(s));adjacencyCache.set(g,result);return result;
 }
 function radius(){return Number($('sculptRadius').value)||.025;}
 function strength(){return Number($('sculptStrength').value)||.002;}
 function snapshot(mesh){
   const p=editable(mesh);
   history.push({mesh,position:new Float32Array(p.array)});
   if(history.length>12)history.shift();
   $('sculptUndo').disabled=false;
 }
 function brushCandidates(mesh,point,hitNormal,rad){
   const p=mesh.geometry.getAttribute('position');
   const attrN=mesh.geometry.getAttribute('normal');
   const normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
   const selected=[];
   for(let i=0;i<p.count;i++){
     const local=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
     const pos=local.clone().applyMatrix4(mesh.matrixWorld);
     const dist=pos.distanceTo(point);
     if(dist>=rad)continue;
     // Never sweep across the opposite side of thin features or the back of the head.
     const n=attrN?new THREE.Vector3(attrN.getX(i),attrN.getY(i),attrN.getZ(i)).applyMatrix3(normalMatrix).normalize():null;
     if(n&&n.dot(hitNormal)<.10)continue;
     const falloff=Math.pow(1-(dist/rad)**2,2);
     if(falloff>.00001)selected.push({i,falloff});
   }
   return selected;
 }
 function applyBump(mesh,point,normal,kind){
   const p=mesh.geometry.getAttribute('position'),rad=radius(),inc=strength();
   const sel=brushCandidates(mesh,point,normal,rad);if(!sel.length)return 0;
   const worldToLocal=new THREE.Matrix4().copy(mesh.matrixWorld).invert();
   const worldNormalStep=normal.clone().multiplyScalar(inc*(kind==='pull'?1:-1));
   const zero=new THREE.Vector3().applyMatrix4(worldToLocal);
   const localStep=worldNormalStep.clone().applyMatrix4(worldToLocal).sub(zero);
   if(kind==='smooth'){
     const original=new Float32Array(p.array),links=neighbors(mesh);
     for(const {i,falloff} of sel){
       const ng=links[i];if(ng.length<2)continue;
       const avg=[0,0,0];
       for(const k of ng){avg[0]+=original[3*k];avg[1]+=original[3*k+1];avg[2]+=original[3*k+2];}
       const weight=Math.min(.35,inc/.012*.25)*falloff;
       p.setXYZ(i,
         original[3*i]+(avg[0]/ng.length-original[3*i])*weight,
         original[3*i+1]+(avg[1]/ng.length-original[3*i+1])*weight,
         original[3*i+2]+(avg[2]/ng.length-original[3*i+2])*weight);
     }
   }else{
     for(const {i,falloff} of sel){
       p.setXYZ(i,p.getX(i)+localStep.x*falloff,p.getY(i)+localStep.y*falloff,p.getZ(i)+localStep.z*falloff);
     }
   }
   normals(mesh);
   return sel.length;
 }
 function updateCursor(e,hit){
   if(!enabled||!getActive()||!hit){cursor.style.display='none';return;}
   const box=renderer.domElement.getBoundingClientRect(),dist=Math.max(.08,camera.position.distanceTo(hit.point)),r=radius();
   let px=camera.isPerspectiveCamera?r*box.height/(2*dist*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))):r*box.height/(camera.top-camera.bottom);
   px=Math.max(8,Math.min(box.width,px));
   const parentBox=renderer.domElement.parentElement.getBoundingClientRect();
   cursor.style.left=(e.clientX-parentBox.left)+'px';cursor.style.top=(e.clientY-parentBox.top)+'px';
   cursor.style.width=2*px+'px';cursor.style.height=2*px+'px';cursor.style.display='block';
 }
 function down(e){
   if(!enabled||!getActive()||e.button!==0||gesture)return;
   if(e.isPrimary===false)return;
   const hit=getHit(e);updateCursor(e,hit);if(!hit)return;
   const mesh=hit.object;
   try{canEdit(mesh);}catch(error){status(error.message);return;}
   anatomyBase.delete(mesh);
   snapshot(mesh);
   const face=hit.face?.normal?.clone()||new THREE.Vector3(0,0,1);
   face.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
   const mode=$('sculptMode').value;
   const g={id:e.pointerId,mesh,mode,point:hit.point.clone(),normal:face,prevX:e.clientX,prevY:e.clientY,changed:0,selected:null,position0:null,plane:null,start:null};
   if(mode==='grab'){
     const p=mesh.geometry.getAttribute('position');
     g.position0=new Float32Array(p.array);
     g.selected=brushCandidates(mesh,g.point,g.normal,radius());
     g.plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),g.point);
     g.start=ray.ray.intersectPlane(g.plane,new THREE.Vector3())?.clone()||g.point.clone();
   }else{g.changed=applyBump(mesh,g.point,g.normal,mode);}
   gesture=g;
   controls.enabled=false;
   try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}
   e.preventDefault();e.stopImmediatePropagation();
   status(mode==='grab'?'Grab active: drag gently to reposition the surface.':'Sculpting '+mesh.name+' · '+g.changed+' vertices affected.');
 }
 function move(e){
   if(!enabled||!getActive())return;
   if(!gesture){updateCursor(e,getHit(e));return;}
   if(e.pointerId!==gesture.id)return;
   e.preventDefault();e.stopImmediatePropagation();
   const g=gesture,mesh=g.mesh;
   pointer(e);
   if(g.mode==='grab'){
     const now=ray.ray.intersectPlane(g.plane,new THREE.Vector3());if(!now)return;
     const delta=now.sub(g.start),clamp=radius()*1.5;if(delta.length()>clamp)delta.setLength(clamp);
     const inverse=new THREE.Matrix4().copy(mesh.matrixWorld).invert(),zero=new THREE.Vector3().applyMatrix4(inverse);
     const local=delta.clone().applyMatrix4(inverse).sub(zero),p=mesh.geometry.getAttribute('position');
     for(const {i,falloff} of g.selected)p.setXYZ(i,
       g.position0[3*i]+local.x*falloff,g.position0[3*i+1]+local.y*falloff,g.position0[3*i+2]+local.z*falloff);
     g.changed=g.selected.length;normals(mesh);
   }else{
     if(Math.hypot(e.clientX-g.prevX,e.clientY-g.prevY)<10)return;
     g.prevX=e.clientX;g.prevY=e.clientY;
     const hits=ray.intersectObject(mesh,false);const hit=hits[0];
     if(hit){const n=hit.face?.normal?.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize()||g.normal;g.changed+=applyBump(mesh,hit.point,n,g.mode);}
   }
   onUpdate?.();
 }
 function end(e){
   if(!gesture||(e&&e.pointerId!==gesture.id))return;
   const g=gesture;gesture=null;controls.enabled=true;onUpdate?.();
   // Measure real displacement, not just brush candidates (which may not move).
   const last=history[history.length-1],p=g.mesh.geometry.getAttribute('position');
   let changed=0,maxM=0;
   if(last?.mesh===g.mesh&&last.position.length===p.array.length){
     g.mesh.updateMatrixWorld(true);
     const linear=new THREE.Matrix3().setFromMatrix4(g.mesh.matrixWorld);
     const world=new THREE.Vector3();
     for(let i=0;i<p.count;i++){
       const j=3*i,dx=p.array[j]-last.position[j],dy=p.array[j+1]-last.position[j+1],dz=p.array[j+2]-last.position[j+2];
       if(dx===0&&dy===0&&dz===0)continue;
       const d=world.set(dx,dy,dz).applyMatrix3(linear).length();
       if(d>.00001)changed++;
       if(d>maxM)maxM=d;
     }
   }
   const mm=maxM*1000;
   const detail=changed+' vertices moved; maximum change '+mm.toFixed(3)+' mm.';
   if(mm<.05)status('Very subtle sculpt stroke: '+detail+' Try a few more passes or increase strength. Undo available.');
   else status('Sculpt stroke complete: '+detail+' Review from several angles. Undo available.');
 }
 renderer.domElement.addEventListener('pointerdown',down,true);
 renderer.domElement.addEventListener('pointermove',move,true);
 renderer.domElement.addEventListener('pointerup',end,true);
 renderer.domElement.addEventListener('pointercancel',end,true);
 renderer.domElement.addEventListener('lostpointercapture',end,true);
 renderer.domElement.addEventListener('pointerleave',()=>{if(!gesture)cursor.style.display='none';});
 $('sculptToggle').onclick=()=>setEnabled(!enabled);
 $('sculptOrbit').onclick=()=>setEnabled(false);
 $('sculptUndo').onclick=()=>{
   if(gesture)end();const step=history.pop();if(!step)return status('No sculpt strokes to undo.');
   const p=step.mesh.geometry.getAttribute('position');
   if(p?.count*3===step.position.length){
     p.array.set(step.position);
     if(step.mesh.isSkinnedMesh){p.needsUpdate=true;step.mesh.geometry.computeBoundingBox();step.mesh.geometry.computeBoundingSphere();}
     else normals(step.mesh);
     anatomyBase.delete(step.mesh);
   }
   $('sculptUndo').disabled=!history.length;onUpdate?.();
   status('Last sculpt stroke undone. Source files are unchanged.');
 };
 $('sculptReset').onclick=()=>{
   const part=getSelected();if(!part)return status('Choose a model to reset.');
   if(!confirm('Discard all sculpting on this selected GLB? Placement stays unchanged.'))return;
   part.root.traverse(o=>{anatomyBase.delete(o);const b=baselines.get(o);if(b){o.geometry=b.original;b.editable.dispose();baselines.delete(o);}});
   for(let i=history.length-1;i>=0;i--)if(part.root.getObjectById(history[i].mesh.id))history.splice(i,1);
   $('sculptUndo').disabled=!history.length;onUpdate?.();status('Sculpt edits reset on selected GLB only.');
 };
 $('sculptRadius').oninput=e=>$('sculptRadiusLabel').textContent=Number(e.target.value).toFixed(3)+' m';
 function describeStrength(){
  const inc=Number($('sculptStrength').value);
  $('sculptStrengthLabel').textContent=$('sculptMode').value==='smooth'
    ?(Math.min(.35,inc/.012*.25)*100).toFixed(1)+'% center blending per dab'
    :(inc*1000).toFixed(1)+' mm per dab';
 }
 $('sculptStrength').oninput=describeStrength;
 $('sculptMode').onchange=describeStrength;
 describeStrength();
 $('sculptUndo').disabled=true;
 // S-02: True vertex deformation of an upright, static body mesh (no whole-object scale).
 $('bodyApply').onclick=()=>{
   if(!getActive())return status('Open Assemble and select a static upright humanoid body.');
   const entry=getSelected();if(!entry)return status('Choose a body in Assemble first.');
   const meshes=[];let rigged=false;
   entry.root.traverse(o=>{
     if(o.isSkinnedMesh||o.skeleton)rigged=true;
     if(o.isMesh&&o.geometry?.attributes?.position)meshes.push(o);
   });
   if(rigged)return status('Body shaping is static-only in S-02. A skinned Quaternius or Finn body requires a rig-aware workflow.');
   if(!meshes.length)return status('No mesh in selected asset.');
   meshes.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count);
   const mesh=meshes[0];
   try{
     const p=editable(mesh);
     let baseline=anatomyBase.get(mesh);
     if(!baseline){baseline=new Float32Array(p.array);anatomyBase.set(mesh,baseline);}
     const preset=$('bodyPreset').value,config=presets()[preset];
     if(!config)throw Error('Unknown body variant.');
     const intensity=Number($('bodyIntensity').value)/100;
     if(!Number.isFinite(intensity)||intensity<0||intensity>1)throw Error('Invalid intensity.');
     const values=Object.fromEntries(Object.entries(config).map(([key,val])=>[key,val*intensity]));
     const result=sculptBodyPositions(baseline,values);
     const audit=checkBodySculpt(baseline,result.positions,mesh.geometry.index);
     if(!audit.passed)throw Error(audit.message+' '+audit.flips+' flipped triangles.');
     snapshot(mesh);
     p.array.set(result.positions);
     normals(mesh);
     onUpdate?.();
     status('Body '+preset+' at '+Math.round(intensity*100)+'%: '+result.changed+
       ' vertices changed, max '+(1000*result.maxDisplacement).toFixed(1)+' mm. '+
       audit.triangles+' triangles passed orientation/strain checks. Undo available. Skinning not tested.');
   }catch(e){status('Body sculpt not applied: '+e.message);}
 };
 $('bodyIntensity').oninput=e=>$('bodyIntensityLabel').textContent=e.target.value+'%';
 // S-04: guarded rigged-asset pilot. Bone hierarchy, indices and weights
 // never change; this operation writes only cloned POSITION attribute bytes.
 $('riggedApply').onclick=()=>{
   if(!getActive())return status('Switch to Assemble to shape a character.');
   const entry=getSelected();if(!entry)return status('Choose a loaded rigged female Superhero.');
   const bodies=[];
   entry.root.traverse(o=>{if(o.isSkinnedMesh&&o.name==='Superhero_Female')bodies.push(o);});
   if(bodies.length!==1)return status('S-04 only accepts one exact Quaternius Superhero_Female mesh.');
   const mesh=bodies[0];
   try{
     const intensity=Number($('riggedIntensity').value)/100;
     const existing=baselines.get(mesh),original=existing?.original||mesh.geometry;
     // Preview against original position buffer for non-accumulating repeatability.
     const proposal=riggedFemalePreview({
       isSkinnedMesh:true,skeleton:mesh.skeleton,
       name:mesh.name,geometry:original
     },intensity);
     if(!existing){
       const g=original.clone();mesh.geometry=g;
       baselines.set(mesh,{original,editable:g});
     }
     const position=mesh.geometry.getAttribute('position');
     history.push({mesh,position:new Float32Array(position.array)});
     if(history.length>12)history.shift();
     position.array.set(proposal.positions);position.needsUpdate=true;
     mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
     $('sculptUndo').disabled=false;
     onUpdate?.();
     status('S-04 rigged proposal at '+Math.round(intensity*100)+'%: '+
       proposal.stats.verticesChanged+' vertices moved, max '+proposal.stats.maxDisplacementMm.toFixed(2)+
       ' mm. Skin weights and bone transforms untouched. Undo available; ANIMATION VISUAL QUALITY NOT GUARANTEED.');
   }catch(err){status('Rigged sculpt blocked: '+err.message);}
 };
 $('riggedIntensity').oninput=e=>$('riggedIntensityLabel').textContent=e.target.value+'%';
 return {setActive(v){if(!v)setEnabled(false);},isEditing:()=>enabled,cancel:()=>{if(gesture)end();}};
}
