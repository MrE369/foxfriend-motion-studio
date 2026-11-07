# Unified Studio v0.13.1 — Workshop navigation repair

**Status:** isolated fix branch only. Do not merge to production or trigger a phone-app update until Bill approves after a browser smoke test.

## Reported bug

On CoLab v0.13, **Inspect**, **Paint**, **Animate**, and **Review** open working tab panels, while **Workshop** looks like a tab but does not open anything.

## Verified source cause

In production `colab/index.html`, the Workshop control was `advancedToolsButton`, **without** `data-tab`. It was absent from `WORKSPACES` and had **no `tabWorkshop` panel**.

Its click handler dispatched a click to `directorEmbedOpen`. That button and `directorEmbedRegion` lived inside a closed `<details id="directorBridgePanel">`. A fixed-position child of collapsed `details` is not rendered even if its `hidden` attribute is removed. Thus the action could execute without showing the editor.

## Narrow fix in `colab/index.html`

- Register Workshop as a fifth real `role="tab"`, `data-tab="workshop"`, `aria-controls="tabWorkshop"` tab.
- Add a first-class `<section id="tabWorkshop" role="tabpanel">` with visible Open button and safe same-origin full-page fallback.
- Attach a single tab click handler: `showWorkspace('workshop')` and open the editor.
- Move the existing `directorEmbedRegion` to `document.body` once the DOM has loaded, so it cannot be hidden by `<details>`. The editor remains a full-screen same-origin iframe of existing `./director.html`, not a new app installation.
- Retain explicit GLB transfers; retain separate editor state. Provide a user confirmation before unloading the Advanced Workshop on Back to avoid accidental loss of unsaved work.
- Retain the explicit child-to-parent close protocol.
- Keep the original Studio IndexedDB recovery DB and Advanced Workshop recovery DB unchanged.
- Version string v0.13.1 and `colab/sw.js` cache key bumped; PWA manifest ID, start URL, scope and icons unchanged.

## Verified

Static code inspection and JavaScript syntax checks on the complete staged `index.html`, existing `director.html`, and `sw.js`, plus 15 assertions for tab markup/registration, overlay detachment, model handoff, close flow, app update guard, recovery DB names, PWA identity and cache version: **PASS**.

This is **not** an end-to-end Android PWA test; no claim of visual correctness on Bill and Callie's phone until physically tested.

## Manual acceptance checks before merging

1. On a staging website, open CoLab and tap each tab: **Inspect**, **Paint**, **Animate**, **Review**. All existing panels still open.
2. Tap **Workshop**. Workshop becomes selected and the actual Director/Assembly/Geometry/Sculpt tools appear full-screen (not a blank panel). The iframe is no longer inside collapsed `details`.
3. Tap **Back to Unified Studio**. A warning allows cancellation if edits might be lost. On confirmation, the original Studio tab and scene remain, and Workshop shows **Open Advanced Workshop** for reopening.
4. Reopen Workshop; confirm it starts fresh or offers its own stored recovery. Test local GLB loading, one edit, and export.
5. Try the visible fallback `./director.html` link on a low-memory Android device, ensuring it stays under the existing installed app's origin.
6. Test **Save & update** while Workshop is open: update must refuse without prematurely reloading. Close Workshop and confirm update can save original Studio recovery before activation.
7. Test an installed CoLab v0.13 phone PWA update to v0.13.1 without reinstalling, and confirm separate IndexedDB recovery stores remain intact.
8. Confirm the unfinished reference humanoid rig PR #10 is still isolated. Merge into `main` only after user approves this production bug fix and test results.

## What is not included

This fix does **not** implement a shared in-memory scene between the two editing engines, merge undo histories, or deploy the skeleton-animation experiment. Those are separate later milestones.
