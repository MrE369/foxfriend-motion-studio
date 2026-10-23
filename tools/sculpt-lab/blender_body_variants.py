"""S-02 experiment: headless Blender native operator for Blender Studio body.

Trusted local usage only:
  blender --disable-autoexec --background HUMAN_BASE_BUNDLE.blend \
    --python tools/sculpt-lab/blender_body_variants.py -- --output DIRECTORY

Do not run arbitrary Python/embedded .blend scripts. This script is for a
controlled source asset and runs AFTER Blender has loaded the source project.
The CoLab web page cannot execute Blender directly.
"""
import bpy, sys, math, pathlib, json, time
PRESETS={
 "original":dict(shoulders=0.,waist=0.,chest=0.),
 "athletic":dict(shoulders=.065,waist=-.035,chest=.035),
 "lean":dict(shoulders=-.025,waist=-.070,chest=-.012),
 "heroic":dict(shoulders=.10,waist=-.025,chest=.055)
}
def smooth(a,b,v):
 t=max(0.,min(1.,(v-a)/(b-a)));return t*t*(3-2*t)
def bell(v,c,w):return math.exp(-.5*((v-c)/w)**2)
def deform_positions(vertices,shoulders=0.,waist=0.,chest=0.):
 for name,value in dict(shoulders=shoulders,waist=waist,chest=chest).items():
  if not isinstance(value,(int,float)) or not math.isfinite(value) or abs(value)>.12:
   raise ValueError("Invalid anatomy parameter "+name)
 coords=[tuple(v) for v in vertices]
 if not coords:raise ValueError("Mesh contains no vertices")
 xmin=min(v[0] for v in coords);xmax=max(v[0] for v in coords)
 ymin=min(v[2] for v in coords);ymax=max(v[2] for v in coords)
 h=ymax-ymin
 if h<.05 or h<1.25*(xmax-xmin):raise ValueError("Expected upright Z-up body")
 xs=sorted(v[0] for v in coords);ys=sorted(v[1] for v in coords)
 cx=xs[len(xs)//2];cy=ys[len(ys)//2]
 out=[]
 for x,y,z in coords:
  dx=x-cx;dy=y-cy;t=(z-ymin)/h
  shoulder=bell(t,.815,.073)*smooth(.035,.16,abs(dx))
  waistw=bell(t,.575,.070)*smooth(.015,.095,abs(dx))
  chestw=bell(t,.72,.078)*smooth(.01,.065,abs(dy))
  out.append((cx+dx*(1.+shoulders*shoulder+waist*waistw),
              cy+dy*(1.+chest*chestw),z))
 return out
def run(outdir):
 source=bpy.data.objects.get("GEO-body_male_stylized")
 if source is None or source.type!="MESH":
  raise RuntimeError("Expected GEO-body_male_stylized MESH in loaded Blender Studio bundle")
 if source.modifiers or source.data.shape_keys or source.find_armature():
  raise RuntimeError("Source unexpectedly has modifiers, shape keys or armature: inspect manually")
 source_coords=[tuple(v.co) for v in source.data.vertices]
 original_faces=len(source.data.polygons)
 results=[]
 for name,settings in PRESETS.items():
  obj=source.copy();obj.data=source.data.copy();obj.name="CoLab_S02_"+name
  bpy.context.scene.collection.objects.link(obj)
  target=deform_positions(source_coords,**settings)
  for v,co in zip(obj.data.vertices,target):v.co=co
  obj.data.update()
  if len(obj.data.vertices)!=len(source_coords) or len(obj.data.polygons)!=original_faces:
   raise RuntimeError("Topology unexpectedly changed")
  # Object transform reset because Blender source assets live in a layout grid.
  obj.location=(0.,0.,0.);obj.rotation_euler=(0.,0.,0.);obj.scale=(1.,1.,1.)
  for other in bpy.context.selected_objects:other.select_set(False)
  obj.hide_set(False);obj.select_set(True);bpy.context.view_layer.objects.active=obj
  destination=outdir/("BlenderStudio_BPY_"+name+".glb")
  bpy.ops.export_scene.gltf(filepath=str(destination),export_format="GLB",
    use_selection=True,export_animations=False)
  results.append({"name":name,"vertex_count":len(obj.data.vertices),"face_count":len(obj.data.polygons),
    "parameters":settings,"file":str(destination)})
  bpy.data.objects.remove(obj,do_unlink=True)
 (outdir/"BlenderStudio_BPY_S02_report.json").write_text(json.dumps(results,indent=2))
if __name__=="__main__":
 args=sys.argv
 if "--output" not in args:raise SystemExit("Provide --output <local-output-directory> after --")
 directory=pathlib.Path(args[args.index("--output")+1]).expanduser().resolve()
 if not directory.is_dir():raise SystemExit("Output directory must already exist")
 run(directory)
