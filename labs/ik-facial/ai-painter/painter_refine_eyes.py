"""Versioned eye/lash correction on an existing candidate, without rebuilding UVs."""
import bpy,sys,argparse,shutil,json,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from painter_pipeline import References,make_textures,render_review,write_json
from painter_audit import mesh_signature

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--previous',required=True);ap.add_argument('--output',required=True);ap.add_argument('--references',required=True);ap.add_argument('--face-only',action='store_true')
    a=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);old=Path(a.previous).resolve();out=Path(a.output).resolve();t=time.time()
    if out==old:raise ValueError('Use a new version folder')
    out.mkdir(parents=True,exist_ok=False);(out/'textures').mkdir()
    for p in (old/'textures').glob('*.png'):shutil.copy2(p,out/'textures'/p.name)
    for name in ['02_reference_palette.json','03_surface_plan.json','geometry-preservation.json']:
        shutil.copy2(old/name,out/name)
    bpy.ops.wm.open_mainfile(filepath=str(old/'Sylvara_Painted_EDITABLE.blend'));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');baseline=mesh_signature(o)
    names=[m.name.removeprefix('Sylvara_') for m in o.data.materials]
    changed=make_textures(o,names,References(Path(a.references).resolve()),out,only={'BodyShell'})
    for im in bpy.data.images:
        if im.source=='FILE' and (out/'textures'/Path(im.filepath).name).exists():im.filepath=str(out/'textures'/Path(im.filepath).name)
    assert baseline==mesh_signature(o),'Eye paint modified geometry'
    uv=json.loads((old/'uv-texture-audit.json').read_text());uv['materials']=[next((m for m in changed if m['material']==r['material']),r) for r in uv['materials']]
    for r in uv['materials']:
        for key in ['base_color','orm']:r[key]=str(out/'textures'/Path(r[key]).name)
    write_json(out/'uv-texture-audit.json',uv)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'Sylvara_Painted_EDITABLE.blend'))
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.export_scene.gltf(filepath=str(out/'Sylvara_Painted_CANDIDATE.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_apply=False)
    render_review(o,out,face_only=a.face_only)
    write_json(out/'eye-refinement.json',{'parent':str(old),'changes':['Sclera extends across measured full exposed eye surfaces','Larger and vertically centered blue irises','Dark upper lash rims and subtle lower rim','No eye geometry, silhouette or UV changes'], 'geometry_identical_to_parent':True,'seconds':time.time()-t})
if __name__=='__main__':main()
