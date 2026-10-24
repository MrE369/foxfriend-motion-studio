# S-04 — Rigged Female Superhero Sculpt Proof (2026-10-23)

**Status:** offline mesh/animation structural experiment PASS; browser visual acceptance PENDING.  
**Branch:** `experiment/rigged-female-sculpt-s04-20261023`; branched from S-02.  
**Safety:** no production or game repo modifications; original Quaternius ZIP unchanged; no binary assets committed.

## Actual inputs (uploaded CC0 Standard packs)

- `Universal Base Characters[Standard].zip` → `Base Characters/Godot - UE/Superhero_Female_FullBody.gltf` + BIN and seven PNG textures.
- `Universal Animation Library[Standard].zip` → `Unreal-Godot/UAL1_Standard.glb` (non-root-motion).
- These models and their 65-joint hierarchy were inspected directly. The base body has three skinned meshes (Eyebrows, Eyes and Superhero_Female), 15,060 total triangles, 7,376 vertices and 12,812 triangles on the main body, and zero embedded clips originally.

## What was implemented

The main body only received a topology-preserving position edit:
- Shoulder factor `+0.0325`; waist `-0.0225`; chest `+0.0175`; actual displaced vertices: **1,725**.
- Gaussian anatomical falloff modulated by the already-authored joint skin weights for spine, pelvis and clavicle/upper arm.
- Six smoothing passes on the influence mask, including coincident UV seam vertices, to avoid the edge strain and flipped triangle defects encountered in the earlier full-strength experiment.
- **Maximum surface displacement: 4.081 mm**. This is a deliberately subtle first safety pass, not an approved final silhouette.
- No edits to skin indices, skin weights, inverse bind matrices, bones, node transforms, UVs, texture references or animation clips; the original normals are retained pending shading review.

## Rejected initial attempt (important failure)

At double the final effect strength without smoothing, the candidate had 1 reversed triangle in some sprint frames, and the edge-ratio floor fell below the .80 threshold in numerous poses. A seemingly valid rest pose was **not** enough. The first attempt was rejected, not silently accepted.

## Actual validation results

- Source rest-pose body: 12,812 triangles; **0 newly inverted / collapsed**; edited rest minimum edge ratio **0.9547**, maximum **1.0477**.
- **18/18 posed structural checks passed:** six real Quaternius clips sampled at 0%, 50%, and 95% of each duration, performing CPU linear-blend skinning using the source's 65 original joint and inverse bind matrices.
- Among tested poses minimum relative edge ratio **0.9015**, maximum **1.0856**; no additional inverted or degenerate triangles compared with source.
- Embedded clips: `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Land`, `Interact`, with 195 channels each (1,170 total).
- Two GLBs, one original body and one modified body, were exported with the same six animation clips and seven downsampled embedded PNG textures; each is **4,474,328 bytes**, imports in trimesh as 3 meshes / 15,060 triangles.
- Binary comparison finds **10,835 changed bytes** confined to the edited POSITION bufferView. Skins, nodes, meshes, materials, textures, image descriptions, and embedded animation buffers are identical.
- Python source and JSON reports are in the local downloadable S-04 proof archive, not committed to the public repo.

## CoLab source changes

- `labs/ik-facial/rigged-female-s04.js` — new deterministic guarded source->candidate deformation and topology validation, with exact skeleton/body gate.
- `labs/ik-facial/sculpt-tools.js` — new artist-facing application and Undo for cloned skinned geometry; brush sculpting still refuses skinned meshes; existing static sculpting is unchanged.
- `labs/ik-facial/director.html` — S-04 experimental control and strength slider inside existing Assemble/Sculpt interface.
- `labs/ik-facial/rigged-female-s04.test.mjs` — synthetic 7,376-vertex body tests: rig/strength gates, actual deformation, immutability of input weights and coordinates, exact 0% restore.

**Constraints:** Only source mesh `Superhero_Female` with exactly 7,376 vertices, a 65-joint skeleton and verified Quaternius bone names is permitted in this S-04 browser pilot. It does not support arbitrary rigged characters and does NOT automatically adapt independent clothing. Increasing strength beyond the offline-tested defaults is intentionally unavailable.

## What remains unverified

- Real Three.js render and animation-mixer playback, on-phone control interaction, shading from retained source normals, visual limb joint continuity, clothing clipping and Xbox Edge performance.
- Animation Library and source body rest poses differ in some joints; even a correct target-name match and sampled triangle checks do not prove natural-looking movement.
- No Blender `bpy` backend has run. This S-04 experiment was performed with direct Python glTF/GLB geometry edits and a JS CoLab pilot.
- The stable CoLab deployment and Finn/Sylvara game have not been changed.

## Reproduction / local review

Obtain the proof archive from this conversation. Both original and athletic GLBs have six clips and can be imported into CoLab separately. Compare front, side and three-quarter static views, then visually verify idle/walk/sprint/jump playback where supported. Only promote once the human artist approves the silhouette and real browser animation.

## Next technical task

Browser acceptance test on a separate preview build; verify clip playback with this exact edited GLB. Then investigate controlled rig/joint compensation and clothing rebinding before allowing stronger sculpt parameters or use on canonical Sylvara.
