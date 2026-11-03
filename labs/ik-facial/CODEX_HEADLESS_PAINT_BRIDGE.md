# Headless Codex Paint Bridge — experimental v0.1

**Branch:** `experiment/colab-headless-paint-bridge-20261103`. Existing production Director Lab is unchanged.

## Purpose

Codex does **not** need to drive Chrome, click CoLab UI, or manipulate DOM controls. Instead, CoLab exports a one-mesh paint task and imported model into a user-approved local folder, and Codex (running separately) writes a structured JSON paint recipe into the same folder. CoLab watches that file, validates it, shows a UV texture preview, and applies it only after the artist approves.

### Operating workflow (Chrome desktop)

1. Back up existing art using **Paint Project JSON** and **Test GLB**.
2. Open the experimental Director Lab. Import Sylvara's FBX or GLB and choose one UV-ready mesh in Paint.
3. Open **Codex Paint Bridge**, enter a **single small target** and click **Connect local folder**. **Use a dedicated empty folder** because repeat task exports overwrite fixed-named handoff files.
4. Click **Export paint task**. CoLab writes: `colab-paint-task.json`, `colab-model.glb`, `colab-codex-instructions.txt`, and optional `colab-reference.png` and `colab-current-texture.png`.
5. On the laptop with Codex CLI authenticated, open a terminal **in that folder** and run:
   ```powershell
   codex exec --sandbox workspace-write "Read colab-codex-instructions.txt and generate the requested CoLab paint recipe file."
   ```
6. Codex inspects the files and, only if able to identify the intended UV shape without guessing, writes `colab-paint-recipe.json`. It must not alter model source or original paintings.
7. CoLab automatically checks that filename every 3 seconds. Review the **UV recipe preview** and the UV overlap warning. Click **Approve & apply paint** or **Discard recipe**.
8. Inspect **the entire 3D character** for unintended UV spills, including skirt, shoes, and hair. The existing **Undo vector edit** reverses the grouped operation if used before other vector edits. Save a new Paint Project JSON.

### Fallback

If the browser does not support the File System Access directory picker, **Export paint task** downloads the JSON. Codex can produce a matching recipe file and the user can **Import recipe JSON** manually. This fallback isn't automatic.

### Recipe format

```json
{
  "schema": "colab-ai-paint-recipe-v1",
  "taskId": "exact-id-from-colab-paint-task.json",
  "modelHash": "exact-sha256-from-task",
  "meshIndex": 0,
  "meshName": "exact-mesh-name-from-task",
  "resolution": 1024,
  "forms": [
    {
      "kind": "vector_fill",
      "points": [[0.2,0.2], [0.25,0.2], [0.22,0.27]],
      "color": "#527d61",
      "opacity": 1,
      "smooth": false,
      "outline": 0
    }
  ]
}
```

Example points are **illustrative only**; Codex must determine actual UV positions from the supplied model, not copy guessed coordinates.

### Known limitations and safety

- **No cloud AI in the browser.** CoLab writes local files only. Codex separately uses its authenticated AI service to process the files, according to the user's Codex settings.
- No autonomous whole-character painting, surface semantics, material splitting, rig edits, or UV unwrapping. Only **1–32 filled vector forms on one selected mesh** per recipe.
- The recipe has exact model/hash/mesh/resolution/task identity checks, capped sizes and strict polygon/color/opacity validation. No executable commands are accepted from recipe files.
- A **sampled UV-overlap preflight** rejects detected collisions in the intended fill shapes. It can miss fine or unusual overlaps; **a clear check is NOT proof** that the fill cannot appear elsewhere. When UVs are identical across surfaces, a triangle-only mask cannot make texture pixels independent.
- All files are written to **explicitly selected folder**. No folder access until the user grants permission. Task export overwrites the fixed task/model/preview filenames in the selected folder, so choose a dedicated empty folder.
- Changes apply through the existing vector paint engine and become ordinary editable forms in CoLab. They are baked into the exported GLB texture but retain editability in Paint Project JSON.
- The preview is currently **2D UV texture only**, not a shaded 3D preview before approval; the user must visually inspect the model immediately afterward.
- The browser does not launch Codex itself; the local Codex CLI (or later a local app-server integration) must run separately.

### Test and promotion gate

1. Import a UV-mapped test model and export the task into a dedicated folder.
2. Confirm model, task, and instructions are all present; reference and current texture are optional.
3. Generate a minimal valid recipe from the task; ensure the preview appears without painting on the 3D model.
4. Edit the recipe hash, task ID, mesh index, or resolution; verify rejection and no changes.
5. Use a model with two spatially separated triangles sharing the same UV coordinates; verify a fill in those UV cells is blocked.
6. Approve a safe recipe, inspect the 3D character, and undo as one grouped vector edit.
7. Export Paint Project JSON, close/reload, restore, confirm editable vector forms remain.
8. Check laptop performance, folder permissions, and browser reload behavior before considering a production release.

Tests completed as of this commit: JavaScript parse checks, UI ID validation, isolated bridge export/validation/apply smoke test, and UV overlap detection on synthetic disjoint triangles. **Not yet validated in a live browser with the user's particular Sylvara FBX or actual Codex CLI.** Do not promote without that verification.
