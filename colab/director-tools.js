/**
 * CoLab Director Lab · geometry-only, CPU-local surface relaxation
 * Pure functions: no AI calls, uploads, renderer or global state.
 *
 * Positions and indices describe a Three.js BufferGeometry; triangleIds
 * are decoded face indices from CoLab's SHA-256-bound selection handoff.
 * Vertices shared with unselected faces, open edges and UV seams are protected.
 */
export function relaxSelectedSurface(positions, indices, triangleIds, options={}) {
  const n=positions?.length/3;
  if(!Number.isInteger(n)||n<=0||n>1_500_000)throw Error('Unsupported vertex buffer.');
  const triangleCount=(indices?indices.length:n)/3;
  if(!Number.isInteger(triangleCount)||triangleCount>1_000_000)throw Error('Unsupported triangle buffer.');
  const chosen=new Set(triangleIds);
  if(!chosen.size||chosen.size>70_000||[...chosen].some(t=>!Number.isInteger(t)||t<0||t>=triangleCount))
    throw Error('Choose a valid patch of 1 to 70,000 triangles.');
  const strength=Number(options.strength??.28),rounds=Number(options.rounds??2);
  if(!(strength>=.01&&strength<=.55)||!Number.isInteger(rounds)||rounds<1||rounds>4)
    throw Error('Strength or iteration count is outside safe preview limits.');
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){const x=positions[i*3+k];if(!Number.isFinite(x))throw Error('Non-finite vertex position.');min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);}
  const diagonal=Math.hypot(...min.map((x,k)=>max[k]-x));
  const tolerance=Math.max(diagonal*1e-7,1e-9);
  const groupMap=new Map(),groups=[],vertexGroup=new Int32Array(n);
  for(let i=0;i<n;i++){
    const key=[0,1,2].map(k=>Math.round((positions[i*3+k]-min[k])/tolerance)).join('|');
    let g=groupMap.get(key);
    if(g===undefined){g=groups.length;groupMap.set(key,g);groups.push({x:[positions[i*3],positions[i*3+1],positions[i*3+2]],neighbors:new Set(),flags:0,edge:false});}
    vertexGroup[i]=g;
  }
  const edges=new Map();
  const indexAt=i=>indices?indices[i]:i;
  const registerEdge=(a,b)=>{
    if(a===b)return;
    const key=a<b?a+'|'+b:b+'|'+a;
    const prev=edges.get(key);
    if(prev)prev.count++;else edges.set(key,{a,b,count:1});
  };
  for(let t=0;t<triangleCount;t++){
    const g=[];
    for(let k=0;k<3;k++){
      const vi=indexAt(t*3+k);
      if(!Number.isInteger(vi)||vi<0||vi>=n)throw Error('Invalid triangle index.');
      g.push(vertexGroup[vi]);
    }
    const isSelected=chosen.has(t);
    for(const id of g)groups[id].flags|=isSelected?1:2;
    if(isSelected){
      for(let k=0;k<3;k++){
        const a=g[k],b=g[(k+1)%3];if(a===b)continue;
        groups[a].neighbors.add(b);groups[b].neighbors.add(a);registerEdge(a,b);
      }
    }
  }
  for(const e of edges.values())if(e.count===1){groups[e.a].edge=true;groups[e.b].edge=true;}
  const eligible=groups.map((g,i)=>g.flags===1&&!g.edge&&g.neighbors.size>=3?i:-1).filter(i=>i>=0);
  if(!eligible.length)
    return {positions:new Float32Array(positions),changedVertices:0,selectedTriangles:chosen.size,
      lockedGroups:groups.filter(g=>g.flags===3||g.edge).length,
      reason:'No enclosed interior vertices. Select a wider patch; shared boundaries stay locked to protect the surrounding mesh.'};
  let state=groups.map(g=>g.x.slice());
  for(let iter=0;iter<rounds;iter++){
    const out=state.map(v=>v.slice());
    for(const id of eligible){
      const near=[...groups[id].neighbors];const avg=[0,0,0];
      for(const j of near)for(let k=0;k<3;k++)avg[k]+=state[j][k]/near.length;
      for(let k=0;k<3;k++)out[id][k]=state[id][k]+(avg[k]-state[id][k])*strength;
    }
    state=out;
  }
  const changed=new Float32Array(positions);
  const movable=new Set(eligible);let changedVertices=0,maxOffset=0;
  for(let i=0;i<n;i++){
    const group=vertexGroup[i];if(!movable.has(group))continue;
    const prev=i*3,dist=Math.hypot(state[group][0]-positions[prev],state[group][1]-positions[prev+1],state[group][2]-positions[prev+2]);
    if(dist<1e-10)continue;
    for(let k=0;k<3;k++)changed[prev+k]=state[group][k];
    changedVertices++;maxOffset=Math.max(maxOffset,dist);
  }
  return {positions:changed,changedVertices,selectedTriangles:chosen.size,
    lockedGroups:groups.filter(g=>g.flags===3||g.edge).length,maxOffset,
    reason:changedVertices?'Preview changes only interior vertices; boundary positions remain fixed.':'No movement at the requested strength.'};
}
