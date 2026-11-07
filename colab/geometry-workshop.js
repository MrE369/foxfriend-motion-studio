// CoLab Geometry Workshop v0.1 — additive, local-first, original GLB untouched.
// Draft meshes can be exported alone or in a separate combined candidate.
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

export function installGeometryWorkshop({THREE,GLTFExporter,scene,camera,renderer,overlay,getOriginal,getHit}){
  const $=id=>document.getElementById(id);
  const draft=new THREE.Group();draft.name='Geometry_Workshop_Draft';scene.add(draft);
  const history=[];let active=null,anchorA=null,anchorB=null,dragEnabled=false,dragSession=null;
  const notice=s=>{$('gwStatus').textContent=s;};
  const material=()=>new THREE.MeshStandardMaterial({color:0x82dab9,roughness:.86,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:.92});
  const finite=(id,min,max)=>{const n=Number($(id).value);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${id} must be between ${min} and ${max}.`);return n;};
  function disposeChild(o){o.traverse(x=>{if(x.isMesh)x.geometry.dispose();});}
  function cloneDraft(){const g=new THREE.Group();for(const obj of draft.children){const c=obj.clone();c.geometry=obj.geometry.clone();g.add(c);}return g;}
  function checkpoint(){history.push(cloneDraft());if(history.length>12){disposeChild(history.shift());}update();}
  function update(){
    const s=$('gwMeshes');s.replaceChildren();
    draft.children.forEach((o,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} · ${o.name}`;s.add(option);});
    if(active&&draft.children.includes(active))s.value=String(draft.children.indexOf(active));
    $('gwUndo').disabled=!history.length;$('gwDelete').disabled=!active;
    $('gwShape').disabled=!active;
    $('gwExport').disabled=!draft.children.length;$('gwExportCombined').disabled=!draft.children.length;
    $('gwCount').textContent=`${draft.children.length} draft mesh(es)`;
    for(const id of ['gwX','gwY','gwZ','gwScale'])$(id).disabled=!active;
    if(active){$('gwX').value=active.position.x.toFixed(4);$('gwY').value=active.position.y.toFixed(4);$('gwZ').value=active.position.z.toFixed(4);$('gwScale').value=active.scale.x.toFixed(4);}
    for(const [axis,value] of Object.entries({X:active?.position.x,Y:active?.position.y,Z:active?.position.z,Scale:active?.scale.x})){
      const range=$('gwRange'+axis);range.disabled=!active;
      if(active){range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),value)));$('gwValue'+axis).textContent=value.toFixed(3);}
      else $('gwValue'+axis).textContent='—';
    }
    for(const b of document.querySelectorAll('[data-gw-nudge]'))b.disabled=!active;
    $('gwDrag').disabled=!active;$('gwDrag').setAttribute('aria-pressed',String(dragEnabled));
    $('gwDrag').textContent=dragEnabled?'✋ Drag piece: ON':'✋ Drag piece: OFF';
    $('gwA').textContent=anchorA?'A ✓ '+anchorA.meshName:'A · not chosen';
    $('gwB').textContent=anchorB?'B ✓ '+anchorB.meshName:'B · not chosen';
  }
  function add(geometry,name,at){checkpoint();const m=new THREE.Mesh(geometry,material());m.name=name;m.position.copy(at);draft.add(m);active=m;update();notice(name+' added to the separate draft layer.');}
  function currentPoint(){const h=getHit();if(h?.point?.length===3)return new THREE.Vector3(...h.point);const original=getOriginal();if(original){return new THREE.Box3().setFromObject(original).getCenter(new THREE.Vector3());}return new THREE.Vector3();}
  $('gwAdd').onclick=()=>{try{
    const radius=finite('gwRadius',.002,2),height=finite('gwHeight',.002,4),kind=$('gwPrimitive').value;
    const geo=kind==='sphere'?new THREE.SphereGeometry(radius,20,12):kind==='box'?new THREE.BoxGeometry(radius*2,height,radius*2,4,4,4):new THREE.CylinderGeometry(radius,radius,height,24,4,false);
    add(geo,'GW_'+kind,currentPoint());
  }catch(e){notice(e.message);}};
  $('gwMeshes').onchange=()=>{active=draft.children[Number($('gwMeshes').value)]||null;update();};
  const sliders={X:'x',Y:'y',Z:'z',Scale:'scale'};
  for(const [axis,key] of Object.entries(sliders)){
    const el=$('gwRange'+axis);let started=false;
    const begin=()=>{if(active&&!started){checkpoint();started=true;}};
    el.addEventListener('pointerdown',begin);
    el.addEventListener('input',()=>{if(!active)return;begin();const value=Number(el.value);
      if(key==='scale')active.scale.setScalar(value);else active.position[key]=value;
      $('gw'+axis).value=value.toFixed(4);$('gwValue'+axis).textContent=value.toFixed(3);
    });
    for(const event of ['pointerup','pointercancel','change','blur'])el.addEventListener(event,()=>{started=false;});
  }
  for(const button of document.querySelectorAll('[data-gw-nudge]'))button.addEventListener('click',()=>{
    if(!active)return;const [axis,direction]=button.dataset.gwNudge.split(':');
    const step=finite('gwStep',.0001,.5);checkpoint();active.position[axis]=Math.max(-10,Math.min(10,active.position[axis]+Number(direction)*step));
    update();notice('Draft nudged '+axis.toUpperCase()+' by '+(Number(direction)*step).toFixed(4)+'.');
  });
  $('gwDrag').onclick=()=>{dragEnabled=!dragEnabled;update();notice(dragEnabled?'Drag enabled: touch the draft shape in the viewer and move it. Orbit is paused only while dragging the shape.':'Drag disabled: camera orbit works normally.');};
  if(renderer?.domElement&&camera){
    const canvas=renderer.domElement,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),hitPoint=new THREE.Vector3();
    function setPointer(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1));raycaster.setFromCamera(pointer,camera);}
    const surfaces=[canvas,...(overlay?[overlay]:[])];
    const onDown=e=>{if(!dragEnabled||e.button>0||!draft.children.length)return;
      setPointer(e);const hit=raycaster.intersectObjects(draft.children,false)[0];if(!hit)return;
      active=hit.object;checkpoint();const normal=camera.getWorldDirection(new THREE.Vector3());
      plane.setFromNormalAndCoplanarPoint(normal,hit.point);const offset=active.position.clone().sub(hit.point);
      dragSession={id:e.pointerId,offset,surface:e.currentTarget};e.currentTarget.setPointerCapture(e.pointerId);update();
      e.preventDefault();e.stopImmediatePropagation();
    };
    const onMove=e=>{if(!dragSession||e.pointerId!==dragSession.id)return;
      setPointer(e);if(raycaster.ray.intersectPlane(plane,hitPoint)){
        active.position.copy(hitPoint).add(dragSession.offset);update();
      }
      e.preventDefault();e.stopImmediatePropagation();
    };
    const finish=e=>{if(!dragSession||e.pointerId!==dragSession.id)return;dragSession=null;
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      notice('Draft repositioned by touch. Undo is available.');e.preventDefault();e.stopImmediatePropagation();
    };
    for(const surface of surfaces){surface.addEventListener('pointerdown',onDown,true);surface.addEventListener('pointermove',onMove,true);
      surface.addEventListener('pointerup',finish,true);surface.addEventListener('pointercancel',finish,true);}
  }
  $('gwApply').onclick=()=>{if(!active)return;try{
    const x=finite('gwX',-10,10),y=finite('gwY',-10,10),z=finite('gwZ',-10,10),s=finite('gwScale',.02,20);
    checkpoint();active.position.set(x,y,z);active.scale.setScalar(s);update();notice('Draft mesh transformed. Undo is available.');
  }catch(e){notice(e.message);}};
  $('gwShape').onclick=()=>{if(!active)return;try{
    const radius=finite('gwBrushRadius',.002,2),strength=finite('gwBrushStrength',-.25,.25);
    const hit=getHit();if(!hit?.point)throw Error('Tap a surface in Inspect Select mode first to locate the brush.');
    const center=new THREE.Vector3(...hit.point),geom=active.geometry;
    const pos=geom.getAttribute('position');if(!pos||pos.count>100000)throw Error('This draft mesh is too large for the phone brush.');
    checkpoint();active.updateMatrixWorld(true);
    const localCenter=active.worldToLocal(center.clone());const normal=active.worldToLocal(center.clone().add(new THREE.Vector3(...(hit.normal||[0,1,0])))).sub(localCenter).normalize();
    let count=0;const v=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i);const distance=v.distanceTo(localCenter);if(distance>=radius)continue;
      const t=1-distance/radius,w=t*t*(3-2*t);v.addScaledVector(normal,strength*w);pos.setXYZ(i,v.x,v.y,v.z);count++;
    }
    pos.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingBox();geom.computeBoundingSphere();
    update();notice(count?`Shaped ${count} draft vertices. Check the preview before export.`:'No draft vertices inside the brush radius; move the draft or increase radius.');
  }catch(e){notice(e.message);}};
  function useAnchor(which){const h=getHit();if(!h?.point||!h.mesh){notice('Tap the desired head or body surface in Inspect Select mode first.');return;}
    const anchor={point:new THREE.Vector3(...h.point),meshName:h.mesh.name||'mesh',mesh:h.mesh};
    if(which==='A')anchorA=anchor;else anchorB=anchor;
    update();notice('Bridge anchor '+which+' set on '+anchor.meshName+'.');
  }
  $('gwPickA').onclick=()=>useAnchor('A');$('gwPickB').onclick=()=>useAnchor('B');
  function bridge(a,b,ra,rb){
    const axis=new THREE.Vector3().subVectors(b,a);const len=axis.length();
    if(len<.002||len>3)throw Error('Bridge endpoints must be 0.002–3 units apart.');
    const tangent=new THREE.Vector3(0,1,0);if(Math.abs(axis.clone().normalize().dot(tangent))>.9)tangent.set(1,0,0);
    const u=new THREE.Vector3().crossVectors(axis,tangent).normalize();const v=new THREE.Vector3().crossVectors(axis,u).normalize();
    const n=24,vertices=[],uvs=[],indices=[];
    for(let row=0;row<2;row++){
      for(let k=0;k<=n;k++){
        const ang=k/n*Math.PI*2,c=Math.cos(ang),s=Math.sin(ang),point=(row?b:a).clone().addScaledVector(u,(row?rb:ra)*c).addScaledVector(v,(row?rb:ra)*s);
        vertices.push(point.x,point.y,point.z);uvs.push(k/n,row);
      }
    }
    for(let k=0;k<n;k++){const j=k+n+1;indices.push(k,k+1,j,k+1,j+1,j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  $('gwBridge').onclick=()=>{try{
    if(!anchorA||!anchorB)throw Error('Set both A and B from two Inspect surface taps.');
    if(anchorA.mesh===anchorB.mesh)throw Error('Choose surfaces on two different meshes (such as head and body).');
    const a=finite('gwRingA',.002,1),b=finite('gwRingB',.002,1);
    add(bridge(anchorA.point,anchorB.point,a,b),'GW_bridge_preview',new THREE.Vector3());
    notice('Bridge sleeve preview created. It is NOT welded or skin-weighted; test before animation.');
  }catch(e){notice(e.message);}};
  $('gwDelete').onclick=()=>{if(!active)return;checkpoint();draft.remove(active);active.geometry.dispose();active=null;update();notice('Draft mesh removed; original untouched.');};
  $('gwUndo').onclick=()=>{if(!history.length)return;for(const o of [...draft.children]){draft.remove(o);o.geometry.dispose();}
    const prev=history.pop();for(const o of [...prev.children])draft.add(o);active=draft.children.at(-1)||null;update();notice('Draft undo complete.');};
  $('gwClear').onclick=()=>{if(!draft.children.length)return;checkpoint();for(const o of [...draft.children]){draft.remove(o);o.geometry.dispose();}active=null;update();notice('Draft cleared. Undo can restore it.');};
  async function exportGLB(combined){try{
    if(!draft.children.length)throw Error('Add or bridge geometry first.');
    const output=new THREE.Group();output.name='CoLab_Geometry_Workshop_Candidate';
    if(combined){const original=getOriginal();if(!original)throw Error('Load a GLB into Inspect to export a combined candidate.');
      original.updateMatrixWorld(true);const cloned=cloneSkeleton(original);cloned.name='Preserved_Original';output.add(cloned);}
    const patches=cloneDraft();patches.name='Workshop_Additions';output.add(patches);
    const result=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:false,maxTextureSize:2048});
    const url=URL.createObjectURL(new Blob([result],{type:'model/gltf-binary'}));const link=document.createElement('a');link.href=url;link.download=combined?'CoLab_Geometry_Workshop_COMBINED_CANDIDATE.glb':'CoLab_Geometry_Workshop_PATCH_ONLY.glb';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
    notice('GLB downloaded. Reimport and check geometry, textures, and rig behavior before accepting.');
  }catch(e){notice('Workshop export failed: '+e.message);}}
  $('gwExport').onclick=()=>exportGLB(false);$('gwExportCombined').onclick=()=>exportGLB(true);
  update();
  return {getDraft:()=>draft};
}
