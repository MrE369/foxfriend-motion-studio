# CoLab Sculpt Lab 0.1 — experimental Android test plan

**Branch:** `experiment/colab-director-release-lab-20261022`  
**Stable production:** no changes.

## Scope
Selected **static** geometry within one imported Assembly GLB. Brush actions: Grab, Pull, Push, Smooth. Undo keeps the last 12 strokes in the current page session. Reset discards sculpt edits on the selected part. Existing Assembly GLB export includes the modified mesh; source files on the phone are never overwritten.

**Not yet supported:** rigged or morph-target sculpting; topology repair; UV reconstruction; texture painting; automatic expression correction; direct import of external displacement recipes; sculpt session persistence after refresh.

## Acceptance checks (Android Chrome)
1. Open the experimental Director Lab and tap **Assemble**. Add `Finn body blank.glb`, then `Finn blank head.glb`. Verify both display.
2. Tap **Fit Finn head to body** (optional), choose the head in Loaded components, and frame/zoom to the face.
3. Expand **Sculpt selected model**, choose **Grab**, tap **Start sculpting**. The yellow bounding box should disappear. The source GLB remains unchanged.
4. On an eyebrow (not hair), drag a **short** distance. Verify only the nearby facial surface follows the brush; camera must not orbit during the drag. Undo the stroke and visually confirm the original shape returns.
5. Select **Pull**, set 0.010–0.020 m radius with 0.001–0.002 m strength. Touch a cheek once. Verify a slight geometric change. Undo.
6. Test **Push** and **Smooth** on a small area. Confirm neither erases materials nor changes the other GLB.
7. Press **Orbit camera**. Swiping the viewer should orbit normally. Re-enter sculpt; drag on empty background should not move a model.
8. In the Assemble workspace press **Export new combined GLB**. Reimport it under **Inspect**, compare from front and side, and ensure the changes persist. Keep the downloaded source files.
9. Select the head and press **Reset selected model sculpt**; confirm only the head's geometry restores and the placement is unchanged.
10. Try rigged Finn in Assemble, select him, and attempt sculpt: the tool should refuse safely with a message, leaving the model intact.
11. Test **Review**, **Paint**, and **Animate** after leaving Assemble: the four preexisting workspace behaviors must still work, and the production app must be unaffected.

## Critical limitations
- The pilot adjusts positions of existing vertices; it does **not** create new geometry or turn an angry generated expression into a smile automatically.
- Tripo's head mesh contains disconnected components and open boundaries. Close overlapping pieces, eyelids, and hair need extra care. Use small radius and strength; inspect from three-quarter and side views.
- Neither topology integrity nor existing UV texture alignment is guaranteed if heavily deformed.
- No sculpt edits are auto-saved through CoLab recovery. Export a candidate GLB before closing the page.
- Rendered on-device validation pending; code is syntax-checked and deployed only to the experimental branch.

## Architecture
Sculpt is a separate `sculpt-tools.js` module loaded by `assembly-tools.js`, which is used by `director.html`. It edits a cloned BufferGeometry on first touch and maintains undo position arrays. Unrelated GLB parts are untouched. This avoids changing the main single-source paint/motion pipeline while the capability is being tested.
