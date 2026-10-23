/**
 * Anatomy Sculpt S-02 — reproducible geometric body variation for upright,
 * Y-up, static humanoid meshes. Exactly matches the Python lab's Gaussian
 * deformation principles; no bone scaling, no source file changes.
 *
 * x = lateral, y = height, z = depth. Validated strength ±12%. The operation
 * changes positions only; normals must be recomputed by the caller. The mesh
 * retains vertex order, indices, UVs, morphs and skin-weight attributes.
 * Rigged models are intentionally disabled in the current CoLab UI.
 */
const gaussian=(x,center,sigma)=>Math.exp(-.5*((x-center)/sigma)**2);
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const PRESETS={
  original:{shoulders:0,waist:0,chest:0},
  athletic:{shoulders:.065,waist:-.035,chest:.035},
  lean:{shoulders:-.025,waist:-.07,chest:-.012},
  heroic:{shoulders:.10,waist:-.025,chest:.055}
};
export function presets(){return JSON.parse(JSON.stringify(PRESETS));}
export function sculptBodyPositions(source,parameters={}) {
  if(!(source instanceof Float32Array)||source.length<9||source.length%3!==0)
    throw Error('Expected a Float32Array of 3D vertex positions.');
  const p={shoulders:0,waist:0,chest:0,...parameters};
  for(const [key,value] of Object.entries(p))
    if(!['shoulders','waist','chest'].includes(key)||typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>.12)
      throw Error('Invalid body sculpt parameter '+key+' (use ±0.12).');
  let ymin=Infinity,ymax=-Infinity,xmin=Infinity,xmax=-Infinity;
  const xs=[];
  for(let i=0;i<source.length;i+=3){
    const x=source[i],y=source[i+1],z=source[i+2];
    if(![x,y,z].every(Number.isFinite))throw Error('Non-finite position at vertex '+i/3);
    ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);xs.push(x);
  }
  const height=ymax-ymin,width=xmax-xmin;
  if(height<.05||height<width*1.25||height>30)throw Error('Select an upright, reasonably proportioned full body (Y-up). This preset is not for a face, prop, or tilted mesh.');
  xs.sort((a,b)=>a-b);const cx=xs[Math.floor(xs.length/2)];
  const zs=[];for(let i=2;i<source.length;i+=3)zs.push(source[i]);
  zs.sort((a,b)=>a-b);const cz=zs[Math.floor(zs.length/2)];
  const out=new Float32Array(source.length);
  let changed=0,max=0,total=0;
  for(let i=0;i<source.length;i+=3){
    const dx=source[i]-cx,dz=source[i+2]-cz,t=(source[i+1]-ymin)/height;
    const shoulder=gaussian(t,.815,.073)*smoothstep(.035,.16,Math.abs(dx));
    const waist=gaussian(t,.575,.070)*smoothstep(.015,.095,Math.abs(dx));
    const chest=gaussian(t,.720,.078)*smoothstep(.01,.065,Math.abs(dz));
    const x=cx+dx*(1+p.shoulders*shoulder+p.waist*waist);
    const z=cz+dz*(1+p.chest*chest);
    out[i]=x;out[i+1]=source[i+1];out[i+2]=z;
    const displacement=Math.hypot(x-source[i],z-source[i+2]);
    if(displacement>0.00001)changed++;
    max=Math.max(max,displacement);total+=displacement;
  }
  return {positions:out,changed,maxDisplacement:max,meanDisplacement:total/(source.length/3),height,width,parameters:p};
}
export function checkBodySculpt(source,edited,index){
 if(source.length!==edited.length)throw Error('Vertex count changed.');
 const at=k=>[source[k*3],source[k*3+1],source[k*3+2]];
 const after=k=>[edited[k*3],edited[k*3+1],edited[k*3+2]];
 const cross=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const count=index?index.count:source.length/3,ix=j=>index?index.getX(j):j;
 if(count%3)throw Error('Mesh index count must be triangles.');
 let flips=0,degenerate=0,maxStretch=1,minStretch=1;
 for(let j=0;j<count;j+=3){
  const ids=[ix(j),ix(j+1),ix(j+2)];
  if(ids.some(k=>k<0||k>=source.length/3))throw Error('Invalid triangle index.');
  const a=ids.map(at),b=ids.map(after),n0=cross(...a),n1=cross(...b);
  if(dot(n1,n1)<1e-18)degenerate++;
  if(dot(n0,n1)<=0)flips++;
  for(let e=0;e<3;e++){
    const l0=dist(a[e],a[(e+1)%3]),l1=dist(b[e],b[(e+1)%3]);
    if(l0>1e-10){const ratio=l1/l0;maxStretch=Math.max(maxStretch,ratio);minStretch=Math.min(minStretch,ratio);}
  }
 }
 const passed=flips===0&&degenerate===0&&maxStretch<1.26&&minStretch>.80;
 return {passed,flips,degenerate,maxStretch,minStretch,triangles:count/3,
   message:passed?'Topology-preserving deformation passed structural checks.':'Potentially unsafe triangle orientation/edge strain. Sculpt not applied.'};
}
