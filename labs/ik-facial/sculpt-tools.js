// CoLab Sculpt Lab v0.1 — reversible local geometry edits to selected Assembly GLBs.
// No network calls. Imported source bytes stay untouched. Static meshes only.
// Brush units are WORLD meters, accounting for Assembly parent scales.
export function installSculptTools({THREE,renderer,camera,controls,getSelected,getActive,onUpdate}){
 const $=id=>document.getElementById(id);
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),inWorld=new THREE.Vector3();
 const history=[],baselines=new Map();
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
   cursor.style.display='none';
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
   const g=mesh.geometry,p=g.getAttribute('position'),links=Array.from({length:p.count},()=>new Set());
   const ids=g.index;
   const count=ids?ids.count:p.count;
   for(let i=0;i+2<count;i+=3){
      const a=ids?ids.getX(i):i,b=ids?ids.getX(i+1):i+1,c=ids?ids.getX(i+2):i+2;
      links[a].add(b);links[a].add(c);links[b].add(a);links[b].add(c);links[c].add(a);links[c].add(b);
   }
   return links.map(s=>Array.from(s));
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
   status('Sculpt stroke complete: '+g.changed+' vertex touches. Review from several angles. Undo is available.');
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
   if(p?.count*3===step.position.length){p.array.set(step.position);normals(step.mesh);}
   $('sculptUndo').disabled=!history.length;onUpdate?.();
   status('Last sculpt stroke undone. Source files are unchanged.');
 };
 $('sculptReset').onclick=()=>{
   const part=getSelected();if(!part)return status('Choose a model to reset.');
   if(!confirm('Discard all sculpting on this selected GLB? Placement stays unchanged.'))return;
   part.root.traverse(o=>{const b=baselines.get(o);if(b){o.geometry=b.original;b.editable.dispose();baselines.delete(o);}});
   for(let i=history.length-1;i>=0;i--)if(part.root.getObjectById(history[i].mesh.id))history.splice(i,1);
   $('sculptUndo').disabled=!history.length;onUpdate?.();status('Sculpt edits reset on selected GLB only.');
 };
 $('sculptRadius').oninput=e=>$('sculptRadiusLabel').textContent=Number(e.target.value).toFixed(3)+' m';
 $('sculptStrength').oninput=e=>$('sculptStrengthLabel').textContent=(Number(e.target.value)*1000).toFixed(1)+' mm';
 $('sculptUndo').disabled=true;
 return {setActive(v){if(!v)setEnabled(false);},isEditing:()=>enabled,cancel:()=>{if(gesture)end();}};
}
