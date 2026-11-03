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

The launcher expects exactly **one** model and **at least one** reference image. It pauses with a readable message and opens the correct folder if inputs are missing. It passes up to six reference images directly to Codex's image input while making all reference files available in the workspace. Local Codex authentication is required.

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

No part of the package has been executed on the artist's laptop from this GitHub conversation. Codex must verify installation and generated results there.
