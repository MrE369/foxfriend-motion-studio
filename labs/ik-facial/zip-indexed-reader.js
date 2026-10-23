// Indexed ZIP reading: keeps large free Quaternius packs on the File handle.
// Decompresses only explicitly requested entries; no full-archive unzip.
// No ZIP64, split, encrypted, symlink or traversal extraction.
import {normalizeArchivePath} from './zip-safe-import.js';
const MAX_ZIP_BYTES=410*1024*1024,MAX_ENTRIES=3000,MAX_ONE=65*1024*1024,MAX_TOTAL=720*1024*1024;
const uint=(dv,p,n)=>n===2?dv.getUint16(p,true):dv.getUint32(p,true);
export async function openIndexedZip(zip){
 if(zip.size>MAX_ZIP_BYTES)throw Error('ZIP over 410 MB compressed limit. Split your archive.');
 if(zip.size<22)throw Error('Not a valid ZIP.');
 const tailStart=Math.max(0,zip.size-65557),tail=new Uint8Array(await zip.slice(tailStart).arrayBuffer());
 const t=new DataView(tail.buffer,tail.byteOffset,tail.byteLength);
 let ep=-1;
 for(let i=tail.length-22;i>=0;i--){
  if(uint(t,i,4)===0x06054b50&&i+22+uint(t,i+20,2)===tail.length){ep=i;break;}
 }
 if(ep<0)throw Error('ZIP central directory missing or unsupported file comment.');
 const count=uint(t,ep+10,2),size=uint(t,ep+12,4),offset=uint(t,ep+16,4);
 if(uint(t,ep+4,2)||uint(t,ep+6,2)||uint(t,ep+8,2)!==count)throw Error('Split ZIP unsupported.');
 if(count===65535||size===0xffffffff||offset===0xffffffff)throw Error('ZIP64 unsupported.');
 if(count>MAX_ENTRIES||size>8*1024*1024)throw Error('Too many ZIP entries for safe cataloguing.');
 if(offset+size>tailStart+ep)throw Error('ZIP central directory outside archive.');
 const data=new Uint8Array(await zip.slice(offset,offset+size).arrayBuffer());
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const dec=new TextDecoder('utf-8'),items=[],names=new Set();let at=0,total=0;
 for(let i=0;i<count;i++){
  if(at+46>data.length||uint(view,at,4)!==0x02014b50)throw Error('Corrupt ZIP directory.');
  const flag=uint(view,at+8,2),method=uint(view,at+10,2),crc=uint(view,at+16,4);
  const packed=uint(view,at+20,4),raw=uint(view,at+24,4),n=uint(view,at+28,2);
  const ex=uint(view,at+30,2),comment=uint(view,at+32,2);
  const local=uint(view,at+42,4),mode=(uint(view,at+38,4)>>>16)&0xffff;
  if(at+46+n+ex+comment>data.length)throw Error('Truncated ZIP entry.');
  const path=normalizeArchivePath(dec.decode(data.subarray(at+46,at+46+n)));
  if(!path||names.has(path.toLowerCase()))throw Error('Missing or duplicate ZIP path: '+path);
  names.add(path.toLowerCase());
  if(flag&1||flag&64)throw Error('Encrypted ZIP entries unsupported.');
  if(method!==0&&method!==8)throw Error('Unsupported compression method '+method+'.');
  if((mode&0xf000)===0xa000)throw Error('Unsafe symlink in ZIP.');
  if(packed===0xffffffff||raw===0xffffffff||local===0xffffffff)throw Error('ZIP64 entries unsupported.');
  if(raw>MAX_ONE)throw Error('Entry over 65 MB: '+path);
  if(raw&&(!packed||raw/packed>200))throw Error('Suspicious ZIP compression ratio: '+path);
  if(local>=offset)throw Error('Entry data offset invalid: '+path);
  total+=raw;if(total>MAX_TOTAL)throw Error('ZIP total expanded size over 720 MB.');
  if(!/\/$/.test(dec.decode(data.subarray(at+46,at+46+n))))
   items.push({name:path,packed,raw,method,crc,local});
  at+=46+n+ex+comment;
 }
 if(at!==data.length)throw Error('ZIP central directory length mismatch.');
 async function extract(item){
  const header=new DataView(await zip.slice(item.local,item.local+30).arrayBuffer());
  if(header.byteLength!==30||uint(header,0,4)!==0x04034b50)throw Error('Invalid local ZIP header: '+item.name);
  const length=uint(header,26,2),extra=uint(header,28,2),start=item.local+30+length+extra;
  if(start+item.packed>offset)throw Error('Overlapping ZIP entry: '+item.name);
  const bytes=new Uint8Array(await zip.slice(start,start+item.packed).arrayBuffer());
  let result;
  if(item.method===0)result=bytes;
  else {
    const {inflateSync}=await import('fflate');
    try{result=inflateSync(bytes,{out:new Uint8Array(item.raw)});}catch(e){throw Error('ZIP inflate failed for '+item.name+': '+e.message);}
  }
  if(result.length!==item.raw)throw Error('ZIP expanded size mismatch: '+item.name);
  if(checksum(result)!==item.crc)throw Error('ZIP CRC mismatch: '+item.name);
  return result;
 }
 const files=items.map(item=>{
  const basename=item.name.split('/').at(-1),file={
   name:basename,relativePath:item.name,size:item.raw,virtualZip:true,
   async arrayBuffer(){const a=await extract(item);return a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);},
   async text(){return new TextDecoder().decode(await extract(item));},
   async materialize(){
    const data=await extract(item),ext=basename.split('.').at(-1).toLowerCase();
    const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gltf:'model/gltf+json',glb:'model/gltf-binary',mtl:'text/plain',obj:'text/plain'}[ext]||'application/octet-stream';
    const blob=new File([data],basename,{type:mime});
    Object.defineProperty(blob,'relativePath',{value:item.name});
    return blob;
   }
  };return file;
 });
 return {files,manifest:{entries:items.length,compressedBytes:zip.size,uncompressedBytes:total,indexed:true}};
}
// Standard CRC32. Used after decompression to catch corrupted archives.
let crcTable;
function checksum(data){
 if(!crcTable){crcTable=Uint32Array.from({length:256},(_,n)=>{
  for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});}
 let crc=0xffffffff;for(const x of data)crc=crcTable[(crc^x)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
