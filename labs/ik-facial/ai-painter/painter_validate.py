"""Independent source/GLB checks and disposable chest-to-skirt UV-spill render."""
import bpy,sys,json,struct,hashlib,math,argparse
from pathlib import Path
from collections import Counter
import numpy as np
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from painter_pipeline import raster_material,save_png,load_png,studio,write_json
from painter_audit import mesh_signature

def geometry(objects):
    pts=[];tris=[];normals=[];offset=0
    for o in objects:
        me=o.data;me.calc_loop_triangles();p=np.array([o.matrix_world@v.co for v in me.vertices],np.float64)
        pts.extend(p);normals.extend([v.normal[:] for v in me.vertices]);tris.extend(np.array([t.vertices[:] for t in me.loop_triangles])+offset);offset+=len(p)
    pts=np.array(pts);tri=np.array(tris);q=np.rint(pts*1e6).astype(np.int64)
    unique,first,ids=np.unique(q,axis=0,return_index=True,return_inverse=True);canonical=np.sort(ids[tri],axis=1)
    order=np.lexsort(canonical.T[::-1]);canonical=canonical[order]
    oriented=ids[tri];start=np.argmin(oriented,axis=1);oriented=np.take_along_axis(oriented,(start[:,None]+np.arange(3))%3,axis=1);oriented=oriented[np.lexsort(oriented.T[::-1])]
    edges=Counter()
    for t in canonical:
        for a,b in [(t[0],t[1]),(t[1],t[2]),(t[2],t[0])]:edges[tuple(sorted((int(a),int(b))))]+=1
    tri_points=pts[tri];areas=np.linalg.norm(np.cross(tri_points[:,1]-tri_points[:,0],tri_points[:,2]-tri_points[:,0]),axis=1)*.5
    return {'_unique_points':pts[first],'raw_vertices':len(pts),'unique_positions_at_1um':len(unique),'triangles':len(tri),'degenerate_triangles_below_1e-12':int(np.count_nonzero(areas<1e-12)),'bounds_min':pts.min(0).tolist(),'bounds_max':pts.max(0).tolist(),
            'position_set_sha256':hashlib.sha256(unique.tobytes()).hexdigest(),'triangle_surface_sha256':hashlib.sha256(canonical.tobytes()).hexdigest(),
            'triangle_winding_sha256':hashlib.sha256(oriented.tobytes()).hexdigest(),'finite_vertex_normals':bool(np.isfinite(np.array(normals)).all()),
            'boundary_edges_after_positional_weld':sum(n==1 for n in edges.values()),'overfull_edges_after_positional_weld':sum(n>2 for n in edges.values()),
            'finite_positions':bool(np.isfinite(pts).all())}

def glb_json(path):
    data=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and total==len(data)
    length,typ=struct.unpack_from('<II',data,12);assert typ==0x4e4f534a
    return json.loads(data[20:20+length])

def diagnostic(out):
    bpy.ops.wm.open_mainfile(filepath=str(out/'Sylvara_Painted_EDITABLE.blend'));o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
    mi=next(i for i,m in enumerate(o.data.materials) if m.name=='Sylvara_BodyShell');res=1024
    me=o.data;me.calc_loop_triangles();uv_data=np.array([v.uv[:] for v in me.uv_layers.active.data]);zero_uv=0
    for t in me.loop_triangles:
        q=uv_data[list(t.loops)];a=q[1]-q[0];b=q[2]-q[0];zero_uv+=int(abs(a[0]*b[1]-a[1]*b[0])<1e-12)
    write_json(out/'uv-coordinate-validation.json',{'active_layer':me.uv_layers.active.name,'finite':bool(np.isfinite(uv_data).all()),'outside_0_1_coordinates':int(np.count_nonzero((uv_data<0)|(uv_data>1))),'degenerate_uv_triangles':zero_uv,'loops':len(uv_data)})
    p,n,count=raster_material(o,mi,res);mask=count>0;z=p[:,:,2];ax=abs(p[:,:,0])
    chest=mask&(z>.65)&(z<.78)&(ax<.095);skirt=mask&(z>.30)&(z<.60)&(ax<.15)
    a=np.full((res,res,3),.40,np.float32);a[chest]=[1,0,0];a[skirt]=[0,0,1]
    occupancy=np.repeat(mask[:,:,None].astype(np.float32),3,axis=2)*.8;occupancy[count>1]=[1,0,0]
    save_png(out/'preview'/'uv-atlas-bodyshell.png',occupancy[::-1])
    path=out/'preview'/'diagnostic-chest-red-skirt-blue.png';save_png(path,a[::-1])
    # Check interior triangle probes against the actual diagnostic texture pixels.
    me=o.data;me.calc_loop_triangles();uv=np.array([v.uv[:] for v in me.uv_layers.active.data]);positions=np.array([o.matrix_world@v.co for v in me.vertices]);wrong=0;tested=0
    for t in me.loop_triangles:
        if me.polygons[t.polygon_index].material_index!=mi:continue
        pos=positions[list(t.vertices)].mean(0);u=uv[list(t.loops)].mean(0);xx,yy=np.clip((u*res).astype(int),0,res-1)
        expected=None
        if .655<pos[2]<.775 and abs(pos[0])<.09:expected=np.array([1,0,0])
        elif .305<pos[2]<.595 and abs(pos[0])<.145:expected=np.array([0,0,1])
        if expected is not None and count[yy,xx]:tested+=1;wrong+=int(np.max(abs(a[yy,xx]-expected))>.1)
    for i,mat in enumerate(o.data.materials):
        nt=mat.node_tree;outnode=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL');emit=nt.nodes.new('ShaderNodeEmission');emit.inputs['Color'].default_value=(.25,.25,.25,1)
        if i==mi:
            tx=nt.nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(path));uvn=nt.nodes.new('ShaderNodeUVMap');uvn.uv_map=me.uv_layers.active.name;nt.links.new(uvn.outputs[0],tx.inputs['Vector']);nt.links.new(tx.outputs[0],emit.inputs[0])
        nt.links.new(emit.outputs[0],outnode.inputs['Surface'])
    cam=studio(o);sc=bpy.context.scene;sc.cycles.samples=4;sc.render.resolution_x=512;sc.render.resolution_y=640;sc.view_settings.view_transform='Standard'
    for name,pos in [('front',(0,-4,.5)),('back',(0,4,.5))]:
        cam.location=pos;cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(out/'preview'/f'leak-test-{name}.png');bpy.ops.render.render(write_still=True)
    write_json(out/'uv-leak-test.json',{'test':'Red chest and blue skirt in a disposable copy of the shared BodyShell atlas; unrelated materials gray.','resolution':res,'red_texels':int(chest.sum()),'blue_texels':int(skirt.sum()),'overlap_pixels':int(np.count_nonzero(count>1)),'interior_triangle_probes':tested,'wrong_region_probes':wrong,'passed':wrong==0 and not np.any(count>1),'final_textures_modified':False})

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--output',required=True);ap.add_argument('--checks-only',action='store_true');a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.source).resolve();out=Path(a.output).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(source));bpy.context.view_layer.update();source_objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];src=geometry(source_objs)
    src_rig=[(o.name,[b.name for b in o.data.bones]) for o in bpy.context.scene.objects if o.type=='ARMATURE']
    bpy.ops.wm.read_factory_settings(use_empty=True);candidate=out/'Sylvara_Painted_CANDIDATE.glb';bpy.ops.import_scene.gltf(filepath=str(candidate));bpy.context.view_layer.update()
    dst_objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];dst=geometry(dst_objs)
    src_points=src.pop('_unique_points');dst_points=dst.pop('_unique_points')
    # FBX import leaves tiny axis-rotation residues; glTF's axis conversion removes them.
    # A rounded hash can flip at a half-grid boundary, so test the actual displacement too.
    max_delta=float(np.max(np.linalg.norm(src_points-dst_points,axis=1))) if src_points.shape==dst_points.shape else None
    gj=glb_json(candidate);materials=[]
    for m in gj.get('materials',[]):
        pbr=m.get('pbrMetallicRoughness',{});materials.append({'name':m.get('name'),'base_color_texture':pbr.get('baseColorTexture'),'metallic_roughness_texture':pbr.get('metallicRoughnessTexture')})
    result={'source':src,'reimported_glb':dst,'same_position_set':max_delta is not None and max_delta<1e-6,'maximum_world_position_delta':max_delta,'position_tolerance':1e-6,'rounded_position_hash_equal':src['position_set_sha256']==dst['position_set_sha256'],'same_triangle_surface':src['triangle_surface_sha256']==dst['triangle_surface_sha256'],
            'same_triangle_count':src['triangles']==dst['triangles'],'source_armatures':src_rig,'exported_skins':len(gj.get('skins',[])),'exported_animations':len(gj.get('animations',[])),
            'same_triangle_winding':src['triangle_winding_sha256']==dst['triangle_winding_sha256'],
            'materials':materials,'embedded_images':len(gj.get('images',[])),'all_images_embedded':all('bufferView' in i for i in gj.get('images',[])),
            'extensions_required':gj.get('extensionsRequired',[]),'rig_test':'Not applicable: source has no armature, weights or morphs. Rigging is a later assignment.',
            'uv_split_note':'GLB duplicates vertices at UV/material boundaries. Original editable quad mesh retains its vertex and polygon data.'}
    write_json(out/'export-validation.json',result)
    assert result['same_triangle_count'] and result['same_position_set'] and result['same_triangle_surface'],'Export changed geometry; inspect export-validation.json'
    assert result['same_triangle_winding'] and dst['finite_vertex_normals'],'Export changed winding or produced invalid normals'
    assert result['all_images_embedded'] and all(m['base_color_texture'] and m['metallic_roughness_texture'] for m in materials)
    write_json(out/'export-validation.json',result)
    if a.checks_only:
        print('RESULT '+json.dumps({'geometry_preserved':True,'triangle_winding_preserved':True,'finite_normals':True}),flush=True);return
    # Actual imported GLB gets a separate shader/material render, not a source-only beauty render.
    o=dst_objs[0];cam=studio(o);sc=bpy.context.scene;cam.location=(2.7,-4,.56);cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.resolution_x=640;sc.render.resolution_y=800;sc.cycles.samples=8;sc.render.filepath=str(out/'preview'/'glb-reimport-three-quarter.png');bpy.ops.render.render(write_still=True)
    cam.location=(2,-4,.901);cam.rotation_euler=(Vector((-.004,0,.901))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.205;sc.render.resolution_y=640;sc.render.filepath=str(out/'preview'/'glb-reimport-face-three-quarter.png');bpy.ops.render.render(write_still=True)
    # Wireframe is rendered from the imported GLB, in a disposable shader setup.
    for mat in o.data.materials:
        nt=mat.node_tree;output=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL');wire=nt.nodes.new('ShaderNodeWireframe');wire.use_pixel_size=True;wire.inputs['Size'].default_value=.65
        mix=nt.nodes.new('ShaderNodeMixRGB');mix.inputs[1].default_value=(.6,.6,.6,1);mix.inputs[2].default_value=(.015,.015,.015,1);nt.links.new(wire.outputs[0],mix.inputs[0]);emit=nt.nodes.new('ShaderNodeEmission');nt.links.new(mix.outputs[0],emit.inputs[0]);nt.links.new(emit.outputs[0],output.inputs['Surface'])
    cam.data.ortho_scale=1.1;cam.location=(0,-4,.5);cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.resolution_y=800;sc.cycles.samples=4;sc.render.filepath=str(out/'preview'/'glb-wireframe-front.png');bpy.ops.render.render(write_still=True)
    diagnostic(out)
    print('RESULT '+json.dumps({'geometry_preserved':True,'glb_reimported':True,'materials':len(materials),'embedded_images':result['embedded_images']}),flush=True)
if __name__=='__main__':main()
