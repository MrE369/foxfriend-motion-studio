# CoLab v0.13 — Existing Humanoid Reference Rig, Milestone A (isolated experiment)

**Production remains unchanged.** This experiment extends the current `colab/` installed Unified Studio code from `main`. No new production website and no replacement skeleton.

## Artist's supplied source

Filename: `Finn_Sylvara_Humanoid_Rig_v01.glb`. **Source GLB was deliberately NOT committed to this public repository.** The artist selects it with the existing in-app GLB file picker.

Verified independently from the actual uploaded binary on 2026-11-07:

- GLB / glTF 2.0, 116,596 bytes.
- `HumanoidMotionLab` scene, 53 glTF nodes, 1 skin with **26 unique named joints** (Root, Hips, Spine/Chest/UpperChest, Neck, Head, HeadTop, Left/Right shoulders/arms/hands/fingers, legs/feet/toes).
- **7 guide/dummy triangle meshes**, NOT a finished character mesh. This GLB already passes the previous no-mesh import guard, although other bone-only rigs may not. The separate skinned `SkinDeclaration` dummy exists to declare the joint skin.
- Two embedded animation clips: `Quiet_Idle_v01` (4.00 s, 97 samples, 27 channels: 26 rotations and hips translation) and `Gentle_Wave_v01` (4.25 s, 103 samples, 27 channels).
- Source coordinate conventions: Y up, +Z forward.
- Offline independent joint-position reconstruction succeeded in two-angle source preview MP4s. This is **not** evidence of CoLab/Three.js playback or GLB re-export.

## What this branch adds

1. `reference-skeleton-guides.js` provides non-exported render-only bone links and joints around **the imported rig**; left/right have distinct guide colors. A clean mode temporarily hides the source's debug geometry during animation viewing and restores it when leaving Motion Studio, disabling the mode, or loading a different rig.
2. Existing Advanced Workshop (`colab/director.html`) Motion Studio has a **Reference Skeleton** control section. It frames the imported skeleton, toggles clean view, previews existing Quiet Idle and Gentle Wave clips by their actual embedded names, and resets rest pose.
3. The Unified Studio's existing Animate tab has an **Open Reference Motion Studio** button, routing to the same-origin Advanced Workshop in a phone-friendly embedded app. No duplicate installation.
4. Existing GLB import also accepts supported rigs consisting of Three.js Bone nodes even without renderable triangle geometry. Empty skeletons without bones or meshes remain rejected, and framing uses joint positions when there is no geometry.
5. Existing joint picking, drag IK, pose capture, keyframe timeline, JSON pose export/import, local recovery, and animated GLB exporter remain in place.
6. During animated GLB export, temporarily disable clean-view mesh hiding, then restore the artist's view, so display-only visibility doesn't leak into the export.

## Technical checks done

- Syntax-compiled full Advanced Workshop and Unified Studio module scripts, and new `reference-skeleton-guides.js`.
- Mocked skeleton runtime check: links built from actual parent relations, source mesh hidden only while active, visibility restored when disabled/cleared, no mesh geometry modified.
- Parsed supplied GLB header, chunks, skin, 26 joint names, both clip durations, track counts, and sample times.
- Independently interpolated clip motion and rendered front and 3/4 MP4 reviews from actual source channels.
- Approximate source-clip joint travel in source rig units: wave RightHand 0.914, RightFoot 0.086 relative to initial pose. Foot locking is **not implemented**.

## Not yet verified

- Actual in-browser Three.js GLTFLoader on the supplied file and CoLab's full app; no live app GPU/screenshot validation performed.
- Real mouse/touch drag IK interaction on the source rig.
- GLB animated export → reimport identity and animation data on this updated branch.
- On-device PWA RAM, Chrome, Xbox Edge, and recovery with the new skeleton controls.
- Artist review of the source wave's naturalness (the imported wave is only a reference / first pass, not automatically approved as game-ready).

## Artist acceptance test (do NOT merge until checked)

1. Open an approved staged preview built from this branch, or locally serve `colab/` with its relative files via an HTTPS/localhost server. Do not install it as a second app.
2. From Unified Studio Animate, tap **Open Reference Motion Studio**.
3. Choose `Finn_Sylvara_Humanoid_Rig_v01.glb` with **Load GLB or FBX**, then enter Motion Studio. Confirm the status shows **26 joints, 2 clips**.
4. Click **Frame skeleton**, toggle **Clean skeleton view**, and test **Orbit** and **Pose** without the view drifting or disappearing.
5. Tap **Quiet idle**, then **Gentle wave**, and pause/scrub; check body motion and foot placement from front, side, and 3/4.
6. Pick **RightHand** and test exact bone rotation and optional drag IK; capture a new pose.
7. Save pose JSON, verify local recovery, reload, and restore without losing source clips.
8. Capture at least two poses, **Export Animated GLB**, reimport it, and verify all expected animation clips. Export does not bake skeleton guide overlays into the GLB.
9. Inspect possible foot sliding in Gentle Wave; preserve the original clip and propose corrections only with Bill and Callie's artistic feedback.
10. Do not publish to `main`, change the installed phone's production service worker, or touch the Godot gameplay branch without explicit approval.

## Next milestone

Once Milestone A passes in a real browser, improve the gesture's actual weight transfer, timing, shoulder/elbow relaxation, planted feet, and foot-contact auditing. Later: still/video reference reconstruction. No paid inference, third-party uploads or speculative physics fixes in this first experiment.
