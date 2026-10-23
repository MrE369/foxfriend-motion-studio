// CoLab Universal Import — deterministic ZIP safety preflight (no extraction until approved).
// Reject ZIP64, encryption, symlinks, traversal, duplicates, bombs and massive entries.
export const LIMITS=Object.freeze({archiveBytes:115*1024*1024,entries:1400,entryBytes:65*1024*1024,totalBytes:185*1024*1024,ratio:180});
const rd=(dv,at,size)=>{if(at<0||at+size>dv.byteLength)throw Error('Truncated ZIP central directory.');return size===2?dv.getUint16(at,true):dv.getUint32(at,true);};
export function normalizeArchivePath(name){
 if(!name||name.startsWith('/')||name.startsWith('\\')||/^[a-zA-Z]:/.test(name)||name.includes('\0'))
  throw Error('Unsafe ZIP entry path: '+name);
 const raw=name.replace(/\\/g,'/');
 const parts=raw.split('/').filter(Boolean);
 if(parts.includes('..')||parts.includes('.')||parts.some(x=>/[\x00-\x1f]/.test(x)))
  throw Error('ZIP traversal/unsafe path blocked: '+name);
 return parts.join('/');
}
export function inspectZipBytes(bytes,limits=LIMITS){
 const a=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(a.byteLength>limits.archiveBytes)throw Error('ZIP too large for mobile safe import.');
 const dv=new DataView(a.buffer,a.byteOffset,a.byteLength);
 let eocd=-1;
 for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--){
   if(rd(dv,i,4)===0x06054b50&&i+22+rd(dv,i+20,2)===a.length){eocd=i;break;}
 }
 if(eocd<0)throw Error('ZIP central directory not found (or unsupported split archive).');
 const disk=rd(dv,eocd+4,2),centralDisk=rd(dv,eocd+6,2),onDisk=rd(dv,eocd+8,2);
 const count=rd(dv,eocd+10,2),centralSize=rd(dv,eocd+12,4),centralOffset=rd(dv,eocd+16,4);
 if(disk||centralDisk||onDisk!==count)throw Error('Multi-volume ZIP not supported.');
 if(count===65535||centralSize===0xffffffff||centralOffset===0xffffffff)throw Error('ZIP64 not supported in browser.');
 if(count>limits.entries)throw Error('Archive contains too many files for this phone.');
 if(centralOffset+centralSize>eocd)throw Error('Invalid ZIP central-directory bounds.');
 let at=centralOffset,total=0;const names=new Set(),entries=[];
 const decode=new TextDecoder('utf-8',{fatal:false});
 for(let i=0;i<count;i++){
   if(rd(dv,at,4)!==0x02014b50)throw Error('Invalid ZIP central-directory entry '+i);
   const flags=rd(dv,at+8,2),method=rd(dv,at+10,2),packed=rd(dv,at+20,4),unpacked=rd(dv,at+24,4);
   const n=rd(dv,at+28,2),extra=rd(dv,at+30,2),comment=rd(dv,at+32,2);
   if(flags&1||flags&64)throw Error('Encrypted ZIP entries are not supported.');
   if(method!==0&&method!==8)throw Error('Unsupported ZIP compression method '+method+'.');
   if(packed===0xffffffff||unpacked===0xffffffff)throw Error('ZIP64 entry not supported.');
   if(at+46+n+extra+comment>centralOffset+centralSize)throw Error('Malformed ZIP directory entry.');
   const raw=decode.decode(a.subarray(at+46,at+46+n)),name=normalizeArchivePath(raw);
   if(!name)throw Error('Empty ZIP entry path.');
   const isFolder=/\/$/.test(raw);
   const mode=(rd(dv,at+38,4)>>>16)&0xffff;
   if((mode&0xf000)===0xa000)throw Error('ZIP symlink entries are blocked.');
   const unique=name.toLowerCase();
   if(names.has(unique))throw Error('Duplicate ZIP entry path (case-insensitive): '+name);
   names.add(unique);
   if(!isFolder){
     if(unpacked>limits.entryBytes)throw Error('Oversized ZIP entry: '+name);
     if(packed===0&&unpacked>0||packed>0&&unpacked/packed>limits.ratio)throw Error('High decompression ratio blocked: '+name);
     total+=unpacked;
     if(total>limits.totalBytes)throw Error('ZIP expands beyond safe memory limit.');
     entries.push({name,compressedBytes:packed,bytes:unpacked,method});
   }
   at+=46+n+extra+comment;
 }
 if(at!==centralOffset+centralSize)throw Error('Unexpected ZIP central-directory padding.');
 return {entries,compressedBytes:a.length,uncompressedBytes:total};
}
export async function unpackZipFile(zip,progress){
 const bytes=new Uint8Array(await zip.arrayBuffer());
 const manifest=inspectZipBytes(bytes);progress?.('Validated '+manifest.entries.length+' entries. Extracting locally…');
 const {unzipSync}=await import('fflate');
 let contents;
 try{contents=unzipSync(bytes);}catch(e){throw Error('Could not decompress archive: '+e.message);}
 const result=[];
 for(const {name,bytes:size} of manifest.entries){
   const content=contents[name];
   if(!content||content.byteLength!==size)throw Error('ZIP entry length mismatch: '+name);
   const base=name.split('/').at(-1);
   const ext=base.split('.').at(-1).toLowerCase();
   const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',
     gltf:'model/gltf+json',glb:'model/gltf-binary',obj:'text/plain',mtl:'text/plain',
     bin:'application/octet-stream',fbx:'application/octet-stream'};
   const file=new File([content],base,{type:types[ext]||'application/octet-stream'});
   Object.defineProperty(file,'relativePath',{value:name});
   result.push(file);
 }
 return {files:result,manifest};
}
