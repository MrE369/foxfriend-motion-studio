// CoLab headless paint UV preflight. Conservative *sampled* detector, not a
// proof of UV uniqueness. Cells with different 3D positions sharing UV are
// flagged, so an AI recipe that reaches them is never auto-approved.
export function createUVOverlapInspector(){
 const cache=new WeakMap(),SIZE=112,MAX_TRIANGLES=250000;
 function pointInPoly(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 }
 function inspect(mesh){
  const geometry=mesh?.geometry;
  if(!geometry?.attributes?.uv||!geometry?.attributes?.position)return {error:'This mesh has no UV coordinates.'};
  if(cache.has(geometry))return cache.get(geometry);
  const uv=geometry.attributes.uv,position=geometry.attributes.position,index=geometry.index;
  const faceCount=Math.floor((index?index.count:position.count)/3);
  if(faceCount>MAX_TRIANGLES)return {error:'Mesh too dense for UV conflict preflight ('+faceCount.toLocaleString()+' triangles). Refusing automated fill.'};
  const N=SIZE*SIZE,seen=new Uint8Array(N),conflicts=new Uint8Array(N),stored=new Float32Array(N*3);
  let processed=0,invalid=0;
  // A fixed absolute epsilon plus scale-relative distance avoids false
  // positives caused by the same surface having duplicated seam vertices.
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let j=0;j<position.count;j++){
   const x=position.getX(j),y=position.getY(j),z=position.getZ(j);
   if(x<minX)minX=x;if(x>maxX)maxX=x;
   if(y<minY)minY=y;if(y>maxY)maxY=y;
   if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;
  }
  const diag=Math.hypot(maxX-minX,maxY-minY,maxZ-minZ);
  const threshold=Math.max(0.001,diag*0.007);
  for(let t=0;t<faceCount;t++){
   const n=t*3;
   const indices=index?[index.getX(n),index.getX(n+1),index.getX(n+2)]:[n,n+1,n+2];
   const a=[uv.getX(indices[0]),uv.getY(indices[0])],b=[uv.getX(indices[1]),uv.getY(indices[1])],c=[uv.getX(indices[2]),uv.getY(indices[2])];
   if([...a,...b,...c].some(x=>!Number.isFinite(x))){invalid++;continue}
   const denom=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
   if(Math.abs(denom)<1e-12)continue;
   const lx=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])*SIZE-0.5)),
     hx=Math.min(SIZE-1,Math.floor(Math.max(a[0],b[0],c[0])*SIZE-0.5)),
     ly=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])*SIZE-0.5)),
     hy=Math.min(SIZE-1,Math.floor(Math.max(a[1],b[1],c[1])*SIZE-0.5));
   if(lx>hx||ly>hy)continue;
   for(let iy=ly;iy<=hy;iy++)for(let ix=lx;ix<=hx;ix++){
    const u=(ix+0.5)/SIZE,v=(iy+0.5)/SIZE;
    const wa=((b[1]-c[1])*(u-c[0])+(c[0]-b[0])*(v-c[1]))/denom;
    const wb=((c[1]-a[1])*(u-c[0])+(a[0]-c[0])*(v-c[1]))/denom;
    const wc=1-wa-wb;
    if(Math.min(wa,wb,wc)<-0.00001||Math.max(wa,wb,wc)>1.00001)continue;
    const xyz=[0,1,2].map(axis=>{
     const get=axis===0?i=>position.getX(i):axis===1?i=>position.getY(i):i=>position.getZ(i);
     return wa*get(indices[0])+wb*get(indices[1])+wc*get(indices[2]);
    });
    const cell=iy*SIZE+ix,k=cell*3;
    if(!seen[cell]){seen[cell]=1;stored[k]=xyz[0];stored[k+1]=xyz[1];stored[k+2]=xyz[2];}
    else if(Math.hypot(stored[k]-xyz[0],stored[k+1]-xyz[1],stored[k+2]-xyz[2])>threshold)conflicts[cell]=1;
    processed++;
   }
  }
  const total=conflicts.reduce((a,b)=>a+b,0);
  const result={size:SIZE,faceCount,sampledCells:seen.reduce((a,b)=>a+b,0),
   overlappingCells:total,invalidUvTriangles:invalid,conflicts};
  cache.set(geometry,result);return result;
 }
 function analyze(mesh,shapes){
  const info=inspect(mesh);
  if(info.error)return {blocked:true,reason:info.error,sampled:true};
  const unsafe=[];
  for(let k=0;k<shapes.length;k++){
   const sh=shapes[k];
   if(!sh.points||sh.points.length<3){unsafe.push({form:k+1,count:0,reason:'Malformed polygon'});continue}
   const minX=Math.max(0,Math.floor(Math.min(...sh.points.map(p=>p[0]))*SIZE)),
    maxX=Math.min(SIZE-1,Math.ceil(Math.max(...sh.points.map(p=>p[0]))*SIZE)),
    minY=Math.max(0,Math.floor(Math.min(...sh.points.map(p=>p[1]))*SIZE)),
    maxY=Math.min(SIZE-1,Math.ceil(Math.max(...sh.points.map(p=>p[1]))*SIZE));
   let collisions=0;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)
    if(info.conflicts[y*SIZE+x]&&pointInPoly((x+.5)/SIZE,(y+.5)/SIZE,sh.points))collisions++;
   if(collisions)unsafe.push({form:k+1,count:collisions,reason:'Shared UV pixels map to different 3D surfaces'});
  }
  const blocked=unsafe.length>0||info.invalidUvTriangles>0;
  return {blocked,sampled:true,reason:blocked?'Detected overlapping UV regions or invalid coordinates in the target mesh.':null,
   totalMeshOverlaps:info.overlappingCells,selectedFormOverlaps:unsafe,
   invalidUvTriangles:info.invalidUvTriangles,sampledCells:info.sampledCells,faceCount:info.faceCount,
   warning:'Grid sampling can MISS narrow or unusual UV overlaps. A clear report is not proof of isolated paint; inspect the model before and after applying.'};
 }
 return {inspect,analyze};
}
