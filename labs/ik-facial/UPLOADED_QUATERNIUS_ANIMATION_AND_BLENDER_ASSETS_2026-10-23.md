# Uploaded archive audit — 2026-10-23

No source binary assets were committed. Read-only inspection of the two user-supplied ZIP files.

## Universal Animation Library[Standard].zip — Quaternius, CC0

Archive includes `License.txt` explicitly stating **CC0 1.0 Universal**, and a README explaining that files ending in `_RM` have baked root motion while the standard files do not.

Files for the Unreal-Godot workflow:
- `Unreal-Godot/UAL1_Standard.glb`: 7,618,436 bytes, 43 named animation clips, 65 skeleton joints, 1 glTF skin, two mannequin mesh primitives (13,744 triangles), zero image textures, 67 nodes.
- `Unreal-Godot/UAL1_Standard_RM.glb`: 7,620,504 bytes, **same 43 clips and 65 joint names**, baked root movement.

Unity versions are `Unity/UAL1_Standard.fbx` and `Unity/UAL1_Standard_RM.fbx`; each ~23.8MB uncompressed.

Representative non-RM animation names: `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Loop`, `Jump_Land`, `Roll`, `Interact`, `Punch_Jab`, `Spell_Simple_Shoot`, `Sword_Attack`.

The glTF rig uses joint names including `root`, `pelvis`, `spine_01`, `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`, `foot_l`, and `Head` — **not** Mixamo's `mixamorig:*` names.

### Root translation sanity check
For the `root` node's translation accessor:
- `Walk_Loop`: standard XYZ range [0, 0, 0], RM [0, 0, 1.3].
- `Sprint_Loop`: standard XYZ range [0, 0, 0], RM [0, 0, 5.5].

These measurements were taken directly from the glTF accessors in the original ZIP GLB binaries. Non-RM is the recommended first test for character movement driven by the existing Three.js controller. These accessors alone do **not** verify full animation fidelity on a target character.

## human-base-meshes-bundle-v1.4.1.zip — Blender Studio (not Quaternius)

Contains one Blender-native `human_base_meshes_bundle.blend` (~49.4 MB), catalog text, and 25 PNG thumbnails. Stylized male/female bodies, heads, hands, eyes, and feet appear in the thumbnails.

This file is the official Blender Studio Human Base Meshes v1.4.1 asset bundle, listed as **CC0** in Blender's demo files listing. The ZIP itself has no explicit standalone license text. The .blend project **cannot be decoded by the CoLab browser**; a Blender worker or local Blender export is required. The PNG files can be imported as references only.

## Integration changes

The experimental CoLab importer now exposes a separate **Import animations without mannequin** action when the previewed GLB has clips. This allows the full `UAL1_Standard.glb` archive item to become a Character Workshop animation donor without inserting the rigged mannequin into the working scene.

**Not verified yet:** A real browser import of the archive, the full Three.js AnimationMixer on a Quaternius Universal Base Characters target, retargeting to existing Mixamo-named Finn/Sylvara, or export with clothed humanoid skinning.

**Next missing source:** Quaternius **Universal Base Characters Standard ZIP**, ideally followed by Modular Fantasy Outfits Standard ZIP. Without a compatible Quaternius body, playback compatibility cannot yet be established.

Do not treat the Blender Studio human base .blend as a substitute for the Quaternius Universal Base Characters pack.
