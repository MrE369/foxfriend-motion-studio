// GLB export roundtrip audit. Comparison is structural, not a visual quality claim.
export function summarizeScene(root,clips=[]){
 const meshes=[],bones=[],materials=new Set(),maps=new Set();
 root.traverse(o=>{
  if(o.isBone)bones.push(o.name||'');
  if(!o.isMesh)return;
  const g=o.geometry,pos=g?.getAttribute('position');
  const tris=g?.index?Math.floor(g.index.count/3):Math.floor((pos?.count||0)/3);
  meshes.push({name:o.name||'',tris,skinned:!!o.isSkinnedMesh,uv:!!g?.getAttribute('uv'),morphs:Object.keys(g?.morphAttributes||{}).length});
  for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){
   materials.add(m);
   for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])if(m[k])maps.add(m[k]);
  }
 });
 return {meshCount:meshes.length,triangles:meshes.reduce((n,m)=>n+m.tris,0),boneCount:bones.length,skinnedMeshes:meshes.filter(m=>m.skinned).length,materials:materials.size,textures:maps.size,clipCount:clips.length,trackCount:clips.reduce((n,c)=>n+(c.tracks?.length||0),0),meshes};
}
export function compareExportAudit(before,after){
 const fields=['meshCount','triangles','boneCount','skinnedMeshes','clipCount','trackCount'];
 const errors=[],warnings=[];
 for(const key of fields)if(before[key]!==after[key])errors.push(key+': before '+before[key]+', after '+after[key]);
 if(before.materials!==after.materials)warnings.push('Material count changed: '+before.materials+' → '+after.materials);
 if(before.textures!==after.textures)warnings.push('Texture map count changed: '+before.textures+' → '+after.textures);
 return {ok:errors.length===0,errors,warnings,before,after};
}
export async function validateExport(THREE,GLTFLoader,originalRoot,clips,bytes){
 const before=summarizeScene(originalRoot,clips),gltf=await new GLTFLoader().parseAsync(bytes,'');
 const after=summarizeScene(gltf.scene,gltf.animations||[]);
 return compareExportAudit(before,after);
}
