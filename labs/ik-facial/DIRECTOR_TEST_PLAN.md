# CoLab Director Lab 0.12 — Experimental Acceptance Tests

**Test build:** `labs/ik-facial/director.html`  
**Source branch:** `experiment/colab-director-release-lab-20261022`  
**Safety:** this file is a separate isolated preview. No production Unified Studio edits or paid AI integrations.

## What is actually implemented

- Director's Desk: plain-language intent, task choice (repair, paint, animation), screenshot PNG, copied natural-language AI brief, and JSON packet with SHA-256 source identity, selected triangles, camera and animation summary.
- Agent round trip: paste a `colab-agent-recipe-v1` JSON recipe; validate against the exact loaded GLB and an allowlist; then explicitly preview. No arbitrary script, Python, model call or service-provider API is executed.
- Repair: build a separate candidate GLB scene from original model bytes. Recompute normals for a selected mesh, or gently relax a static mesh's selected *interior* vertices while preserving boundary positions and source UVs. Compare original/candidate, export the candidate as a new GLB.
- Repainting: selected-region UV tint using the imported texture as the starting surface. Current imported texture/transparency is retained; you can undo, paint further, save paint JSON/PNG, and export a new textured GLB.
- Animation: turn the currently selected bone a gentle locally configurable amount between two copies of its current pose, producing three editable keyframes. The existing Motion Studio can refine and export an animated GLB.

## Full-skeleton dot posing (new)

- Enter **Director's Desk → Pose every skeleton joint** or open **Animate** directly. A rigged asset automatically displays a small blue marker for every detected bone. Selecting one turns it yellow.
- Marker radius remains around 5 screen pixels (7 when selected), with an invisible 29-pixel finger-friendly selection zone.
- Drag a dot: linked parent bones participate in a bounded local CCD solve; choosing a skeleton-root marker instead translates the root. For named head/neck joints, a short parent chain keeps shoulders from moving unnecessarily.
- Touch empty canvas to orbit as usual; use **Hide joint dots** for a completely clear view. Filter the **All detected skeleton joints** list for coincident or hidden points.
- **Capture pose** retains rotations AND positions. Animate between captured poses and export to GLB. Pose JSON v0.6 and local recovery also preserve positions; v0.5 rotational JSON still imports.
- This is artistic pose manipulation, **not** a physical or anatomically constrained IK solver. Large movements can bend joints unnaturally; grounded feet are not promised.

### Blue Toro acceptance test

1. Import **Blue Toro** and tap **Pose every skeleton joint** in Director's Desk.
2. Confirm **29 blue dots** are available (even if some overlap) and the entire 29-bone rig can be browsed by name.
3. Drag a front hoof dot and confirm connected foreleg bones respond. Drag the `Head_1` joint and confirm the shoulders do not travel wildly.
4. Find `Root`, drag its dot, and capture Pose 1. Drag another dot, capture Pose 2. Press **Play**, then export Animated GLB.
5. Reimport exported animation, check root motion persists and the new clip exists. Try **Reset whole pose** after experimenting.
6. Tap **Hide joint dots**; dragging the empty model view should rotate the camera again. Enable the older green IK tool to ensure it does not conflict with blue markers.
7. On another rig, verify the markers count follows the detected bone count without assuming Tripo or VRM naming.

## Concept art reference + first repaint acceptance

This experimental workflow allows artists to view private concept art beside a 3D character **without uploading the image**.

1. Load Finn or Sylvara's original GLB; select **Paint** from the four-item bar.
2. Choose a local concept-art PNG/JPEG/WebP under 12 MB. Verify the reference preview and filename, then test **Pin image over viewer** and **Hide image from viewer**. Confirm the original GLB remains loaded.
3. Tap **Tap a surface to choose where to paint**, then touch a piece of clothing. Verify the chosen mesh is selected without changing artwork. If the target has multiple materials or missing UVs, a clear error must appear.
4. Set a small brush with 35% default opacity and start painting. If the source texture is larger than the 1024/2048 paint canvas, a warning and explicit confirmation must appear **before a paint session is created**.
5. Apply one small mark to clothing, inspect against the pinned illustration, then **Undo stroke**. Verify the original texture is restored locally. Avoid tests on the face until verified.
6. Export **Paint JSON** for backup, then export a separate **Test GLB**. If any source textures exceed 2048, the exporter must ask permission before downscaling. Reimport and compare texture sharpness, mapping and mesh deformation against the original.
7. Download **Agent JSON** from Director's Desk and verify it references the local artwork filename but **does not include the artwork bytes**. The user must explicitly attach the illustration in their chosen AI conversation.
8. Repeat after switching from Paint to Animate and back; ensure hidden/pinned reference never prevents manipulating the model or using the workspace tabs.

**Important limitation:** this is a local reference viewer and manually directed painter, **not** an AI image upload or an automated concept-art-to-texture system. Artist review and agent correspondence still take place in the user's separate chat. Painting from 4096×4096 originals currently risks a lower-resolution test texture: do not promise production-quality lossless texture editing until measured and confirmed.

## Quick tests on Android or laptop

1. Load an original GLB you already own and verify that the whole character appears in the viewport. Change the **Director's Desk** experience selector; only the relevant tool panel should appear.
2. **AI packet:** Choose Inspect and select a color region, describe a repair, tap **Agent JSON**. Check it downloads with the expected source SHA-256 and the selected triangle IDs. Tap **Copy briefing**, paste into another conversation, and share your actual device screenshot with it.
3. **Repair normals:** In Inspect, tap an area, choose Recalculate surface shading and Preview. Verify the candidate view appears. Switch Original/Proposed, export the candidate, and reload to verify the model/rig looks intact. No source file is overwritten.
4. **Patch smoothing (static model only):** Select an interior-sized region on a static tree/prop mesh. Adjust strength and preview. The UI must reject rigged/morph-target meshes instead of risking deformation. A single triangle may correctly report no interior vertices; this is a safety feature.
5. **Paint tint:** Select part of a UV-mapped, single-material mesh in Inspect. Choose Repaint and tint. Verify the existing underlying texture is visible, that the target area changes, and that Paint Studio Undo restores the prior appearance. Export a new Painted GLB and reimport.
6. **Action blocking:** Load rigged GLB, select a bone in Motion Studio, choose Animate in Director, set angle, make three keyframes. Play the clip and adjust the middle keyframe; export an animated GLB and reimport.
7. **Recipe test:** Export the Agent JSON, ask an agent to return one permitted recipe. Paste into the Recipe panel and validate. A matching hash must permit preview; an intentionally wrong hash or unknown operation must be rejected with no changes.
8. **Recovery:** Save and restore an existing painted/posed session. New director intent and local repair candidates are NOT recovered yet; export packets/candidate GLBs separately. Confirm original local recovery in the production app is untouched (different origin or browser storage scope).

## Sample restricted agent recipe

Replace SOURCE_HASH with the original source SHA-256 from **Agent JSON** and choose a region slot with a selection:

```json
{
  "schema": "colab-agent-recipe-v1",
  "source": {"sha256": "SOURCE_HASH"},
  "task": "repair",
  "operation": "normals",
  "regionSlot": 0,
  "parameters": {}
}
```

Repainting:
```json
{
  "schema": "colab-agent-recipe-v1",
  "source": {"sha256": "SOURCE_HASH"},
  "task": "paint",
  "operation": "tint",
  "regionSlot": 0,
  "parameters": {"color": "#a7bc8f", "opacity": 0.3}
}
```

Animation:
```json
{
  "schema": "colab-agent-recipe-v1",
  "source": {"sha256": "SOURCE_HASH"},
  "task": "animate",
  "operation": "gesture",
  "parameters": {"boneName": "EXACT_BONE_NAME", "axis": "y", "angleDegrees": 8}
}
```

## Limitations before a public paid release

- **Not autonomous AI**: agent conversation happens outside CoLab; handoffs are manual and local recipes are deterministic.
- **Not a comprehensive repair engine**: this version does not repair holes, weld topology, transfer skin weights, or solve face/rig reconstruction. Static smoothing is conservative and may require a wider selected patch.
- **Paint limitations**: single-material UV meshes, UVs inside 0–1, source map with no UV transform. UV island overlap may tint other surfaces; materials/visuals must be verified after export.
- **Animation limitations**: gesture template rotates only an explicitly selected bone. It does not infer anatomy, prevent self-collision or perform full-body IK.
- **New results are not yet in recovery**: paint and poses use existing recovery; repair candidate GLBs and director briefs require manual export.
- **Existing core editor remains experimental**: verify asset sizes, mobile memory use, multiple models, transparency, textured exports, and rig preservation before charging real customers.
- **Hosting and licensing**: this preview is not a protected paid delivery, a storefront, or a validated DRM/licensing system.

## Quality gates

Do not call a feature ready for paying buyers merely because HTML parses or Cloudflare deployment succeeds. Test real imported models and exported GLBs, audit third-party asset/code licenses, and validate backup and failure behavior on Android and PC. Keep stable branches untouched until the artist approves promotion.
