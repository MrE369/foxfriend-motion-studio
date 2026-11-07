# Finn & Sylvara CoLab — Unified Studio v0.13 integration

**Status: test branch, not published to the existing installed phone app.** Branch `integration/unified-studio-pwa-v013-20261107` is based on the existing October 30 Unified/Director integration and includes Director Lab's newest tools from the November 3 experimental branches.

## One installed app and one canonical URL

**Canonical app:** https://mre369.github.io/foxfriend-motion-studio/colab/

This is an installed Progressive Web App (PWA) with `manifest.webmanifest` `id="./"`, `start_url="./"`, `scope="./"` and its existing icons. Keep the **same origin, scope, start URL, ID and icon paths** for every future release. That makes a new commit to the published GitHub Pages site a version update of the **existing** phone app, not a second installation. Do not instruct artists to install Pages previews/Cloudflare experiment URLs as substitutes.

**Update behavior:** `colab/sw.js` caches the current unified shell and its advanced modules. It downloads/installs new code in the background, but does not call `skipWaiting` until `Save & update` is explicitly tapped. Unified Studio first persists its current state in IndexedDB and blocks updating with the embedded Advanced Workshop open. The new service worker calls `clients.claim()` upon activation; only the approved update causes reloading. Users can also open **App updates → Check for updates**. A browser/device may require a reload or reopen to detect updates; installation and update cannot be guaranteed when offline.

## What is included

- Existing Unified Studio's original Inspector, UV Paint, Animation, Review, file import, JSON/GLB handoff and local recovery remain in `colab/index.html`.
- A visible **Workshop** tab opens an in-app, full-screen embedded Advanced Workshop that contains Director Desk, Assembly Lab, Geometry Workshop, Sculpt, rig/IK, painting, shading/reference tools, editable Vector Forms v0.2 (1024/2048 resolution, 2×/4× anti-aliasing, crisp edges) and the **headless Codex recipe bridge**.
- The Advanced Workshop source is now `colab/director.html`; its modules are inside `colab/`, including `vector-paint.js`, `vector-outline-preview.js`, `ai-paint-bridge.js`, and `ai-paint-uv-guard.js`. This is **not** an iframe to an unrelated Cloudflare host.
- A **same-origin explicit GLB transfer** sends current geometry/texture from Unified to Advanced and back after confirmation, with conservative size checks on Advanced import.
- The embedded iframe renderer is removed when closed and Unified's render loop pauses while the workshop is open. Low-memory devices may instead open `director.html` as a full page within the app (not a separate install), after exporting work.
- Preserve known-good standalone `labs/ik-facial` experiments and do not update the Cloudflare Director production project as part of this change.
- The local `Start AI Painter` Windows launcher remains a **desktop Codex workflow**, not a headless service that the mobile app can magically run. The phone can review/edit CoLab assets and import/export recipes; local Codex execution still requires the laptop or a later explicitly authorized local service.

## Recovery / compatibility rule

**Critical:** The two editor engines currently have separate scene graphs and cannot share editing state live.

- Original Unified Studio keeps the existing IndexedDB name `better-together-3d-colab-local-recovery`, preserving the installed user's last saved project.
- Advanced Workshop uses the **new** `better-together-3d-colab-advanced-workshop-recovery-v013`, preventing both frames from silently overwriting the same `projects/current` and `assets/current` keys.
- Saving, exporting, recovery, undo history, keyframes and selection groups **do not** seamlessly transfer across editor engines yet. An explicit GLB snapshot is the supported handoff; additional state interoperability is future work.
- Browser storage clearing/device loss can still delete local recovery. Before promoting, export Project JSON plus test GLB on a real model.

## Promotion checklist (all required)

1. Inspect PR and check syntax of both HTML module scripts and every local module; verify all imports and PWA-cached paths exist.
2. Test fresh mobile Android Chrome installed PWA on the **existing canonical URL**, load a known GLB; inspect, paint a test mark, animate, and Save now.
3. Open Workshop via top navigation; check full-screen viewport, touch selection/orbit, Assembly, Geometry, Sculpt, Vector Paint, Codex recipe **manual import** (folder access may be absent on Android).
4. Explicitly transfer a model Studio → Workshop → Studio; confirm exact new model after user confirmation, check paint texture, file naming and no accidental overlays; test cancel paths.
5. Confirm separate IndexedDB recovery stores by saving different models in each and recovering them after closing/reopening; verify original production recovery remains intact.
6. Test larger GLB (~tens of MB) and low-memory behavior. Check performance, touch controls, and no WebGL context crash when opening/closing the embedded workshop repeatedly.
7. Confirm update safety: with Workshop open, **Save & update** refuses; after exporting and closing it, Save & update saves the active Studio model and only then reloads. Verify session restoration after update.
8. Test update manually from v0.11 on an already installed phone PWA: same home-screen icon and domain, correct new version in app, **no** second app or reinstall.
9. Verify no source FBX/GLB or art data is uploaded to the web host. GitHub Pages hosts public app code; **personal use does not equal access-controlled hosting**.
10. Only after these pass, merge/promote to the branch that actually publishes the canonical GitHub Pages `/colab/` URL. Do **not** change the app origin, local storage identity, or director production domain.

## Known design debt

This is a single **installed PWA package** with two editor engines linked by explicit GLB handoff, not one shared in-memory 3D scene/undo/rig state. Full native merge would require refactoring shared model state, unified undo, shared local recovery schema, and coordinated file import/export; that is a separate milestone and should not be implied by a Workshop tab.

Next releases should add features to this canonical `colab/` app and bump the service-worker `CACHE` version on every changed release, not create a new site. Use test branches/preview deployments internally; only one permanent phone installation.
