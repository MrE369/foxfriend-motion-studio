# CoLab Universal Asset Import — experiment, 2026-10-23

**Branch:** `experiment/colab-universal-import-cw-20261023`  
**Based on:** `experiment/quaternius-character-workshop-cw01-20261023` at `992d2007b0e165523b08762ab3cafb96d5f09fc7`  
**Production:** unchanged. GitHub commits are isolated. Cloudflare preview builds are currently **queued**, not a verified deployment.

## Implementation scope

The original CoLab Director Lab's **Assemble** tab now has a **unified import catalogue**:

1. **Select files / ZIP** or **Select folder** (where directory pickers exist); desktop drag-and-drop.
2. Scan a ZIP's central directory before extraction. Limit archive to 115 MiB compressed, 185 MiB uncompressed, 1400 entries, 65 MiB per file, ratio ≤180. Refuse encrypted, ZIP64, symlink, traversal, duplicate or malformed archives.
3. Catalogue models ahead of hundreds of images; explicitly choose a candidate. `.bin`/`.mtl` do not appear as standalone model choices.
4. Preview model in a **separate Three.js group**. The working scene is hidden during preview and is unchanged until "Add preview to scene".
5. Import via pinned Three.js 0.164.1:
   - GLB through `GLTFLoader.parseAsync`.
   - glTF + BIN + texture references through a path-preserving `LoadingManager.setURLModifier` with no network fallback, and ambiguous/missing-file refusal.
   - FBX via `FBXLoader.parse` (geometry, supported materials, bones, compatible animation clips). This is not a universal FBX-conversion guarantee.
   - OBJ + MTL via `OBJLoader`/`MTLLoader` (static geometry).
   - PNG/JPG/WebP are **reference-image** library inputs; full paint/material assignment is not yet supported by this importer.
   - BLEND displays an explicit "needs configured Blender worker" error. No Blender backend is connected and nothing is uploaded.
6. Existing Assemble transforms/sculpting and Character Workshop animation controls remain separate from staging.
7. Record import paths, warnings, source SHA-256 where browser crypto is available.
8. GLB export performs a **GLTFLoader roundtrip parse**, structurally compares triangles, mesh count, bone count, skinned meshes, clip count and track count, and blocks download if these change. A downloadable JSON report includes source provenance, warnings and before/after stats.
9. Existing guard against claiming two separate skinned assets are a single unified rig remains active.

## Code files

- `labs/ik-facial/director.html`: original Assemble page with import panel and Three loaders/import map.
- `labs/ik-facial/assembly-tools.js`: staged preview admission and export checks.
- `labs/ik-facial/gltf-local-intake.js`: enhanced scoped resource resolver.
- `labs/ik-facial/zip-safe-import.js`: bounded ZIP parser and fflate-based extraction.
- `labs/ik-facial/universal-loaders.js`: FBX/OBJ/image adapters.
- `labs/ik-facial/universal-import-ui.js`: catalogue, image/model preview, approve/reject.
- `labs/ik-facial/export-roundtrip-check.js`: structural GLB export/reimport gate.
- `labs/ik-facial/character-workshop.js`: accept animation-only scene to library.
- `labs/ik-facial/universal-import.test.mjs`: 15 executable pure JS regression fixtures.

### What has actually been verified

- Full Javascript module and inline-script **syntax checks**.
- HTML control ID references and duplicate IDs.
- **15/15 pure-JS runtime tests** (in V8) for genuine stored-ZIP byte layout, path safety, missing/ambiguous glTF BIN & texture dependencies, OBJ MTL references, format classifications and detection of export clip loss.
- Official Quaternius pack pages mark their asset downloads as CC0. We have **not inspected the contents of the three free ZIP packages**.

### What has NOT been verified

- End-to-end browser import with real Three.js loaders, ZIP decompression via fflate in Android Chrome, supported FBX variants or actual Quaternius files.
- Skin compatibility between Quaternius body/outfit/animation source packs.
- Export of an *animated dressed character* with a genuine shared rig.
- Actual size/performance and memory use on the Android phone or Xbox Edge.
- An operational headless Blender converter.
- Texture image editing, FBX retargeting, ZIP64 or packed archive sizes above mobile guard.

**No syntax or pure-JS test counts as visual/animation acceptance.**

## Required real-asset acceptance

1. Obtain the free **Universal Base Characters** ZIP or file set. Validate ZIP manifest, formats, rigged male/female body and material/texture imports. Record asset license and name of included license file.
2. Test free **Modular Character Outfits** ZIP, choose one piece, inspect skeleton and bind pose. Never claim it follows the body merely because it overlaps in the viewport.
3. Import one **Universal Animation Library** GLB or FBX clip, test on the body. Correct binding failures or map/retarget in an independent test.
4. Select glTF with separate `.bin` and image sidecars: verify no network request, visible material, no missing files, clear failure if texture intentionally removed.
5. Export *one* validated rigged scene; GLB must pass structural gate. Reimport and visually verify materials, deformations and animation playback.
6. Test Android Chrome touch, file chooser, ZIP memory limits, and browsing/sculpting/animation regression; then test Xbox Edge only after a candidate is stable.
7. Treat "supports ZIP" as **implemented at code level**, not completed for Quaternius, until tests 1–6.

## Known limitations

- No BLEND server conversion; untrusted Blender files must never execute embedded scripts automatically.
- Three.js FBX import is version-dependent and not a general rig-retarget solution.
- Two separately skinned models remain two rigs; exporter refuses to imply a combined character.
- Parent/track-name matches are necessary but not sufficient for usable animations.
- 115 MiB compressed / 185 MiB expanded ZIP guard can block especially large packs by design.
- No external network requests for sidecars; image/OBJ textures may depend on asynchronous decoders and need visual verification.
- ZIP import uses fflate 0.8.2 from a pinned CDN, not an offline vendor bundle; offline-first requirements remain future work.
