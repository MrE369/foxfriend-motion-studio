// Local-first glTF 2.0 resolver for CoLab. Sidecar paths survive ZIP/folder intake.
// Never fetch remote/absolute URIs or silently substitute ambiguous textures.
export function sourcePath(file){
 return String(file?.relativePath||file?.webkitRelativePath||file?.name||'').replace(/\\/g,'/').replace(/^\/+/,'');
}
function safeParts(s){
 const path=String(s).replace(/\\/g,'/').replace(/\/+/g,'/');
 const stack=[];
 for(const part of path.split('/')){
   if(!part||part==='.')continue;
   if(part==='..'){if(!stack.length)throw Error('Path escapes asset package: '+s);stack.pop();continue;}
   if(/[\0-\x1f]/.test(part))throw Error('Unsafe file path: '+s);
   stack.push(part);
 }
 return stack.join('/');
}
function uriPath(raw,base=''){
 if(typeof raw!=='string'||!raw)throw Error('Empty resource path.');
 if(/^data:/i.test(raw))return null;
 if(/^[a-z][a-z0-9+.-]*:/i.test(raw)||raw.startsWith('/')||raw.startsWith('//')||raw.includes('?')||raw.includes('#'))
   throw Error('External or absolute resource path blocked: '+raw);
 let dec;
 try{dec=decodeURIComponent(raw);}catch{throw Error('Bad percent encoding in resource path: '+raw);}
 if(dec.startsWith('/')||dec.startsWith('//'))throw Error('Absolute resource path blocked.');
 return safeParts(base+dec);
}
export function inspectLocalAssetSet(files){
 const list=Array.from(files||[]);
 const main=list.filter(f=>/\.(glb|gltf)$/i.test(f.name));
 return {main,companions:list.filter(f=>!main.includes(f))};
}
export function matchLocalResources(uris,files,mainFile){
 const list=Array.from(files||[]),index=new Map(),basenames=new Map();
 for(const f of list){
   const full=safeParts(sourcePath(f));
   if(!full)continue;
   if(index.has(full)&&index.get(full)!==f)throw Error('Duplicate package entry: '+full);
   index.set(full,f);
   const base=full.split('/').at(-1);
   if(!basenames.has(base))basenames.set(base,[]);
   basenames.get(base).push(f);
 }
 const source=sourcePath(mainFile),dir=source.includes('/')?source.slice(0,source.lastIndexOf('/')+1):'';
 const results=new Map();
 for(const raw of uris){
   const resolved=uriPath(raw,dir);
   if(resolved===null)continue;
   let f=index.get(resolved);
   // Normal Android multi-select pickers may discard full paths. A basename
   // fallback is allowed ONLY when unique within the selected set.
   if(!f){
     const basename=resolved.split('/').at(-1),choices=basenames.get(basename)||[];
     if(choices.length===1)f=choices[0];
     if(choices.length>1)throw Error('Ambiguous dependency "'+raw+'": select a folder or ZIP retaining paths.');
   }
   if(!f)throw Error('Missing companion "'+raw+'". Select its BIN/texture with the model, or import the ZIP.');
   results.set(raw,f);
 }
 return results;
}
export function validateGltfManifest(source,files,mainFile){
 let json;
 try{json=JSON.parse(source);}catch{throw Error('Invalid glTF JSON.');}
 if(!/^2\./.test(String(json?.asset?.version||'')))throw Error('Only glTF 2.x is supported.');
 const buffers=(json.buffers||[]),images=(json.images||[]);
 if(buffers.some(x=>!x.uri))throw Error('Binary chunk without URI in .gltf; use GLB for embedded BIN.');
 const uris=[...buffers,...images].map(x=>x.uri).filter(x=>typeof x==='string'&&!/^data:/i.test(x));
 const mapped=matchLocalResources(uris,files,mainFile);
 return {json,mapped,uris};
}
export async function loadLocalGltf(THREE,GLTFLoader,file,allFiles){
 const ext=file.name.split('.').at(-1).toLowerCase();
 if(ext==='glb'){
   const buffer=await file.arrayBuffer();
   if(buffer.byteLength<20)throw Error('GLB too short.');
   const d=new DataView(buffer);
   if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)
    throw Error('Invalid GLB v2 header or length.');
   return {gltf:await new GLTFLoader().parseAsync(buffer,''),resources:[sourcePath(file)]};
 }
 if(ext!=='gltf')throw Error('Expected .gltf or .glb.');
 const source=await file.text(),{mapped}=validateGltfManifest(source,allFiles,file);
 const urls=new Map(),toRevoke=[];
 try{
   for(const [uri,blob] of mapped){const url=URL.createObjectURL(blob);urls.set(uri,url);toRevoke.push(url);}
   const manager=new THREE.LoadingManager();
   let unresolved=null,failures=[];
   manager.onError=url=>failures.push(url);
   manager.setURLModifier(url=>{
     if(/^data:/i.test(url)||/^blob:/i.test(url))return url;
     if(urls.has(url))return urls.get(url);
     // Three's loader may normalize percent escapes before resolving.
     const candidate=[...urls.entries()].find(([k])=>{
       try{return decodeURIComponent(k)===decodeURIComponent(url);}catch{return false;}
     });
     if(candidate)return candidate[1];
     unresolved=url;
     return 'colab-missing-resource://blocked';
   });
   const gltf=await new GLTFLoader(manager).parseAsync(source,'');
   if(unresolved||failures.length)throw Error('Unresolved glTF companion '+(unresolved||failures[0]));
   return {gltf,resources:[sourcePath(file),...new Set([...mapped.values()].map(sourcePath))]};
 }finally{
   // Images are normally decoded before parseAsync completes. Revoke on a
   // microtask to avoid immediate invalidation of just-resolved blob URLs.
   await Promise.resolve();
   toRevoke.forEach(url=>URL.revokeObjectURL(url));
 }
}
