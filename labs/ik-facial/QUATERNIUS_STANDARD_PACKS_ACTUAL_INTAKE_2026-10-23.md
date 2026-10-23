# Quaternius actual Standard packs — intake results (2026-10-23)

**Assets inspected read-only.** No copyrighted user references or binary Quaternius resources committed. Originals remain outside Git.

## Archive facts
- `Universal Base Characters[Standard].zip`: 128,968,391 compressed bytes, 132,571,039 expanded bytes, 128 archive entries. 18 glTF+BIN model pairs, 26 FBX, 48 PNG. Includes a Standard-edition **CC0 1.0** license.
- `Modular Character Outfits - Fantasy[Standard].zip`: 294,347,394 compressed bytes, 305,995,429 expanded bytes, 136 entries. 24 glTF+BIN pairs, 24 FBX, 46 PNG and 1 JPG. Includes a Standard-edition **CC0 1.0** license.
- `Universal Animation Library[Standard].zip`: 15,904,933 compressed bytes, 63,648,179 expanded bytes. Includes non-root-motion and root-motion GLBs and FBXs and a **CC0 1.0** license.

**Critical importer bug previously:** full Base (129MB) and Outfits (294MB) exceed older 115MB-compressed and 185MB-expansion limits. Solved provisionally at source level by `zip-indexed-reader.js`: reads just the central directory, exposes virtual indexed files and extracts a selected model/BIN/textures on demand. Each selected entry remains limited to 65MB; compressed archives up to 410MB. ZIP64/encrypted/symlink/path-traversal archives are blocked. This approach avoids eagerly inflating 306MB of outfit content on Android. Browser device validation is pending.

## Real GLB/glTF content
- Base `Superhero_Male_FullBody.gltf`: three meshes, 65-joint skin, no embedded animation, 7 external PNG references + BIN. Female matches the 65 names.
- `Male_Ranger.gltf` complete outfit: 9 meshes (10 glTF primitives), one 65-joint skin, 6 material image references + BIN, no embedded animations.
- Female Ranger and male/female Peasant outfits also use one 65-joint skin. Separate modular part glTFs similarly carry skinned meshes.
- `UAL1_Standard.glb`: 65-joint rig, 43 clips, same 65 joint names and hierarchy as the Base and Ranger outfits.
- **Not exactly identical rest poses:** base/garment body vs animation mannequin have different local translations/rotations for some limbs/spine. Name/hierarchy compatibility does **not** itself establish motion fidelity or correct retargeting.

## Source ZIP defect detected
The male/female Base character glTF references three filenames **not actually contained** in the Standard ZIP:
- `T_Eye_Normal_png.png` (male and female), but corresponding sibling is `T_Eye_Normal.png`.
- `T_Hair_1_Normal_png.png` (male), but corresponding sibling is `T_Hair_1_Normal.png`.

The importer now implements **strictly limited, reported alias recovery** only for an `_png.png` reference whose exact `.png` sibling exists in the same directory. It creates an in-memory alternate name; the original ZIP and texture bytes remain unchanged. A warning is shown to the artist. All 24 Fantasy Outfit glTF references resolved without such repair.

## Actual test artifacts (generated locally, NOT committed)
- `Quaternius_Male_Ranger_Animated_CoLab_TEST.glb`: 41,437,628 bytes, full six original embedded PNG textures, single Ranger armature/skinned outfit, six embedded clips.
- `Quaternius_Male_Ranger_Animated_MOBILE_TEST.glb`: 7,698,064 bytes, six resized 1024x1024 PNGs for phone inspection, same armature and six clips.
- Embedded clips: `Idle_Loop`, `Walk_Loop`, `Sprint_Loop`, `Jump_Start`, `Jump_Land`, `Interact`.
- Output GLB JSON/BIN validity, binary views, skin joint targets, 1,170 animation target channels, and texture embedding were structurally verified by Python; `trimesh` successfully reimported model geometry (10 primitives), with plausible 1.869m vertical span.
- **Not yet verified:** live Three.js playback and deforming silhouette, appearance in CoLab, or loaded file behavior on Xbox Edge.
- Ranger outfit test **does not include Finn's approved head**. These are temporary Quaternius pipeline fixtures, not an artistic replacement for Finn or Sylvara.

## New experimental code
- `zip-indexed-reader.js`: ZIP central-directory indexing + lazy entry extraction with CRC check.
- `asset-dependency-hydrate.js`: selective glTF/OBJ resource materialization, strict diagnostic path handling and reported known-name alias recovery.
- `universal-import-ui.js`: catalogue from large ZIP without inflating entire pack.
- Separate `Import animations without mannequin` action for rigged Universal Animation Library GLBs.

## Next acceptance gates
1. **Real browser:** preview Base Male or Female from the full 129MB ZIP without exhausting phone memory; see color/normal maps, diagnose alias warnings.
2. Preview and accept Ranger model from full 294MB ZIP, inspect its independent skinning.
3. Use 16MB animation ZIP to import `UAL1_Standard.glb` as a *donor* without adding mannequin geometry.
4. Verify animation retarget/stability (particularly local bind-pose differences) and work toward a single shared-rig character: do not merely pile separate independent skins in the scene.
5. Run GLB export/reimport audit and visual deformation test on Android and game runtime. Production site remains untouched.
