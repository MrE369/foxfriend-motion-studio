/* S-04 guarded rig-aware torso shape experiment.
 * This does NOT reskin/rebind: changes only positions of Superhero_Female mesh.
 * Skeleton and JOINTS_0/WEIGHTS_0 are retained, and source geometry untouched.
 * Only the exact CC0 Quaternius female Superhero rig has been offline pose-audited.
 */
export const FEMALE_S04={shoulder:.0325,waist:-.0225,chest:.0175,steps:6};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function riggedFemalePreview(mesh,intensity=1){
 if(!finite(intensity)||intensity<0||intensity>1)throw Error('Intensity must be between 0 and 1.');
 if(!mesh?.isSkinnedMesh||!mesh?.skeleton)throw Error('S-04 requires a skinned Superhero Female mesh.');
 const bones=mesh.skeleton.bones||[],names=bones.map(x=>x.name);
 const required=['root','pelvis','spine_01','spine_02','spine_03','clavicle_l','clavicle_r','upperarm_l','upperarm_r'];
 if(bones.length!==65||required.some(n=>!names.includes(n)))throw Error('Not the tested 65-joint Quaternius skeleton.');
 if(mesh.name!=='Superhero_Female')throw Error('Choose the Quaternius Superhero_Female main body.');
 const g=mesh.geometry,pos=g?.getAttribute('position'),joint=g?.getAttribute('skinIndex'),weight=g?.getAttribute('skinWeight'),index=g?.index;
 if(!pos||pos.itemSize!==3||pos.count!==7376||!joint||!weight||!index)throw Error('Unrecognized body topology or missing skinning.');
 if(g.morphAttributes?.position?.length)throw Error('Morph-target body not supported by S-04.');
 const coords=Float32Array.from(pos.array),N=pos.count;
 if(coords.length!==N*3)throw Error('Only non-interleaved position buffers are supported.');
 const skin=Array.from({length:N},()=>0),boneFactor=new Map([
 ['pelvis',.35],['spine_01',1],['spine_02',1],['spine_03',1],
 ['clavicle_l',.7],['clavicle_r',.7],['upperarm_l',.12],['upperarm_r',.12]
 ]);
 let badWeights=0;
 for(let i=0;i<N;i++){
   let total=0,amount=0;
   for(let k=0;k<4;k++){
     const id=joint.getComponent(i,k),w=weight.getComponent(i,k);
     if(!finite(w)||w<0||!Number.isInteger(id)||id<0||id>=bones.length)throw Error('Invalid skin influence.');
     total+=w;amount+=(boneFactor.get(names[id])||0)*w;
   }
   if(Math.abs(total-1)>.002)badWeights++;
   skin[i]=Math.min(1,Math.max(0,amount));
 }
 if(badWeights)throw Error('Source contains '+badWeights+' invalid vertex skin-weight sums.');
 // Triangle-neighbor smoothing, including coincident positions at UV seams.
 const neigh=Array.from({length:N},()=>new Set());
 for(let q=0;q+2<index.count;q+=3){
   const a=index.getX(q),b=index.getX(q+1),c=index.getX(q+2);
   for(const [u,v] of [[a,b],[b,c],[c,a]]){neigh[u].add(v);neigh[v].add(u);}
 }
 const groups=new Map();
 for(let i=0;i<N;i++){
   const key=[0,1,2].map(k=>Math.round(coords[i*3+k]/.00001)).join(':');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 for(const group of groups.values())if(group.length>1)for(const i of group)for(const k of group)if(i!==k)neigh[i].add(k);
 let smooth=Float64Array.from(skin);
 for(let t=0;t<FEMALE_S04.steps;t++){
   const next=Float64Array.from(smooth);
   for(let i=0;i<N;i++)if(neigh[i].size){
     let s=0;for(const k of neigh[i])s+=smooth[k];
     next[i]=.48*smooth[i]+.52*s/neigh[i].size;
   }
   smooth=next;
 }
 const xs=[];let ymin=Infinity,ymax=-Infinity;
 for(let i=0;i<N;i++){xs.push(coords[i*3]);ymin=Math.min(ymin,coords[i*3+1]);ymax=Math.max(ymax,coords[i*3+1]);}
 if(ymax-ymin<1.6||ymax-ymin>1.95)throw Error('Unexpected body dimensions, aborting sculpt.');
 xs.sort((a,b)=>a-b);const cx=xs[Math.floor(xs.length/2)];
 const bell=(y,c,w)=>Math.exp(-.5*((y-c)/w)**2);
 const step=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
 const out=new Float32Array(coords.length);
 let changed=0,max=0;
 for(let i=0;i<N;i++){
   const ix=i*3,x=coords[ix],y=coords[ix+1],z=coords[ix+2],influence=smooth[i];
   const shoulder=FEMALE_S04.shoulder*intensity*bell(y,1.375,.125)*influence*step(Math.abs(x-cx)/.09);
   const waist=FEMALE_S04.waist*intensity*bell(y,1.085,.125)*influence*step(Math.abs(x-cx)/.06);
   const chest=FEMALE_S04.chest*intensity*bell(y,1.335,.145)*influence*step(Math.abs(z)/.05);
   const nx=cx+(x-cx)*(1+shoulder+waist),nz=z*(1+chest);
   out[ix]=nx;out[ix+1]=y;out[ix+2]=nz;
   const delta=Math.hypot(nx-x,nz-z);if(delta>.00005)changed++;max=Math.max(max,delta);
 }
 // Compare source and edited triangles/edges. Abort before touching geometry.
 let reversed=0,collapsed=0,minRatio=Infinity,maxRatio=0;
 function normal(a,b,c,source){
   const ax=source[a*3],ay=source[a*3+1],az=source[a*3+2],
     ux=source[b*3]-ax,uy=source[b*3+1]-ay,uz=source[b*3+2]-az,
     vx=source[c*3]-ax,vy=source[c*3+1]-ay,vz=source[c*3+2]-az;
   return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
 }
 for(let q=0;q+2<index.count;q+=3){
   const ids=[index.getX(q),index.getX(q+1),index.getX(q+2)];
   const a=normal(...ids,coords),b=normal(...ids,out),
    len2=v=>v[0]**2+v[1]**2+v[2]**2,area0=len2(a),area1=len2(b);
   if(area0>1e-20){
     if(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]<=0)reversed++;
     if(area1<1e-20)collapsed++;
   }
   for(let e=0;e<3;e++){
     const u=ids[e]*3,v=ids[(e+1)%3]*3;
     const d=(x)=>Math.hypot(x[u]-x[v],x[u+1]-x[v+1],x[u+2]-x[v+2]);
     const prior=d(coords);if(prior>1e-8){const ratio=d(out)/prior;minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio);}
   }
 }
 if(reversed||collapsed||minRatio<.8||maxRatio>1.25)
   throw Error('Unsafe rest-mesh change: '+reversed+' flips, '+collapsed+' collapsed triangles, edge ratio '+minRatio.toFixed(3)+'–'+maxRatio.toFixed(3));
 return {positions:out,stats:{verticesChanged:changed,maxDisplacementMm:max*1000,reversed,collapsed,minRatio,maxRatio,triangles:index.count/3}};
}
