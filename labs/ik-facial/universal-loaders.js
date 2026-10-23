// CoLab supported format adapters. All models become {root,clips,resources,format,warnings}.
// Unsupported native Blender remains explicit. No remote asset fetch permitted.
import {loadLocalGltf,matchLocalResources,sourcePath} from './gltf-local-intake.js';
const extension=name=>String(name||'').split('.').at(-1).toLowerCase();
export function classifyAsset(file){
 const ext=extension(file?.name),types={
  glb:'model',gltf:'model',fbx:'model',obj:'model',blend:'needs-blender',
  png:'image',jpg:'image',jpeg:'image',webp:'image',
  mtl:'companion',bin:'companion'
 };
 return types[ext]||'unrecognized';
}
export function scanOBJDependencies(source,files,mainFile){
 const libs=[...source.matchAll(/^\s*mtllib\s+([^\r\n#]+)/gm)].map(x=>x[1].trim());
 const all=[];
 for(const lib of libs){all.push(lib);}
 return {libs,found:matchLocalResources(all,files,mainFile)};
}
export function scanMTLTextures(source,files,mainFile){
 const names=[];
 for(const line of source.split(/\r?\n/)){
  const match=line.match(/^\s*(?:map_[A-Za-z0-9_]+|bump|disp|decal|norm)\s+(.+?)\s*$/i);
  if(!match)continue;
  // MTL map flags have arguments. The last filename token is a conservative
  // supported case; paths with spaces should be embedded in GLB instead.
  let name=match[1].trim();
  if(name.startsWith('-'))name=name.split(/\s+/).at(-1);
  names.push(name);
 }
 return matchLocalResources(names,files,mainFile);
}
function createSidecarManager(THREE,files){
 const urls=new Map(),errors=[];
 const byName=new Map();
 for(const f of files){
  const name=sourcePath(f);
  for(const key of [name,f.name]){
   if(!byName.has(key))byName.set(key,[]);
   byName.get(key).push(f);
  }
 }
 const manager=new THREE.LoadingManager();
 manager.setURLModifier(raw=>{
  if(/^data:/i.test(raw)||/^blob:/i.test(raw))return raw;
  const clean=decodeURIComponent(raw.replace(/\\/g,'/'));
  let hits=byName.get(clean)||[];
  if(!hits.length)hits=byName.get(clean.split('/').at(-1))||[];
  hits=[...new Set(hits)];
  if(hits.length!==1){errors.push('Missing/ambiguous external resource: '+raw);return 'colab-missing-resource://blocked';}
  const f=hits[0];
  if(!urls.has(f))urls.set(f,URL.createObjectURL(f));
  return urls.get(f);
 });
 manager.onError=url=>errors.push('Texture load failed: '+url);
 return {manager,errors,release:()=>{for(const url of urls.values())URL.revokeObjectURL(url);}};
}
export async function loadPreparedAsset({THREE,GLTFLoader,FBXLoader,OBJLoader,MTLLoader,file,files}){
 const ext=extension(file.name),format=ext.toUpperCase(),warnings=[];
 if(ext==='blend')throw Error('BLEND requires a configured headless Blender worker. No backend is connected; nothing was uploaded.');
 if(ext==='bin'||ext==='mtl')throw Error(ext.toUpperCase()+' is a dependency, not a standalone scene.');
 if(['png','jpg','jpeg','webp'].includes(ext))
  return {kind:'image',file,format:'IMAGE',resources:[sourcePath(file)],warnings};
 if(ext==='glb'||ext==='gltf'){
  const {gltf,resources}=await loadLocalGltf(THREE,GLTFLoader,file,files);
  return {kind:'model',root:gltf.scene,clips:gltf.animations||[],format,resources,warnings};
 }
 if(ext==='fbx'){
  const ctx=createSidecarManager(THREE,files);
  try{
   const root=new FBXLoader(ctx.manager).parse(await file.arrayBuffer(),'');
   warnings.push('FBXLoader support varies by FBX version; external textures and bind poses require verification.');
   if(ctx.errors.length)warnings.push(...ctx.errors);
   const resources=[sourcePath(file),...files.filter(f=>f!==file&&/\.(png|jpe?g|webp)$/i.test(f.name)).map(sourcePath)];
   return {kind:'model',root,clips:root.animations||[],resources,warnings,format,release:ctx.release};
  }catch(e){ctx.release();throw Error('FBX import failed: '+e.message);}
 }
 if(ext==='obj'){
  const ctx=createSidecarManager(THREE,files);
  try{
   const source=await file.text(),deps=scanOBJDependencies(source,files,file);
   if(deps.libs.length>1)throw Error('This OBJ references multiple MTL files; split the model or convert to GLB.');
   const loader=new OBJLoader(ctx.manager);
   const resources=[sourcePath(file)];
   if(deps.libs.length){
    const mtlFile=deps.found.get(deps.libs[0]);
    const mapped=scanMTLTextures(await mtlFile.text(),files,mtlFile);
    resources.push(sourcePath(mtlFile),...[...mapped.values()].map(sourcePath));
    const mats=new MTLLoader(ctx.manager).parse(await mtlFile.text(),'');
    mats.preload();loader.setMaterials(mats);
   }else warnings.push('No MTL supplied; material colors may use defaults.');
   const root=loader.parse(source);
   warnings.push('OBJ is static; skeletons and animation are not supported.');
   if(ctx.errors.length)warnings.push(...ctx.errors);
   return {kind:'model',root,clips:[],format,resources:[...new Set(resources)],warnings,release:ctx.release};
  }catch(e){ctx.release();throw Error('OBJ import failed: '+e.message);}
 }
 throw Error('Unsupported asset format .'+ext+'. Choose GLB, glTF, FBX, OBJ, image, or ZIP package.');
}
