"""Read-only source audit and offscreen evidence. Run with Blender --background."""
import bpy, sys, json, hashlib, math, time
from pathlib import Path
from collections import Counter
import numpy as np
from mathutils import Vector

def mesh_signature(obj):
    me=obj.data
    co=np.empty(len(me.vertices)*3,np.float32);me.vertices.foreach_get('co',co)
    loops=np.empty(len(me.loops),np.int32);me.loops.foreach_get('vertex_index',loops)
    return {'vertices':len(me.vertices),'polygons':len(me.polygons),'triangles':sum(len(p.vertices)-2 for p in me.polygons),
            'positions_sha256':hashlib.sha256(co.tobytes()).hexdigest(),'loops_sha256':hashlib.sha256(loops.tobytes()).hexdigest(),
            'matrix_world':[list(r) for r in obj.matrix_world],
            'vertex_groups':[g.name for g in obj.vertex_groups],
            'shape_keys':[] if not me.shape_keys else [k.name for k in me.shape_keys.key_blocks]}

def components(me):
    parent=list(range(len(me.vertices)))
    def root(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for e in me.edges:
        a,b=map(root,e.vertices);parent[a]=b
    groups={}
    for i in range(len(parent)):groups.setdefault(root(i),[]).append(i)
    labels=np.zeros(len(parent),np.int32)
    for k,ids in enumerate(sorted(groups.values(),key=lambda a:-len(a))):labels[ids]=k
    return labels

def setup_scene(out,height,center):
    scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
    sh=scene.display.shading;sh.light='STUDIO';sh.studio_light='paint.sl';sh.color_type='MATERIAL'
    sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';sh.show_specular_highlight=True
    sh.background_type='WORLD';scene.world.color=(.085,.085,.095)
    scene.render.resolution_x=800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='Standard'
    camdata=bpy.data.cameras.new('AuditCamera');cam=bpy.data.objects.new('AuditCamera',camdata);scene.collection.objects.link(cam)
    camdata.type='ORTHO';camdata.ortho_scale=height*1.12;camdata.clip_start=height*.001;camdata.clip_end=height*100
    scene.camera=cam
    return cam

def render_views(out,cam,center,height,prefix='blank',face=False):
    scene=bpy.context.scene
    views={'front':(0,-4,0),'back':(0,4,0),'left':(-4,0,0),'right':(4,0,0),'three_quarter':(3,-4,.2)}
    if face:views={'face':(0,-4,0)};cam.data.ortho_scale=height*.22;scene.render.resolution_x=1000;scene.render.resolution_y=1000
    for name,offset in views.items():
        cam.location=Vector(center)+Vector(offset)*height
        cam.rotation_euler=(Vector(center)-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
        scene.render.filepath=str(out/f'{prefix}-{name}.png');bpy.ops.render.render(write_still=True)

def main():
    source,out=[Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]];out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.scene.world=bpy.data.worlds.new('AuditWorld')
    bpy.ops.import_scene.fbx(filepath=str(source))
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.context.view_layer.update()
    report={'source':str(source),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'meshes':[],
            'armatures':[{'name':o.name,'bones':[b.name for b in o.data.bones]} for o in bpy.context.scene.objects if o.type=='ARMATURE']}
    allworld=[]
    for oi,o in enumerate(obs):
        me=o.data;me.calc_loop_triangles();labels=components(me)
        co=np.array([o.matrix_world@v.co for v in me.vertices],np.float32);allworld.extend(co)
        stat=mesh_signature(o);stat.update(name=o.name,uv_layers=[u.name for u in me.uv_layers],materials=[m.name if m else None for m in me.materials],
            modifiers=[{'name':m.name,'type':m.type} for m in o.modifiers],components=[])
        for cid in sorted(set(labels.tolist())):
            p=co[labels==cid];stat['components'].append({'id':int(cid),'vertices':int(len(p)),'min':p.min(0).tolist(),'max':p.max(0).tolist(),'center':p.mean(0).tolist()})
        np.savez_compressed(out/f'mesh-{oi}.npz',positions=co,triangles=np.array([t.vertices[:] for t in me.loop_triangles],np.int32),
                            triangle_polygons=np.array([t.polygon_index for t in me.loop_triangles],np.int32),components=labels)
        report['meshes'].append(stat)
    report['bounds']={'min':np.min(allworld,axis=0).tolist(),'max':np.max(allworld,axis=0).tolist()}
    (out/'01_model_uv_rig_audit.json').write_text(json.dumps(report,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'original-import.blend'))
    lo,hi=map(np.array,[report['bounds']['min'],report['bounds']['max']]);height=float(hi[2]-lo[2]);center=(hi+lo)*.5
    gray=bpy.data.materials.new('AuditClay');gray.diffuse_color=(.65,.65,.65,1)
    for o in obs:o.data.materials.clear();o.data.materials.append(gray)
    cam=setup_scene(out,height,center);render_views(out,cam,center,height)
    facecenter=np.array([center[0],center[1],lo[2]+height*.905]);render_views(out,cam,facecenter,height,face=True)
    for oi,o in enumerate(obs):
        labels=components(o.data);o.data.materials.clear()
        for cid in sorted(set(labels.tolist())):
            m=bpy.data.materials.new(f'Component_{cid:03}');rng=np.random.default_rng(cid+319);m.diffuse_color=tuple(rng.uniform(.12,.85,3))+(1,);o.data.materials.append(m)
        for p in o.data.polygons:p.material_index=int(labels[p.vertices[0]])
    cam.data.ortho_scale=height*1.12;bpy.context.scene.render.resolution_x=800;bpy.context.scene.render.resolution_y=1000
    render_views(out,cam,center,height,prefix='components')
    print('RESULT '+json.dumps({'audit':str(out/'01_model_uv_rig_audit.json'),'source_unchanged':hashlib.sha256(source.read_bytes()).hexdigest()==report['source_sha256']}))
if __name__=='__main__':main()
