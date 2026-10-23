// CoLab CW-01: local-only glTF 2.0 intake for GLB and .gltf + sidecar files.
// No ZIP extraction, remote URL fetching, FBX parsing or network access.
// Supply the .gltf and its .bin/image files together, or a standalone .glb.
export function inspectLocalAssetSet(files){
 const supplied=Array.from(files||[]);
 const main=supplied.filter(f=>/\.(glb|gltf)$/i.test(f.name));
 return {main,companions:supplied.filter(f=>!main.includes(f))};
}
function pathKey(s){return decodeURIComponent(String(s).replace(/\\/g,'/')).replace(/^(\.\/)+/,'').replace(/\/+/g,'/');}
export function matchLocalResources(uris, files){
 const list=Array.from(files||[]);const results=new Map();
 const unique=new Map(), collisions=new Set();
 for(const file of list){
   const candidates=[file.webkitRelativePath,file.name].filter(Boolean).map(pathKey);
   for(const key of candidates){
     if(unique.has(key)&&unique.get(key)!==file)collisions.add(key);
     else unique.set(key,file);
   }
 }
 for(const raw of uris){
   if(typeof raw!=='string'||!raw)throw Error('Invalid resource path in glTF.');
   if(/^data:/i.test(raw))continue;
   if(/^[a-z][\w+.-]*:/i.test(raw)||raw.startsWith('//')||raw.startsWith('/')||raw.includes('?')||raw.includes('#'))
     throw Error('External URLs and absolute paths are blocked: '+raw);
   const key=pathKey(raw);const pieces=key.split('/');
   if(pieces.includes('..')||pieces.includes('.'))throw Error('Unsafe relative path: '+raw);
   if(collisions.has(key))throw Error('Ambiguous companion file: '+key);
   let file=unique.get(key);
   if(!file){
     const basename=pieces.at(-1);
     const candidates=list.filter(x=>x.name===basename);
     if(candidates.length===1)file=candidates[0];
     else if(candidates.length>1)throw Error('Multiple companion files named '+basename+'. Pick one model at a time.');
   }
   if(!file)throw Error('Missing '+raw+'. Select the glTF together with its .bin/textures.');
   results.set(raw,file);
 }
 return results;
}
export function validateGltfManifest(text,files){
 let json;
 try{json=JSON.parse(text);}catch{throw Error('Invalid .gltf JSON file.');}
 if(!json?.asset?.version||!String(json.asset.version).startsWith('2.'))throw Error('Only glTF 2.x is supported.');
 const uris=[...(json.buffers||[]).map(x=>x.uri),...(json.images||[]).map(x=>x.uri)].filter(x=>typeof x==='string'&&!/^data:/i.test(x));
 const mapped=matchLocalResources(uris,files);
 return {json,mapped,uris};
}
export async function loadLocalGltf(THREE,GLTFLoader,file,allFiles){
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='glb'){
   const buffer=await file.arrayBuffer(),d=new DataView(buffer);
   if(buffer.byteLength<20||d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)
     throw Error('Invalid GLB binary header.');
   const gltf=await new GLTFLoader().parseAsync(buffer,'');
   return {gltf,resources:[file.name]};
 }
 if(ext!=='gltf')throw Error('Only .glb and .gltf are supported.');
 const source=await file.text();
 const {mapped}=validateGltfManifest(source,allFiles);
 const urls=new Map(),references=[];
 try{
   for(const [uri,blob] of mapped){
     const url=URL.createObjectURL(blob);
     urls.set(uri,url);references.push(url);
   }
   const manager=new THREE.LoadingManager();
   manager.setURLModifier(u=>{
     if(/^data:/i.test(u)||/^blob:/i.test(u))return u;
     const clean=pathKey(u);
     // GLTFLoader can pass a relative prefix to the LoadingManager.
     for(const [uri,url] of urls){if(clean===pathKey(uri)||clean.endsWith('/'+pathKey(uri)))return url;}
     // Never let an unresolved companion fetch from the network.
     return 'colab-missing-resource://not-found';
   });
   const loader=new GLTFLoader(manager);
   const gltf=await loader.parseAsync(source,'');
   return {gltf,resources:[file.name,...new Set([...mapped.values()].map(f=>f.name))]};
 }finally{
   // glTFLoader resolves its buffers and image resources before parseAsync returns.
   for(const url of references)URL.revokeObjectURL(url);
 }
}
