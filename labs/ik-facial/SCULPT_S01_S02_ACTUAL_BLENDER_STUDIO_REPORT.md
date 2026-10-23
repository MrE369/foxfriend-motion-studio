# CoLab Anatomy Sculpt S-01 / S-02 — actual Blender Studio data

**Date:** 2026-10-23  
**Branch:** `experiment/anatomy-sculpt-s02-20261023`  
**Scope:** Real Blender Studio Human Base Meshes v1.4.1. Original 49,420,489-byte `.blend` from user-supplied ZIP. Asset is marked **CC0** on Blender's demo-files site. Originals are never committed or overwritten.

## Source analysis: directly measured in .blend

The source `.blend` file is Zstandard-compressed and contains Blender 4.2 serialized DNA. Blender binaries/bpy were not available, so a controlled Python SDNA inspector decompressed, read and validated its mesh/object structures without running scripts or altering the source.

| Mesh | Vertices | Quads | Triangles after export | UV corners | Blender material slots | Source modifiers | Shape keys |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| GEO-body_male_stylized | 12,502 | 12,500 | 25,000 | 50,000 | 0 | 0 | none |
| GEO-body_female_stylized | 12,502 | 12,500 | 25,000 | 50,000 | 0 | 0 | none |
| GEO-head_stylized | 4,118 | 4,134 | 8,232 | 16,500 | 0 | 0 | none |

All three selected meshes have no boundary edges/non-manifold preview edges and no zero-area preview triangles. This describes the **source meshes**, not every other asset in the bundle.

**Correspondence discovery:** Male/female stylized bodies have identical per-corner UVs, face indices, polygon loops, and vertex counts, while vertex positions differ. This supports future index-aligned morph-target research, but morph deformation has not been tested with a rig or every interpolation value.

## S-02: real, reproducible geometry sculpt

A pure-Python `controlled_body_sculpt.py` reads **the actual Blender Studio stylized male body**, applies smooth height-relative Gaussian vertex displacement, and exports GLBs. The original editable vertex indices/polygon/UV data are saved as NPZ.

| Variant | Shoulder factor | Waist factor | Chest depth factor | Maximum vertex displacement | Flipped / zero-area triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 0% | 0% | 0% | 0 mm | 0 |
| Athletic | +6.5% | -3.5% | +3.5% | 14.3 mm | 0 |
| Lean | -2.5% | -7% | -1.2% | 28.8 mm | 0 |
| Heroic | +10% | -2.5% | +5.5% | 20.7 mm | 0 |

Each result retains 12,502 original vertex entries in the editable source and 25,000 triangulated faces. All GLBs reimported in Python with 25,000 triangles; source UV corner values and original indexing remain unchanged. GLB is UV-seam split as required by glTF vertex attribute semantics. Rendered contact sheet: front, three-quarter, side.

**Limit:** This is geometric variation, not final anatomy approval or rig-safe skinning. No Blender modifier stack or rig needs to be preserved on these three source meshes because their original mesh objects have none. These models are unrigged and use neutral clay materials in the preview.

## CoLab integration

- New `labs/ik-facial/anatomy-sculpt.js`: deterministic per-vertex anatomical falloff, ±12% validated parameters, triangle orientation/degeneracy/edge-strain QA.
- Existing `labs/ik-facial/sculpt-tools.js`: new button for Athletic, Lean, Heroic, Original presets with 0–100% strength, undo/reset, geometry updates and quantifiable status. Refuses meshes with skeleton or morphs.
- Existing `labs/ik-facial/director.html`: simple artist-facing anatomy controls inside the original Assemble Sculpt section.
- `labs/ik-facial/anatomy-sculpt.test.mjs`: 4 pure-JS runtime regression checks passed in V8: shape change/immutability/topology, invalid-input refusal, distinguishable presets, degenerate-triangle refusal.
- `tools/sculpt-lab/blender_body_variants.py`: additional **UNTESTED** bpy-native headless implementation for a future trusted local Blender runtime using `--disable-autoexec --background`. CoLab does NOT have a connected Blender processing backend.
- Full local ZIP delivery contains four variant GLBs, a combined comparison GLB, source head/female GLB previews, reports and Python reproducibility scripts. Binary assets are not in the public GitHub repository.

## Pending gates

1. Live browser test of the isolated CoLab branch's new anatomy controls on the supplied real static GLB.
2. Artist judges front/side/three-quarter: muscle fullness, waist taper and shoulder transitions.
3. Validate GLBExporter roundtrip on the exact changed geometry in browser, including UVs.
4. Run the untested `bpy` backend in an isolated Blender 4.2+ environment and compare output to direct-Python baseline.
5. Only then test a **skinned Quaternius** body. Its skinning, bind pose, and clothing behavior are **not** covered by this static mesh experiment.
6. Facial S-03, rig-safe S-04, natural-language S-05, and hero-character S-07 remain future experiments.

**Safety:** Stable CoLab deployment and game repository unchanged. Original .blend and canonical characters untouched. No mandatory paid services.
