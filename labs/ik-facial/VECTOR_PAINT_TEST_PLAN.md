# CoLab Vector Forms v0.1 — experimental validation

**Branch:** `experiment/colab-vector-paint-v01-20261103`. **Do not promote to the existing live Director Lab while painting is in progress.** The current working wire guide, FBX import, raster painting, reference eyedropper, and paint-recovery workflows must remain intact.

## What this prototype supports

- Create closed **UV-space polygon or smooth Bézier outlines** by tapping either the 3D model or the enlarged UV editor; fill them in flat color.
- Retain editable contour points; drag existing cyan points in the zoomable editor to refine shapes.
- Stack shapes front/back, change color, opacity, hard corners vs smooth contour, and optional same-color outlines.
- Add later shapes with darker or lighter colors for **hard-edged vector-style shading**.
- Continue raster brush shading **above** vector shapes. Earlier raster painting is captured as an underlying bitmap when vector mode first starts.
- Keep editable form coordinates in the Paint Project JSON, alongside the composited texture and underlay/shade PNG layers; local recovery captures them as PNG Blobs.
- Export/import compact **vector paths-only JSON** for Codex-assisted workflows with strict model hash, mesh index, mesh name, UV resolution, color and point validation.
- The GLB/PNG export remains rasterized (ordinary texture); **the vector paths persist in editable project JSON**, not in the GLB.

## Quick acceptance tests

1. Open this branch in an isolated preview. Load a *copy* of a UV-mapped GLB or FBX. Save the current production project first if it contains original artwork.
2. Open Paint, select one paintable mesh, keep **Show UV lines off**. Open **Vector Forms**, choose New outline, tap 4 corners in the enlarged UV editor, then **Close outline & fill**. Confirm the flat-colored shape appears on the 3D model and the UV preview.
3. Change the fill color and transparency; choose a stored form and drag its cyan anchor handles; check that fill updates promptly and the source UV mapping remains untouched.
4. Choose New outline, make a smaller darker form over the first and choose partial opacity; confirm a crisp hard-edged shadow. Raise/lower forms and use Undo vector edit.
5. Choose **Trace points on 3D model** to add points on the selected mesh; switch to Navigate to orbit without painting. Close to fill. Verify the shaded wire guide still works and is independent.
6. Tap the existing Paint button and draw a raster highlight *on top* of the vector forms. Undo that raster stroke. Move a vector point afterward and verify raster shading remains present.
7. Export Paint Project JSON, PNG and Test GLB. Reimport the GLB into a viewer and inspect the texture. Reimport Paint Project JSON using the original converted model, confirm vector points are still editable.
8. Save locally, close the experimental tab, reopen the same experimental preview and Restore last session. Confirm vector contours and raster shade are restored.
9. Export vector paths JSON and import back into the *same* selected mesh; confirm one grouped vector undo. Change model/mesh to confirm a mismatched import is rejected without applying paint.
10. Check performance at 1024² and 2048². Test tablet touch and laptop mouse with a dense mesh. Confirm no UV layout redraw on Paint/Navigate switches.

## Known constraints / safeguards

- Geometry **must have UVs** and one supported material per paint target; overlapped or mirrored UV islands receive the same color. Cross-island shapes can paint unexpected polygons; draw separate forms on each UV island.
- This prototype draws one target mesh at a time and supports up to 128 closed forms of 512 anchors each. Curves use computed Bézier control points; there are no independent tangent handles yet.
- Raster brush undo covers strokes made after Vector Forms starts. Raster brushwork done earlier becomes part of the underlying bitmap, so export a Paint Project JSON backup before tracing.
- The enlarged UV canvas is not a replacement for native vector textures in glTF; export GLB with baked pixel textures and keep JSON for editable forms.
- A painting canvas of 2048² plus underlay, shade, backups and undo history uses memory. Test on the actual laptop before promotion.
- No cloud processing, model upload, AI generation, or external services are used by the vector editor.

## Promotion gate

Manual tests above must pass on the artist's laptop. Do not claim performance, fidelity, or full browser compatibility from syntax checks alone. If any test fails, leave the current Director Lab production branch untouched.
