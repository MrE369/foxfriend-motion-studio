# Laptop verification — November 3, 2026

Issue #7, branch `experiment/sylvara-master-painter-launcher-20261103`.

## Launcher observed tests

- Installed a real `Start AI Painter.lnk` on the Windows Known Folder desktop. Target is Windows PowerShell; arguments explicitly identify the installed runner and Documents workspace; working directory and icon were reread and compared.
- Workspace: the user's Known Folder Documents directory, `Finn-Sylvara-AI-Painter`. On this laptop Windows redirects Documents and Desktop through OneDrive.
- Existing Codex CLI 0.166.0-alpha.5.1 authenticated through ChatGPT. Actual shortcut execution started `codex exec` in workspace-write mode, wrote and reread a disposable marker, and exited 0. This bounded launcher test did not perform artistic work; the full Blender pipeline was separately executed headlessly by the active Codex session.
- Missing-model and missing-reference tests stopped before AI execution with exit 10 and 11. Installed `-CheckOnly` found one model, five references and the authenticated executable.
- Changed installer-owned files and pre-existing shortcut versions were backed up under workspace `installer-backups/<timestamp>`. No global Codex/MCP, Blender preferences or production files were edited.

## Asset checks actually performed

- Blender 5.2.2 LTS, bundled Python 3.13.13 and NumPy. No new Python dependencies or paid texture services.
- Imported the supplied blank FBX: one mesh, 27,235 vertices, 29,457 polygons, 53,051 triangles. No UVs, rig, skin groups or morphs were present.
- Retained editable original polygon geometry; added material/UV data on a copy. Native Smart Project's measured skin overlap caused that attempt to be stopped. Independent per-polygon charts gave zero measured interior overlaps at output resolution.
- Created 12 semantic material surfaces, 24 embedded base-color/metallic-roughness images, packed editable Blender source and standalone PNGs.
- Reimported actual GLB: identical triangle surface and position set within 1e-6 source units (maximum difference approximately 4.10e-8 from axis conversion), 53,051 triangles. Seam vertices increase to 111,965.
- Finite UV coordinates, zero out-of-range coordinates and zero degenerate UV triangles. Chest/skirt diagnostic: 8,514 probes, zero cross-region failures; front/back diagnostics rendered and inspected.
- Artist-requested eye revision: full exposed sclera contours, larger higher-centered blue irises, dark lash rims. Geometry and UVs unchanged. Front, unlit and actual exported GLB angled face views inspected.
- Godot 4.7.2 standard: disposable project import and resource inspection exited 0, 12 surfaces and 53,051 triangles, no missing albedo/roughness/metallic textures. Compatibility was selected; this was a headless resource check, not a gameplay or frame-rate test.
- PowerShell parser, bundled Python compilation, and `git diff --check` passed.

## Honest limits

The artwork remains a candidate for artist review. The source's open/nonmanifold edges and 18 near-zero-area triangles are preserved, not repaired. No rig, morphs or animation were added; rigging was explicitly deferred by the artist. Garment boundaries and lining need artistic review. Eye/cornea topology was not rebuilt. There is no baked AO or normal-map claim.

Per-polygon UVs trade efficiency and 2D paint convenience for collision safety. Twelve surfaces, seam vertex growth and atlas texel density need optimization/target-device testing before shipping. Existing sculpted facial proportions differ from the 2D references.

Godot editor-settings save warnings and a Blender optional extension-cache write warning occurred in the restricted process environment. Asset checks completed; global settings were not modified.

Private models, references, maps, renders and logs remain outside this public repository. Only reusable scripts and workflow documentation are versioned here. No merge or deployment was performed; issue #7 remains open for artist acceptance.
