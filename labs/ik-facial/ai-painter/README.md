# Start AI Painter — Finn & Sylvara

This is a **Windows desktop launcher for headless Codex**. The first model is Sylvara's blank FBX, with approved 2D reference views. The program **does not operate Blender's or CoLab's GUI**. It starts `codex exec`, lets the agent choose its best available headless tools, and writes reviewable, reproducible results.

## For Codex on the laptop — install it yourself

1. Fetch or access branch `experiment/sylvara-master-painter-launcher-20261103` in `MrE369/foxfriend-motion-studio`. Do not checkout over uncommitted artwork; use a worktree or separate checkout if needed.
2. Verify `codex --version` and an authenticated Codex CLI session. Inspect available Blender, Python, GPU and existing CoLab capabilities.
3. Read `MASTER_PAINTER_MISSION.md`, review the PowerShell scripts for security/compatibility, and improve them locally as required.
4. Run the installation script **on the Windows laptop**:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\labs\ik-facial\ai-painter\Install-Start-AI-Painter.ps1
   ```
   If you are already in `labs/ik-facial/ai-painter`, use `-File .\Install-Start-AI-Painter.ps1`.
5. Verify on that laptop that the **Start AI Painter** desktop shortcut exists and points to the user's Documents workspace launcher. Do not claim it exists before checking the actual file.
6. Place the **one blank Sylvara FBX** supplied by the artist in the workspace `input\models`. Put the approved Sylvara style-3 reference PNG/JPEG/WEBP images in `input\references`. Do not invent reference assets.
7. Run the desktop shortcut to test **headless execution**. Verify Codex starts with `codex exec` (not a terminal TUI that clicks the screen), and produces outputs under `output\runs\<timestamp>`.
8. Build and run the best available script-based 3D painting pipeline. The mission explicitly permits **headless Blender Python** or another demonstrably better method. Prefer full textured GLB and matched five-angle renders over a CoLab vector-only recipe.
9. Validate rig, UV uniqueness and color spill, style-3 fidelity, technical exports. Preserve original FBX and reference images. Present comparison renders to the artists for approval.

## Work directory created by installer

- `Documents\Finn-Sylvara-AI-Painter\input\models\` — one blank Sylvara FBX or GLB
- `Documents\Finn-Sylvara-AI-Painter\input\references\` — approved artwork, all views
- `Documents\Finn-Sylvara-AI-Painter\output\runs\` — isolated versions, never overwrite past output
- `Documents\Finn-Sylvara-AI-Painter\logs\`
- `Documents\Finn-Sylvara-AI-Painter\MASTER_PAINTER_MISSION.md`
- `Documents\Finn-Sylvara-AI-Painter\Start-AI-Painter.ps1`
- `Desktop\Start AI Painter.lnk`

The launcher expects exactly **one** model and **at least one** reference image. Missing inputs stop before Codex is started (exit 10 for the model, 11 for references). Messages are also written to `logs/last-launch.txt`. It never waits for keyboard input or opens a browser/editor. It passes up to six reference images to Codex while making all files available in the workspace. Existing ChatGPT CLI authentication is required; no API key purchase is configured.

`-CheckOnly` checks inputs, executable discovery and authentication without starting an AI task. `-VerifyLauncher` restricts a test launch to writing and reading one marker file. The installer preserves replaced launcher files and any existing shortcut under `installer-backups/`. It copies reusable Python tools into `scripts/` and does not modify global Codex/MCP or Blender configuration.

For a real shortcut launch test, an engineer can create the disposable `logs/verify-next-launch.flag`; the runner consumes it and performs only the bounded verification on that one launch. Ordinary launches execute the full mission. The installed CLI's `--ignore-user-config` option reset the reported sandbox to read-only during testing; the launcher therefore keeps the existing runtime configuration and explicitly passes `exec --sandbox workspace-write`.

## Why this is not the existing CoLab headless bridge

The current CoLab bridge exports a selected mesh to a local folder and accepts small UV polygon-fill recipes for manual approval. That workflow is useful for local targeted experiments but **cannot automatically paint all of Sylvara** or safely distinguish multiple surfaces sharing identical UV pixels. This launcher is a broader production workflow: Codex can import the blank FBX, generate a safe UV atlas/material separation on a copy, texture the entire character with audited projections, and export finished GLB/textures and review renders.

It may call CoLab offline tooling where safe, but does not depend on CoLab being open, a browser extension, or simulation of mouse clicks.

## Windows security and boundaries

- The installer uses Windows Shell COM to create a normal user desktop shortcut. No administrator rights or scheduled background task are requested.
- Launcher runs `codex exec --sandbox workspace-write` with `--skip-git-repo-check` because the Documents workspace is not a Git repository. It uses `--output-last-message` and saves console logs with each run.
- Codex may send the supplied model and reference images to the Codex service as part of model reasoning. **Local folder does not imply fully offline AI processing.** Do not use sensitive images without reviewing privacy settings.
- No purchases, subscriptions, third-party asset uploads, direct production deployments, model replacement or automatic game commits are authorized.
- Every textured output is a **candidate**, never approved canon until Bill and Callie review it.
- If installed tools or permissions are missing, Codex must explain the precise blocker rather than pretending it finished.

## Local verification checklist

- Desktop shortcut present and readable.
- Shortcut target/arguments point to correct runner under Documents.
- Test with no model shows helpful missing-model message, without launching Codex.
- Test with model but no reference shows helpful reference requirement.
- Test with both inputs launches `codex exec` and creates a unique output folder.
- Full result includes environment report, UV/rig audit, reference palette, semantic surface plan, rendered front/back/side/three-quarter and textured GLB candidate or documented blocker.
- The untouched blank FBX and reference images still match original hashes.
- Full-surface leak detection and GLB roundtrip checks pass before user acceptance.

## Verified laptop run — November 3, 2026

The shortcut was installed and its actual `.lnk` launched. Authenticated `codex exec` wrote and reread a disposable marker and exited successfully. Missing-model and missing-reference gates returned 10 and 11. Blender 5.2.2 LTS executed the painting and export scripts without a GUI. Results are candidates for artistic review, with rigging explicitly deferred by the artist.

Private models, reference art, generated maps and renders are kept on the laptop, outside this public repository. See `VERIFICATION_2026-11-03.md` for the measured checks and limitations.

## Deterministic tools

- `painter_audit.py`: imports the supplied FBX, records geometry/UV/rig baselines, and renders clay/component views.
- `painter_pipeline.py`: generates independent UV charts, semantic albedo and roughness/metallic textures, an editable Blender file, GLB and five-angle renders. Its component IDs and eye masks are calibrated to the audited Sylvara source hash; a different FBX requires an audit and remapping.
- `painter_refine_eyes.py`: creates a new version from a candidate and repaints the full exposed sclera, larger blue irises, and dark lash rims without changing geometry or UVs.
- `painter_validate.py`: independently reimports FBX and GLB, compares the surface within floating-point tolerance, inspects embedded textures, renders the actual exported GLB, and performs a disposable red-chest/blue-skirt leakage test.
- `godot_inspect.gd`: checks imported surfaces and texture resources in a disposable Godot project. It does not demonstrate animation or runtime frame rate.

Use Blender with `--background --factory-startup --python-exit-code 1 --python <script> -- <arguments>`. The audit takes `--source <fbx> --output <new-folder>`; painting takes `--source <fbx> --references <folder> --output <new-folder>`; validation takes `--source <fbx> --output <candidate-folder>`. Eye refinement takes `--previous <candidate-folder> --references <folder> --output <new-folder>`; `--face-only` is available for a quick close-up check. Never point output at the input directory or overwrite an artist-approved version.

The safe automated UV fallback uses one chart per original polygon. It eliminates measured overlaps but increases exported seam vertices and is less convenient for 2D hand painting than an artist-authored island layout. The current candidate has 53,051 triangles and 12 material surfaces. Atlas consolidation, deformation, LODs and runtime performance remain separate acceptance work. The source contains no rig or facial morphs; successful GLB import does not make it animation-ready.
