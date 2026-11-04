"""Sylvara: deterministic semantic surfacing, unique UV sets, textures, renders, GLB.

Run: blender -b --factory-startup --python-exit-code 1 -P painter_pipeline.py --
     --source /blank.fbx --references /approved --output /new-run
No live Blender, browser, paid service, remeshing, or source writes.
"""
import bpy, sys, json, math, hashlib, argparse, time, colorsys
from pathlib import Path
from collections import Counter
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from painter_audit import components, mesh_signature

PALETTE={
 'BodyShell':'f3b58c',
 'Skin':'f3b58c','BlueCloth':'24468f','CreamCloth':'e8cfaa','Leather':'70402b',
 'Leggings':'3c292c','Hair':'e54e35','Gold':'e4b34f','Eyes':'e7dfd5',
 'Lips':'b9514a','Gem':'14aee7','Brows':'49302a','Cord':'352724'}
RES={'BodyShell':2048,'Skin':2048,'Hair':2048,'BlueCloth':2048,'CreamCloth':1024,'Leather':1024,
     'Leggings':512,'Gold':512,'Eyes':1024,'Lips':512,'Gem':256,'Brows':256,'Cord':256}
ROUGH={'BodyShell':.65,'Skin':.62,'BlueCloth':.78,'CreamCloth':.8,'Leather':.47,'Leggings':.79,
       'Hair':.39,'Gold':.29,'Eyes':.22,'Lips':.42,'Gem':.16,'Brows':.75,'Cord':.7}
HAIR_COMPONENTS={1,8,18,19,20,24,30,33,40,43}
GOLD_COMPONENTS={32,34,35,36,37,39,41,44,46,47,48,49,52,53,55,56,57,58,60,61,63,64,65,66,67,68,69,70,73,74,75,76,77,78,80,81,82,83,88,89}
EXPECTED_SOURCE_SHA256='bd072902aaad647c9385a47abf16020b16a0b8b8f64938cf319833ac9ddca38d'

def rgb(h):return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)],np.float32)
def linear(c):return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
def write_json(p,data):p.write_text(json.dumps(data,indent=2,default=lambda v:v.tolist() if isinstance(v,np.ndarray) else str(v)),encoding='utf8')
def load_png(path):
    im=bpy.data.images.load(str(path),check_existing=False);im.colorspace_settings.name='Non-Color'
    w,h=im.size;a=np.empty(w*h*4,np.float32);im.pixels.foreach_get(a);bpy.data.images.remove(im)
    return a.reshape(h,w,4)[::-1,:,:3].copy()
def save_png(path,a):
    h,w=a.shape[:2];im=bpy.data.images.new(path.stem,w,h,alpha=True,float_buffer=False)
    im.colorspace_settings.name='Non-Color';rgba=np.ones((h,w,4),np.float32);rgba[:,:,:3]=a
    im.pixels.foreach_set(rgba[::-1].ravel());im.filepath_raw=str(path);im.file_format='PNG';im.save();bpy.data.images.remove(im)

class References:
    def __init__(self,folder):
        self.images={k:load_png(folder/f'sylvara_{k}_1024.png') for k in ['front','back','left','right']}
        # All supplied images are read, including the approved four-view board.
        self.all_read=[]
        for p in sorted(folder.iterdir()):
            if p.suffix.lower() in ['.png','.jpg','.jpeg','.webp']:
                a=load_png(p);self.all_read.append({'file':p.name,'size':[a.shape[1],a.shape[0]],'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
        self.prototypes=np.array([rgb(PALETTE[k]) for k in ['Skin','BlueCloth','CreamCloth','Leather','Gold']])
        self.names=['Skin','BlueCloth','CreamCloth','Leather','Gold']
    def project(self,p,n):
        # Model axes were measured: Z-up, front -Y. Side names follow supplied artwork.
        dirs=np.array([[0,-1,0],[0,1,0],[1,0,0],[-1,0,0]],np.float32)
        weights=np.maximum(n@dirs.T,0);view=np.argmax(weights,axis=1)
        result=np.zeros((len(p),3),np.float32);valid=np.zeros(len(p),bool)
        for i,key in enumerate(['front','back','left','right']):
            ids=np.flatnonzero(view==i)
            if not len(ids):continue
            q=p[ids];a=self.images[key]
            if i==0:u=520+930*q[:,0]
            elif i==1:u=504-930*q[:,0]
            elif i==2:u=510+950*q[:,1]
            else:u=520-950*q[:,1]
            v=982-958*q[:,2]
            x=np.clip(np.rint(u).astype(int),0,a.shape[1]-1);y=np.clip(np.rint(v).astype(int),0,a.shape[0]-1)
            result[ids]=a[y,x];bg=a[y,np.zeros_like(x)+15]
            valid[ids]=np.max(abs(result[ids]-bg),axis=1)>.07
        return result,valid
    def categories(self,p,n):
        c,valid=self.project(p,n)
        # A categorical correspondence transfers identity/colors, not photograph lighting.
        d=((c[:,None]-self.prototypes[None])**2).sum(2)
        labels=np.argmin(d,axis=1);labels[~valid]=1
        return np.array(self.names)[labels],c,valid

def eye_coordinates(p):
    x,z=p[:,0],p[:,2];px=x/(.9995117*.22)*1000+500;py=500-(z-.9995117*.905)/(.9995117*.22)*1000
    return px,py

def polygon_mask(px,py,polygons):
    inside=np.zeros(len(px),bool)
    for poly in polygons:
        q=np.zeros(len(px),bool)
        for j,(ax,ay) in enumerate(poly):
            bx,by=poly[(j+1)%len(poly)];cross=((ay>py)!=(by>py))&(px<(bx-ax)*(py-ay)/(by-ay+1e-20)+ax);q^=cross
        inside|=q
    return inside

def eye_mask(p):
    # Full exposed scleral surfaces measured against the unpainted clay render.
    # Prior masks stopped short of the upper/lower rims; the artist requested correction.
    px,py=eye_coordinates(p)
    polygons=[[(313,477),(326,470),(343,467),(360,469),(381,476),(398,488),(412,504),
               (395,507),(372,507),(347,502),(328,496),(317,488)],
              [(532,504),(541,490),(554,479),(573,472),(594,468),(615,469),(633,477),
               (638,487),(630,498),(610,505),(585,508),(560,508),(543,507)]]
    return polygon_mask(px,py,polygons)&(p[:,1]<-.02)

def lash_mask(p):
    px,py=eye_coordinates(p);upper=np.zeros(len(p),bool);lower=np.zeros(len(p),bool)
    paths=[[(298,468),(316,466),(336,462),(355,464),(377,471),(397,484),(410,499),(418,507)],
           [(526,507),(538,490),(553,477),(575,468),(598,463),(621,465),(642,473),(663,467)]]
    for path in paths:
        xx,yy=np.array(path).T;line=np.interp(px,xx,yy)
        upper|=(px>=xx[0])&(px<=xx[-1])&(py>=line-2)&(py<=line+4.5)
    for path in [[(316,489),(330,497),(348,503),(373,508),(399,508),(413,505)],
                 [(532,505),(552,509),(578,510),(607,508),(629,500),(639,487)]]:
        xx,yy=np.array(path).T;line=np.interp(px,xx,yy)
        lower|=(px>=xx[0])&(px<=xx[-1])&(abs(py-line)<1.0)
    return (upper|lower)&(p[:,1]<-.02)

def label_surfaces(o,ref):
    me=o.data;cl=components(me);points=np.array([o.matrix_world@v.co for v in me.vertices]);cent=np.array([points[list(p.vertices)].mean(0) for p in me.polygons])
    normals=np.array([o.matrix_world.to_3x3()@p.normal for p in me.polygons]);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-8)
    cids=np.array([cl[p.vertices[0]] for p in me.polygons]);x,y,z=cent.T;ax=abs(x)
    labels,projected,valid=ref.categories(cent,normals)
    labels=labels.astype('<U16')
    # Anatomical/garment constraints disambiguate projected silhouettes and occlusions.
    main=cids==0
    labels[main&(z>.825)]='Skin'
    labels[main&(z>.775)&(ax<.095)]='Skin'
    labels[main&(ax>.15)&(z>.625)&(z<.70)]='Skin'
    labels[main&(ax>.11)&(z>.69)&(z<.742)]='CreamCloth'
    labels[main&(ax>.11)&(z>=.738)&(z<.758)]='Leather'
    labels[main&(z>.641)&(z<.752)&(ax<.10)]='BlueCloth'
    # Upper cream neckline follows source color correspondence on the bust only.
    upper=main&(z>.749)&(z<.782)&(ax<.10)&(y<-.02)
    labels[upper]=np.where(projected[upper].mean(1)>.60,'CreamCloth','BlueCloth')
    # Shoulder straps are intentionally left in the leather family.
    labels[main&(z>.765)&(z<.81)&(ax>.042)&(ax<.073)&(abs(y)>.020)]='Leather'
    labels[main&(z>.604)&(z<.642)&(ax<.11)]='Leather'
    skirt=main&(z<.604)
    labels[skirt]='BlueCloth'
    labels[skirt&(z<.405)]='CreamCloth'
    labels[skirt&(projected.mean(1)>.69)&(z<.49)]='CreamCloth'
    labels[main&(x<-.077)&(z>.50)&(z<.592)&(y<-.035)]='Leather'
    labels[np.isin(cids,[2,3,4,5,9,45,50,51,54,59,62,79,84,85])]='Leather'
    labels[cids==6]='Leggings';labels[np.isin(cids,list(HAIR_COMPONENTS))]='Hair'
    labels[np.isin(cids,list(GOLD_COMPONENTS))]='Gold'
    labels[np.isin(cids,list(range(10,18)))|np.isin(cids,[22,23,71,72])]='Skin'
    labels[np.isin(cids,[29,31])]='Brows'
    labels[np.isin(cids,[25,27,28,38])]='Cord';labels[cids==26]='Gem'
    labels[np.isin(cids,[7,42])]='Lips'
    eyes=eye_mask(cent)&np.isin(cids,[0,21]);labels[eyes]='Eyes'
    labels[(cids==21)&~eyes]='Skin'
    # Smooth isolated reference-category noise on the fused primary shell only.
    edge_faces={}
    for p in me.polygons:
        for k in p.edge_keys:edge_faces.setdefault(tuple(sorted(k)),[]).append(p.index)
    neighbors=[set() for _ in me.polygons]
    for ids in edge_faces.values():
        for i in ids:neighbors[i].update(j for j in ids if j!=i)
    for _ in range(2):
        new=labels.copy()
        for i in np.flatnonzero(main&(z<.8)):
            votes=Counter(labels[j] for j in neighbors[i]);winner,count=votes.most_common(1)[0] if votes else ('',0)
            if count>=3 and votes.get(labels[i],0)==0:new[i]=winner
        labels=new
    # The fused primary shell needs sub-face precision at garment borders. Bake
    # continuous world-space masks instead of jagged per-polygon class transitions.
    labels[main]='BodyShell'
    labels[cids==21]='BodyShell'
    return labels,cent,normals,cids,points

def unwrap_materials(o,labels):
    me=o.data;names=[k for k in PALETTE if np.any(labels==k)];me.materials.clear()
    for name in names:
        mat=bpy.data.materials.new('Sylvara_'+name);mat.diffuse_color=tuple(linear(rgb(PALETTE[name])))+(1,);me.materials.append(mat)
    for p,l in zip(me.polygons,labels):p.material_index=names.index(l)
    if not me.uv_layers:me.uv_layers.new(name='Sylvara_UniqueUV')
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    for name in names:
        # Native Smart Project was measured to overlap 0.34% of skin texels on this
        # fused Tripo mesh. Deterministic per-polygon charts guarantee separation
        # without a vertex, edge, weight or shape change. World-space paint stays
        # continuous across chart seams; layout efficiency is explicitly reported.
        polys=[p for p,l in zip(me.polygons,labels) if l==name]
        side=math.ceil(math.sqrt(len(polys)));res=RES[name]
        inset=min(3/res,.19/side)
        for k,poly in enumerate(polys):
            bx=(k%side)/side+inset;by=(k//side)/side+inset;span=1/side-2*inset
            size=len(poly.loop_indices)
            if size==4:coords=[(0,0),(1,0),(1,1),(0,1)]
            elif size==3:coords=[(0,0),(1,0),(.5,1)]
            else:coords=[(.5+.5*math.cos(2*math.pi*j/size),.5+.5*math.sin(2*math.pi*j/size)) for j in range(size)]
            for li,(u,v) in zip(poly.loop_indices,coords):me.uv_layers.active.data[li].uv=(bx+u*span,by+v*span)
        print('UNWRAP',name,flush=True)
    me.uv_layers.active.name='Sylvara_UniqueUV'
    return names

def raster_material(o,index,res):
    me=o.data;me.calc_loop_triangles();uv=np.array([u.uv[:] for u in me.uv_layers.active.data])*res
    points=np.array([o.matrix_world@v.co for v in me.vertices],np.float32)
    ns=np.array([o.matrix_world.to_3x3()@v.normal for v in me.vertices],np.float32)
    pos=np.zeros((res,res,3),np.float32);norm=np.zeros_like(pos);count=np.zeros((res,res),np.uint16)
    for t in me.loop_triangles:
        if me.polygons[t.polygon_index].material_index!=index:continue
        q=uv[list(t.loops)];lo=np.maximum(np.floor(q.min(0)).astype(int),0);hi=np.minimum(np.ceil(q.max(0)).astype(int),res-1)
        if np.any(hi<lo):continue
        yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];xx=xx+.5;yy=yy+.5
        a,b,c=q;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-10:continue
        w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w2=1-w0-w1
        valid=(w0>1e-6)&(w1>1e-6)&(w2>1e-6)
        ry=yy.astype(int)[valid];rx=xx.astype(int)[valid];w=np.stack([w0[valid],w1[valid],w2[valid]],1)
        count[ry,rx]+=1;pos[ry,rx]=w@points[list(t.vertices)];norm[ry,rx]=w@ns[list(t.vertices)]
    return pos,norm,count

def hair_color(p,n,ref):
    # Smooth 3D hue anchors follow the approved swoop and single braid. They avoid
    # normal-angle switches between projections, which created confetti patches.
    anchors=np.array([[-.016,-.07,.988,0],[-.05,-.08,.969,.07],[-.073,-.077,.943,.14],[-.08,-.06,.925,.32],[-.071,-.03,.898,.58],[-.066,-.036,.869,.77],[-.057,-.05,.842,.89],
                      [.025,-.075,.984,.025],[.053,-.068,.970,.14],[.067,-.048,.948,.33],[.066,-.026,.923,.58],[.071,-.021,.900,.76],[.069,-.027,.858,.9],
                      [0,.07,.989,.51],[-.05,.055,.967,.16],[.05,.055,.965,.10],[0,.08,.935,.57],[-.06,.065,.927,.59],[.06,.065,.926,.75]],np.float32)
    hue=np.empty(len(p),np.float32)
    for start in range(0,len(p),100000):
        q=p[start:start+100000];d=((q[:,None]-anchors[None,:,:3])**2).sum(2);w=np.exp(-d/(.022**2));w/=np.maximum(w.sum(1)[:,None],1e-12)
        theta=anchors[:,3]*2*np.pi;hue[start:start+len(q)]=(np.arctan2(w@np.sin(theta),w@np.cos(theta))/(2*np.pi))%1
    braid=(p[:,1]>.032)&(p[:,2]<.866)&(abs(p[:,0])<.061)
    hue[braid]=np.clip((.858-p[braid,2])/.145,0,.79)
    # Loose tail remains violet, as in the approved rear view.
    hue[(p[:,2]<.713)&(p[:,1]>.025)]=.77
    h=(hue%1)*6;i=np.floor(h).astype(int);f=h-i;s=.83;v=.91
    aa=np.full(len(p),v);bb=np.full(len(p),v*(1-s));q=v*(1-s*f);t=v*(1-s*(1-f))
    choices=[np.stack(c,1) for c in [(aa,t,bb),(q,aa,bb),(bb,aa,t),(bb,q,aa),(t,bb,aa),(aa,bb,q)]]
    return np.stack(choices)[i,np.arange(len(p))]

def body_colors(p,n):
    x,y,z=p.T;ax=abs(x);c=np.tile(rgb(PALETTE['Skin']),(len(p),1));rough=np.full(len(p),.62,np.float32)
    def paint(mask,name):c[mask]=rgb(PALETTE[name]);rough[mask]=ROUGH[name]
    # Front sweetheart neckline and lower rear bodice edge, authored on the mesh.
    neckline=.774-.015*np.exp(-(x/.026)**2)-.20*np.maximum(ax-.060,0)
    top=np.where(y<0,neckline,.774)
    torso=(ax<.11)&(z>.640)&(z<top)
    paint(torso,'BlueCloth');paint(torso&(y<-.015)&(z>top-.012),'CreamCloth')
    paint((ax>.090)&(z>.678)&(z<.742),'CreamCloth')
    paint((ax>.105)&(z>=.742)&(z<.752),'Leather')
    # Skirt remains a continuous color field across all UV chart boundaries.
    skirt=z<.610;paint(skirt,'BlueCloth')
    front=np.clip((-y+.02)/.09,0,1);hem=(.370-.12*x)*(1-front)+(.438+.30*x)*front
    paint(skirt&(z<hem-.013),'CreamCloth');paint(skirt&(z>=hem-.013)&(z<hem-.006),'Gold')
    # Waist belt, cross-body belt and fused left pouch are checked independently.
    paint((z>.612)&(z<.642)&(ax<.118),'Leather')
    paint((abs(z-(.600+.34*x))<.012)&(ax<.112)&(y<-.045)&(z>.565)&(z<.65),'Leather')
    paint((abs(z-(.604-.22*x))<.012)&(ax<.115)&(y>.020)&(z>.57)&(z<.63),'Leather')
    paint((abs(z-(.601+.20*x))<.010)&(ax<.11)&(y>.020)&(z>.57)&(z<.63),'Leather')
    paint((x<-.068)&(x>-.139)&(z>.497)&(z<.598)&(y<-.037),'Leather')
    # Shoulder straps follow the front and back chest surfaces, below the shoulder.
    paint((ax>.048)&(ax<.069)&(z>.773)&(z<.816)&(abs(y)>.020),'Leather')
    # Face accents follow the sculpted lip volume and interior eye openings.
    cheeks=np.exp(-((ax-.035)/.016)**2-((z-.882)/.015)**2)*np.clip((-y-.02)/.025,0,1)
    c=c*(1-cheeks[:,None]*.19)+np.array([.91,.43,.37])*cheeks[:,None]*.19
    mx=x+.005
    lip=np.exp(-(mx/.020)**4-((z-.868)/.0043)**4)*(y<-.040)
    c=c*(1-lip[:,None]*.70)+rgb('c77368')*lip[:,None]*.70
    rough[lip>.35]=.43
    eyes=eye_mask(p)
    if np.any(eyes):c[eyes]=surface_color('Eyes',p[eyes],n[eyes],None);rough[eyes]=.22
    lashes=lash_mask(p);c[lashes]=rgb('35201e');rough[lashes]=.72
    # Skin over the sculpted lids is never replaced by a painted iris.
    return np.clip(c,.025,.98),rough

def surface_color(name,p,n,ref):
    color=np.tile(rgb(PALETTE[name]),(len(p),1));x,y,z=p.T
    wave=np.sin(x*231+z*57)*np.sin(y*173-z*21)
    # Restrained authored variation; primary illumination remains in the renderer.
    shade=.97+.035*wave+.04*np.clip(n[:,2],-.8,1)
    color*=shade[:,None]
    if name=='BodyShell':
        color,_=body_colors(p,n);color*=shade[:,None]
    elif name=='Skin':
        cheek=np.exp(-((abs(x+.005)-.035)/.016)**2-((z-.882)/.018)**2)*np.clip((-y-.02)/.025,0,1)
        color=color*(1-cheek[:,None]*.18)+np.array([.91,.43,.37])*cheek[:,None]*.18
    elif name=='Hair':color=hair_color(p,n,ref)*(shade[:,None]+.02)
    elif name=='Leather':
        sole=z<.018;color[sole]*=.48
        # Gauntlet and boot strap creases are already geometry, not invented grooves.
    elif name=='Eyes':
        color[:]=rgb('e7e1d6')
        centers=[(-.030,.9075),(.020,.9077)]
        for cx,cz in centers:
            r=np.sqrt(((x-cx)/.0067)**2+((z-cz)/.0067)**2);iris=r<1
            a=np.arctan2(z-cz,x-cx);stri=.90+.10*np.sin(a*37+r*13)
            color[iris]=np.stack([.04+.02*stri[iris],.39+.24*(1-r[iris]),.69+.20*(1-r[iris])],1)
            color[(r>.84)&(r<1)]=rgb('13344f');color[r<.44]=rgb('151f2c')
            sparkle=((x-cx+.0015)**2+(z-cz-.0017)**2)<.00085**2;color[sparkle]=rgb('f6eee2')
        color[~eye_mask(p)]=rgb(PALETTE['Skin'])
    elif name=='Lips':
        color[:]=rgb('bc5951');color[z<.865]*=1.06
        line=(abs(z-(.8654+.0007*np.cos(x*120)))<.00065)&(abs(x+.005)<.018)
        color[line]=rgb('61332f')
    elif name=='Gem':color*=1+.12*np.clip(n[:,2,None],-1,1)
    return np.clip(color,.025,.98)

def dilate(a,mask,steps=5):
    filled=mask.copy()
    for _ in range(steps):
        old=filled.copy()
        for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
            nearby=np.roll(old,(dy,dx),(0,1));take=nearby&~filled
            a[take]=np.roll(a,(dy,dx),(0,1))[take];filled[take]=True
    return a

def make_textures(o,names,ref,out,only=None):
    texture_dir=out/'textures';texture_dir.mkdir(exist_ok=True);reports=[]
    for mi,name in enumerate(names):
        if only is not None and name not in only:continue
        res=RES[name];p,n,count=raster_material(o,mi,res);mask=count>0
        overlap=int(np.count_nonzero(count>1));valid=int(mask.sum())
        # Any meaningful self-overlap blocks texturing; UVs shared between different
        # materials are independent because each material has its own texture image.
        if overlap>max(5,valid*.00005):raise RuntimeError(f'{name}: overlapping UV interiors: {overlap}/{valid}')
        v=n[mask];v/=np.maximum(np.linalg.norm(v,axis=1)[:,None],1e-6)
        albedo=np.zeros_like(p);albedo[mask]=surface_color(name,p[mask],v,ref);albedo=dilate(albedo,mask,5)
        orm=np.zeros_like(p);orm[:,:,0]=1;orm[:,:,1]=ROUGH[name];orm[:,:,2]=float(name=='Gold')
        orm[mask,1]=np.clip(ROUGH[name]+.025*np.sin(p[mask,0]*300+p[mask,2]*77),.08,.95)
        if name=='BodyShell':orm[mask,1]=body_colors(p[mask],v)[1]
        base=texture_dir/f'Sylvara_{name}_BaseColor.png';data=texture_dir/f'Sylvara_{name}_ORM.png'
        # Raster arrays use bottom-up UV coordinates; save_png expects top-down.
        save_png(base,albedo[::-1]);save_png(data,orm[::-1])
        mat=o.data.materials[mi];nt=mat.node_tree;bs=next(v for v in nt.nodes if v.type=='BSDF_PRINCIPLED')
        for node in list(nt.nodes):
            if node.type not in ['BSDF_PRINCIPLED','OUTPUT_MATERIAL']:nt.nodes.remove(node)
        uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map=o.data.uv_layers.active.name
        tx=nt.nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(base));tx.image.colorspace_settings.name='sRGB';nt.links.new(uv.outputs['UV'],tx.inputs['Vector']);nt.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
        dt=nt.nodes.new('ShaderNodeTexImage');dt.image=bpy.data.images.load(str(data));dt.image.colorspace_settings.name='Non-Color';nt.links.new(uv.outputs['UV'],dt.inputs['Vector'])
        sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(dt.outputs['Color'],sep.inputs[0]);nt.links.new(sep.outputs['Green'],bs.inputs['Roughness']);nt.links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
        bs.inputs['Specular IOR Level'].default_value=.35 if name in ['Skin','BlueCloth','CreamCloth'] else .5
        if name=='Skin':bs.inputs['Subsurface Weight'].default_value=.055;bs.inputs['Subsurface Scale'].default_value=.006
        for im in [tx.image,dt.image]:im.pack()
        reports.append({'material':name,'resolution':res,'covered_pixels':valid,'overlap_pixels':overlap,'coverage':valid/res**2,'base_color':str(base),'orm':str(data)})
        print('TEXTURE '+json.dumps(reports[-1]),flush=True)
        del p,n,count,albedo,orm
    return reports

def studio(o):
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=12;sc.cycles.use_denoising=True;sc.cycles.max_bounces=3
    sc.render.threads_mode='FIXED';sc.render.threads=4
    sc.world=bpy.data.worlds.new('Sylvara_NeutralStudio');sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.38
    sc.view_settings.view_transform='AgX';sc.render.resolution_x=800;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
    sc.render.image_settings.file_format='PNG';sc.render.film_transparent=False
    for name,pos,power,size in [('Key',(-2,-3,4),280,3),('Fill',(3,-2,2),150,3),('Rim',(1,2,3),220,2)]:
        l=bpy.data.lights.new(name,'AREA');l.energy=power;l.shape='DISK';l.size=size
        ob=bpy.data.objects.new(name,l);sc.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.55))-ob.location).to_track_quat('-Z','Y').to_euler()
    cd=bpy.data.cameras.new('SylvaraReviewCamera');cam=bpy.data.objects.new('SylvaraReviewCamera',cd);sc.collection.objects.link(cam);cd.type='ORTHO';cd.ortho_scale=1.10;cd.clip_start=.001;sc.camera=cam
    return cam

def render_review(o,out,face_only=False):
    prev=out/'preview';prev.mkdir(exist_ok=True);cam=studio(o);sc=bpy.context.scene;target=Vector((0,0,.5))
    for name,pos in {'front':(0,-4,.5),'back':(0,4,.5),'left':(-4,0,.5),'right':(4,0,.5),'three_quarter':(3,-4,.6)}.items():
        if face_only:continue
        cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();sc.render.filepath=str(prev/f'{name}.png');bpy.ops.render.render(write_still=True)
    cam.location=(0,-4,.901);target=Vector((-.004,0,.901));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.205
    sc.render.resolution_x=1000;sc.render.resolution_y=1000;sc.render.filepath=str(prev/'face.png');bpy.ops.render.render(write_still=True)
    # Honest unlit albedo check for painted seams / lighting contamination.
    backups=[]
    for mat in o.data.materials:
        bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');outnode=next(n for n in mat.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
        emit=mat.node_tree.nodes.new('ShaderNodeEmission');tx=next(n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and 'BaseColor' in n.image.name)
        mat.node_tree.links.new(tx.outputs['Color'],emit.inputs['Color']);mat.node_tree.links.new(emit.outputs[0],outnode.inputs['Surface']);backups.append((mat,bs,outnode,emit))
    sc.render.filepath=str(prev/'face-unlit.png');bpy.ops.render.render(write_still=True)
    for mat,bs,outnode,emit in backups:mat.node_tree.links.new(bs.outputs[0],outnode.inputs['Surface']);mat.node_tree.nodes.remove(emit)
    if not face_only:
        arrays=[load_png(prev/f'{name}.png') for name in ['front','back','left','right','three_quarter']]
        sheet=np.concatenate([a[::2,::2] for a in arrays],axis=1);save_png(prev/'contact-sheet.png',sheet)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--references',required=True);ap.add_argument('--output',required=True);ap.add_argument('--render-only',action='store_true');a=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    source=Path(a.source).resolve();refs=Path(a.references).resolve();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);t=time.time()
    if a.render_only:
        bpy.ops.wm.open_mainfile(filepath=str(out/'Sylvara_Painted_EDITABLE.blend'));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');render_review(o,out);return
    if hashlib.sha256(source.read_bytes()).hexdigest()!=EXPECTED_SOURCE_SHA256:
        raise ValueError('Surface/component masks are calibrated for the audited SylvaraMasterBlank.fbx only. Audit and remap a different source before painting.')
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(source));bpy.context.view_layer.update();o=next(o for o in bpy.context.scene.objects if o.type=='MESH');baseline=mesh_signature(o)
    ref=References(refs);labels,cent,norm,cids,points=label_surfaces(o,ref)
    write_json(out/'02_reference_palette.json',{'albedo_interpretation':PALETTE,'all_images_read':ref.all_read,'method':'Named surface albedo palette interpreted from approved artwork; raw projected RGB used only for category/hue correspondence, not photographed illumination.'})
    write_json(out/'03_surface_plan.json',{'mesh':o.name,'face_labels':labels.tolist(),'component_ids':cids.tolist(),'counts':dict(Counter(labels.tolist())),'calibration':{'axes':'Z up; front -Y','front_px':[520,930,982,-958],'back_px':[504,-930,982,-958],'notes':'Orthographic whole-body correspondences; constrained by actual component topology and anatomical ranges. Side cameras reversed relative to filenames. Facial eye masks measured inside imported eyelid rims.'},'confidence':'High for detached accessories and macro regions. Medium at fused garment boundaries; artistic review required.'})
    names=unwrap_materials(o,labels);textures=make_textures(o,names,ref,out)
    after=mesh_signature(o);assert baseline==after,'Geometry/rig signature changed during surfacing'
    write_json(out/'geometry-preservation.json',{'before':baseline,'after':after,'identical':True,'source_hash':hashlib.sha256(source.read_bytes()).hexdigest()})
    write_json(out/'uv-texture-audit.json',{'source_uv_layers':0,'method':'Guaranteed unique per-polygon charts and independent image per semantic material. This conservative automated layout sacrifices packing efficiency and 2D paint convenience to eliminate the measured native unwrap overlaps. Original connectivity and coordinates unchanged.','materials':textures,'shared_texture_conflicts':0})
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'Sylvara_Painted_EDITABLE.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type in ['MESH','ARMATURE']:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/'Sylvara_Painted_CANDIDATE.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_apply=False)
    render_review(o,out)
    write_json(out/'run-timing.json',{'seconds':time.time()-t,'bpy_version':bpy.app.version_string})
    print('RESULT '+json.dumps({'candidate':str(out/'Sylvara_Painted_CANDIDATE.glb'),'seconds':time.time()-t}),flush=True)
if __name__=='__main__':main()
