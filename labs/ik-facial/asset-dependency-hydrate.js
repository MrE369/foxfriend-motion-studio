// Materialize only dependencies of the previewed model from indexed ZIP.
import {sourcePath,matchLocalResources} from './gltf-local-intake.js';
const ext=f=>f.name.split('.').at(-1).toLowerCase();
function alias(base,selected,files){
 if(!/_png\.png$/i.test(base))return null;
 const name=base.replace(/_png\.png$/i,'.png'),folder=sourcePath(selected).split('/').slice(0,-1).join('/');
 const candidates=files.filter(f=>f.name===name&&sourcePath(f).split('/').slice(0,-1).join('/')===folder);
 if(candidates.length!==1)return null;
 return candidates[0];
}
export async function hydrateAssetForPreview(main,all){
 if(!main.virtualZip)return {file:main,files:all,warnings:[]};
 const prepared=new Map(),warnings=[];
 async function add(v,rename=null){
  const key=sourcePath(v)+'--'+(rename||'');
  if(prepared.has(key))return prepared.get(key);
  let f=await v.materialize();
  if(rename){
    f=new File([f],rename,{type:f.type});
    Object.defineProperty(f,'relativePath',{value:sourcePath(v).split('/').slice(0,-1).concat(rename).join('/')});
    warnings.push('Restored missing texture filename "'+rename+'" using exact sibling "'+v.name+'"; check appearance.');
  }
  prepared.set(key,f);
  return f;
 }
 const out=[await add(main)];
 if(ext(main)==='gltf'){
  const j=JSON.parse(await main.text());
  const uris=[...(j.buffers||[]),...(j.images||[])].map(o=>o.uri).filter(x=>x&&!/^data:/i.test(x));
  for(const uri of uris){
   let found;
   try{found=matchLocalResources([uri],all,main).get(uri);}
   catch(err){
    const orig=uri.split('/').at(-1),other=alias(orig,main,all);
    if(!other)throw Error(err.message);
    out.push(await add(other,orig));continue;
   }
   if(!found)throw Error('Missing resource '+uri);
   out.push(await add(found));
  }
 }else if(ext(main)==='obj'){
   const src=await main.text();
   const mats=[...src.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm)].map(x=>x[1]);
   for(const m of mats){
    const v=matchLocalResources([m],all,main).get(m);
    out.push(await add(v));
    const text=await v.text();
    for(const line of text.split(/\r?\n/)){
     const match=line.match(/^\s*(?:map_[A-Za-z0-9_]+|bump|disp|decal|norm)\s+(\S+)\s*$/i);
     if(match){const tex=matchLocalResources([match[1]],all,v).get(match[1]);out.push(await add(tex));}
    }
   }
 }else if(ext(main)==='fbx'){
   warnings.push('FBX internal texture links may require additional images; glTF is preferred for complete materials.');
 }
 return {file:out[0],files:[...new Set(out)],warnings};
}
