# Better Together 3D CoLab v0.11 — staged beta

**Staging only.** These changes are not deployed until approved. The original Foxfriend Motion Studio root website remains unchanged.

## Working with AI agents: screenshot-first feedback and cost-conscious tooling

CoLab artists do **not** need to describe bone angles, shader code, or script internals. Use CoLab on your own device, send the agent an actual screenshot showing the result and relevant slider/control, then describe the visual issue in everyday words. The agent should diagnose the visual evidence, modify the **smallest reusable local script or editor operation**, preserve the approved parts, and request a comparable screenshot to confirm the fix.

Example: a character that loaded in the bottom-right of a mobile viewer was fixed by adjusting the canvas/viewport layout—not by regenerating or re-rigging the character. A separate screenshot at 72% bow depth revealed a hoof orientation problem that called for a rig solver change, not a completely new model.

This can reduce unnecessary paid AI calls, generations and rebuilds, but savings vary with tooling and usage. Screenshots and AI analysis can themselves be metered; do not claim a guaranteed saving or the anecdotal "19×" amount without valid measurements.

**Public guide:** [How to collaborate with your AI agent](agent-guide.html)  
**Agent implementation guide:** [CoLab Agent Workflow](../docs/AGENT_WORKFLOW.md)  
**AI coding-agent instructions:** [AGENTS.md](../AGENTS.md)

Only share screenshots you're comfortable sharing; crop private details, and never assume a screenshot authorizes publication or paid operations.

## New features

- IndexedDB local recovery: stores the **last** loaded GLB (up to 64 MB), six labeled geometry selection groups, movement proposal offsets, Inspector camera/style/visibility state, paint textures and stroke records, and skeletal keyframes/poses. Writes are debounced and can be manually triggered via **Save now**.
- **Restore last session** is an explicit user action. Existing saved data is protected when a different GLB is opened: choose Restore or manually Save now to replace the old recovery copy.
- **Delete saved local copy** with confirmation, pausing autosave until an explicit Save now or loading a new GLB when no other saved project remains.
- In-app update notification when a service worker update is ready; **Save & update** saves locally first, then applies the new version. **Later** does not interrupt editing.
- Inspect view settings persist across workspace switches. When in Inspect, preview movements from Review are hidden while all original colored selection groups remain visible. Review remembers Original/Proposed independently.

## Safety / limitations

- **No user models or painting data are sent to GitHub.** Files are stored in the same browser's IndexedDB. Browser data clearing, private browsing, and device loss can erase local recovery; export your JSON and GLB files separately.
- Autosave stores only one last-session checkpoint, not a full revision history. It does not persist paint Undo history or loaded Candidate GLBs, and GLB models over 64 MB require manual exports.
- IndexedDB quota, low storage, or untrusted/incompatible model files can prevent recovery. The UI reports failures; backups remain essential.
- Changes are an experimental beta and require phone acceptance tests. The geometry movement tool is a **detached visual proposal**, not a topology-preserving edit or animation-safe repair.
- Three.js is loaded from pinned jsDelivr URLs and can be cached for offline use after an online load. Full offline reliability is not yet guaranteed.

## Suggested acceptance tests

1. Launch the staged test on Chrome (once deployed to HTTPS). Load Sylvara, restore her eyelid selection JSON, save a checkpoint, close/reopen, tap Restore last session, and verify 174 pink + 176 cyan triangles and camera view.
2. Paint a small test mark, save, close/reopen, restore, and verify the texture survives. Original GLB stays unchanged. In-session paint Undo works; older Undo history is deliberately not recovered.
3. Enter Review, select Proposed and move one eyelid, then Inspect: original highlights stay visible. Return to Review: proposal is still selected and movement offsets remain.
4. On an installed version, make an approved update available. Confirm **Save & update** saves before reloading and **Later** does not reload.
5. Load a second model while a saved checkpoint exists; verify the older checkpoint is not overwritten without explicit Save now confirmation.
6. Test disabling storage or quota failure: UI must report the failure, not claim success.