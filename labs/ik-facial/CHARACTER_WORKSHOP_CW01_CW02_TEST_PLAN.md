# Character Workshop CW-01 / CW-02 — isolated experimental implementation

**Branch:** `experiment/quaternius-character-workshop-cw01-20261023`  
**Base:** `experiment/colab-director-release-lab-20261022` at `d3f3df295acea74a9bb818dfb411087fa25e6a86`  
**Stable site:** unchanged. No production deployment is authorized.

## Scope achieved in code (subject to real-asset testing)

- New local-only import of standalone **.glb** or **.gltf with matching .bin and texture companions**, without network fallback; Android multi-file picker uses no restrictive MIME filters.
- Per-selected-model rig/mesh inspection: meshes, triangles, vertices, UVs, skin attributes, approximate weight normalization, bone hierarchy, material/texture count, clip list, dimensions.
- Downloadable `CoLab_Character_Inspection.json`.
- Separate **animation file import** (GLB/glTF), clip selector, pause/play/stop, looping and scrubbing, all attached to the selected character's Three.js `AnimationMixer`.
- External clip matching is **strict**: all animation target nodes must exist uniquely, animated bone names must retain the same bone-parent relationships; no missing tracks silently ignored.
- Guard against exporting separately skinned GLBs as if clothing were equipped to a unified skeleton. A selected external animation is included in the export only after compatibility validation.
- Original GLBs never overwritten; loaded data and modifications remain in browser memory until explicit export.

## What this does NOT establish

- Actual compatibility of Quaternius **Standard/free** files is **not yet demonstrated**. They are not present in the conversation workspace.
- **ZIP import, FBX, OBJ**, automatic retargeting, shared-skeleton skin transfer and clipping-aware outfit fitting are not implemented.
- External clip matching is based on names and bone hierarchy. Bind pose, limb orientation, root motion, foot placement, deform quality and clip fidelity still require animation tests.
- No automated measurement of visual likeness or human approval of deformations.
- A successful source-code syntax check or GitHub commit does not mean a browser/mobile/Egde demo has passed.
- GLB export/reimport with animated Quaternius clothing remains a required verification, not a proven result.

## Asset intake

Quaternius official pages say **CC0** for all three packs, including **Standard/free** downloads:
- [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) (gltf, FBX; source-only rigged .blend is not presumed available)
- [Modular Character Outfits – Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) (gltf, FBX)
- [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (GLB/FBX; Source .blend is not presumed available)

Record exact ZIP names, manifest, version and any included license before checking a compatibility claim. Do not commit private character artwork or binary assets as test fixtures.

## Deterministic checks already executed

Eight pure-JS checks (via V8) passed covering import classification, path resolution, missing companion refusal, rejection of HTTP/traversal paths, duplicate filename rejection, exact animation bone matching, missing animation target rejection, and incompatible hierarchy rejection. HTML ID references and module syntax checks passed.

**Not yet run:** Node test runner directly; browser runtime load; direct compatibility with the three Quaternius packs; Xbox Edge smoke test.

## Real-device acceptance tests

1. Open the **isolated branch** via a test deployment (only if authorized), choose Assemble, select the male/female **free** Universal Base glTF with all files it references (or a standalone GLB if included).
2. Read the inspector: mesh count, skeleton bone names, skinned meshes, UV status and material/texture count. Download JSON.
3. Load one compatible Fantasy Outfit glTF, observe both objects in scene. Audit its bones and deformation; **do not claim it is equipped** before skeleton-sharing tests.
4. Load one Universal Animation Library GLB into the animation importer. Select a locomotion clip, run strict match. If rejected, export diagnostics instead of forcing playback.
5. Where an exact hierarchy match exists, play, pause, scrub and loop. Inspect head, shoulders, elbows, wrists, hips, knees and feet and root movement.
6. Test animation with the wrong skeleton and require a clear refusal, not a silent partial result.
7. Test basic reversible position/rotation/scale adjustment on an **unskinned** component; undo and verify restoration.
8. Export a **single rigged character** with validated chosen clip, reimport in Inspect, and verify geometry, skin weights, animation and texture fidelity. When body and outfit are separate skinned GLBs, require explicit export refusal with explanation.
9. Test a broken glTF companion link: no network fetch and clear error. Test Android file picker and browser scroll to the Character Workshop panel.
10. Repeat final asset in actual **Finn & Sylvara Three.js** game on available hardware. Xbox Edge test remains a separate hardware gate.

## Next engineering step

Receive the free Standard ZIPs (or one extracted body glTF with all companions + one outfit + one animation GLB), enumerate exact paths, compare bone hierarchies and bind transforms, then implement safe outfit binding and verified animation transfer.

