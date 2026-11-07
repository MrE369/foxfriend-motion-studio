extends SceneTree
## Run only inside a disposable Godot project after its GLB import completes.

var rows: Array = []
var triangles := 0
var vertices := 0
var missing_textures := 0
var skeletons := 0

func inspect_node(node: Node) -> void:
	if node is Skeleton3D:
		skeletons += 1
	if node is MeshInstance3D and node.mesh != null:
		var mesh: Mesh = node.mesh
		for surface in range(mesh.get_surface_count()):
			var arrays := mesh.surface_get_arrays(surface)
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			var points: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var uv: PackedVector2Array = arrays[Mesh.ARRAY_TEX_UV]
			var mat := mesh.surface_get_material(surface)
			var base_ok := false
			var rough_ok := false
			var metal_ok := false
			if mat is StandardMaterial3D:
				base_ok = mat.albedo_texture != null
				rough_ok = mat.roughness_texture != null
				metal_ok = mat.metallic_texture != null
			var surface_triangles := int(indices.size() / 3) if indices.size() > 0 else int(points.size() / 3)
			triangles += surface_triangles
			vertices += points.size()
			if not base_ok or not rough_ok or not metal_ok:
				missing_textures += 1
			rows.append({"node": node.name, "surface": surface, "triangles": surface_triangles,
				"vertices": points.size(), "uv_vertices": uv.size(), "material": mat.resource_name if mat else "",
				"base_color_loaded": base_ok, "roughness_loaded": rough_ok, "metallic_loaded": metal_ok})
	for child in node.get_children():
		inspect_node(child)

func _initialize() -> void:
	var packed := load("res://Sylvara_Painted_CANDIDATE.glb") as PackedScene
	if packed == null:
		push_error("Candidate GLB did not import as a scene")
		quit(1)
		return
	var character := packed.instantiate()
	root.add_child(character)
	inspect_node(character)
	var passed := triangles == 53051 and rows.size() > 0 and missing_textures == 0 and skeletons == 0
	var report := {"engine": Engine.get_version_info(), "rendering_method_requested": "gl_compatibility",
		"mode": "headless import/resource validation; no GPU frame-rate or deformation claim",
		"triangles": triangles, "render_vertices": vertices, "surfaces": rows, "skeletons": skeletons,
		"missing_material_textures": missing_textures, "passed": passed,
		"rigging": "Deferred by artist; source FBX has no skeleton, weights or facial morphs."}
	var file := FileAccess.open("res://godot-import-validation.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("GODOT_IMPORT_RESULT ", JSON.stringify({"passed": passed, "triangles": triangles, "surfaces": rows.size(), "missing_textures": missing_textures}))
	character.queue_free()
	quit(0 if passed else 1)
