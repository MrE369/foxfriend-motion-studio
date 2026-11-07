# CoLab connected humanoid mannequin — November 7, 2026

**State: experimental branch; no production merge or deployment.** Base is the actual installed Unified Studio v0.13.1 on `main`. Aster engineering is preparing a small independent feature for Bill and Callie to inspect **before** any publishing.

## Real source asset and diagnosis

User-supplied private file: `Finn_Sylvara_Humanoid_Rig_v01.glb`, 116,596 bytes, glTF 2.0. It is **NOT** committed to the public repository.

- 26 named standard humanoid bones, a skin with 26 joint mappings, 7 small/debug meshes; no finished character skin.
- Embedded clips `Quiet_Idle_v01` (4.0 s) and `Gentle_Wave_v01` (4.25 s), 27 channels each, original rotations plus Hips translation.
- Hierarchy is complete. At rest, global joints multiplied by their glTF inverse-bind matrices differ from identity by at most ~5.25e-8 (floating-point precision), so the skeletal rig is **not structurally disconnected**.
- Original visual guide meshes are narrow cylinders and small spheres. **Both foot and toe guide rods have a real orientation mismatch at rest**: each foot rod's two endpoints each miss the intended joints by 0.05 m (combined 0.10 m), and each toe rod's ends by 0.045 m (combined 0.09 m). This explains some cosmetic gaps without implying a bone hierarchy defect.
- `Root` → `Hips` is an unusually long motion-anchor edge. The new anatomical mannequin omits this non-body rod but preserves the Root bone and its motion/retargeting identity.

## Smallest isolated improvement

`colab/connected-humanoid-mannequin.js`: standalone, deterministic Three.js editor-only overlay, adds no user assets and no remote services. Uses the **imported 26 Three.js Bone objects**, does not alter their parent hierarchy, bind matrices, original material, keyframe curves or loaded animation.

- Connected torso, pelvis, collar, upper/lower arms, leg anatomy, oval head, palms and shoes built from overlapping procedural cylinders and ellipsoids. 23 anatomical bridge segments plus rounded joints. No separated rods or Root-to-Hips trunk.
- Right arm and leg warm peach, left cyan, torso light blue; tiny golden joint centers plus the app's larger existing blue/yellow clickable joint handles.
- Follow **current world-space joint positions on each render frame**. Works with imported built-in GLB animation clips and existing manual/IK pose edits.
- Reference visualization is a **sibling of the loaded GLB scene root**, not a child. `GLTFExporter(root)` therefore never includes the mannequin.
- `Original guides`, `Skeleton lines`, `Connected mannequin`, `Both together` views. Optional transparency, figure framing, reset-to-rest, and shortcuts for the imported idle/wave clips.
- Existing mesh visibility saved before hiding source guide geometry and restored on leaving Motion Studio, switching to Original, clearing the rig, or loading another model.
- Existing mesh-surface-based gesture handler can raycast the displayed mannequin's visible limbs. Existing joint-dots, IK, timeline, pose JSON, and exported GLB are left intact.
- Mode and transparency are optional fields in the existing recovery snapshot. Older saved recovery lacking these fields stays valid.
- Only fully recognized humanoid name mappings enable the mannequin. Other rigs can still show source and line-skeleton views; never infer that a quadruped/bird/serpent should have human proportions.

**This is a reference rig visualization, not a final skinned character model.** The approximate limbs intentionally overlap, and the source animation may still contain foot sliding or stiff timing.

## Verification so far

- JSON/GLB source inspection, joint parenting, rest transforms, glTF skin inverse-bind test: **PASS**.
- JS syntax for the full Advanced Workshop and standalone mannequin module: **PASS**.
- Mock Three.js skeletal runtime using equivalent 26-joint rest positions: **PASS**. Asserts all 23 anatomical bridge geometries, updates to joint movement, source guide hiding/restoration, view switching, combined display, and translucent modes.
- Offline front and three-quarter static comparisons plus 4.25-second `Gentle_Wave_v01` video built from the **uploaded source GLB animation tracks**, using the same approximate anatomical segment layout. These visuals were **not captured from live CoLab or Three.js** and MUST NOT be presented as browser acceptance tests.
- Existing pose, IK, GLB exporter, animation mixer, and main Unified Studio's workspace/tab markup remain in place.

### Still unverified: do not promote

- The entire changed CoLab page with the actual rig in Chrome, Android PWA or Xbox Edge, including WebGL shading, memory and touch behavior.
- The visible figure's quality in the actual Three.js runtime and whether limbs always appear joined during the clips.
- End-to-end `Load GLB → Pose/IK → capture → animated GLB export → reimport` with the real rig.
- Recovery restoration on an installed phone.
- Naturalness, foot contact or retargetability into Godot (these require Bill and Callie's visual approval).

## Artist acceptance path (requires approved staging preview)

1. Load the existing humanoid GLB in the existing CoLab app's Advanced Workshop, open **Motion Studio**.
2. Compare **Original guides / Skeleton lines / Connected mannequin / Both together** with the same view, plus translucent toggle; no guides should disappear forever.
3. Play `Quiet_Idle_v01` and `Gentle_Wave_v01`, pause, scrub and orbit. Confirm the mannequin follows the skeleton without detached rods.
4. Tap an actual mannequin limb, test the existing yellow joint dot and hand/foot IK drag; ensure the camera doesn't steal the drag.
5. Capture two poses, save/reopen pose JSON, export animated GLB, reimport, confirm all clips and parent transforms survive.
6. Save and restore a different model before/after changing mannequin views; verify original rig contents unchanged.
7. On desktop then phone, evaluate touch controls, memory, GPU and visibility transitions.
8. Bill/Callie decide on joint colors, proportions, body thickness and gesture naturalness. Iterate on the smallest display-only changes; **do not touch original rig data to fix appearances**.

Production still uses Unified v0.13.1. **Do not merge or deploy this experimental branch until approval and browser acceptance.** The experimental earlier #10 skeleton-visualization PR stays separate and is not required.

## Common motion interchange — draft only, NOT implemented

A future universal importer should process motion regardless of body topology:
`format: fands-motion-recipe-v1`, `sourceRig{kind,id,joints,parentIds,restTransforms,coordinateSystem}`, `clips[{name,duration,frames:[{time,rotations,rootTranslation,confidence}],contacts,phases}]`, `mapping{sourceBone:targetBone}`, `provenance{source,referenceIds,license}`, `revisions[...]`.

Require a preflight validation: explicit matching or confirmed retarget map, unique joint IDs, finite/unit quaternions, monotonic timestamps, rest-relative transforms and sensible root scales. Reject unknown mapping and never silently assign human joints to animals. BVH can be a lossy interchange option; editable versioned JSON and final GLB remain separate. Reference video/images stay local unless separately approved. Import UI, retargeting, variable-time keyframes and video extraction belong to future milestones.
