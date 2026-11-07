# CoLab localized parent-chain pose experiment (2026-11-07)

**Branch:** `experiment/colab-local-pose-reach-20261107` — experimental; **not deployed** to the installed CoLab app. Baseline production: v0.13.2 connected mannequin.

## Artist report
- The **connected mannequin remains continuous** while dragged.
- Skeleton lines remain connected.
- Original debug rods look disjointed, especially around feet/toes.
- Touch drag currently lets too many parent bones participate, making ordinary limb posing affect the shoulder/torso or hip.

## Smallest isolated change
- Adds two large, phone-friendly buttons under **Workshop → Motion Studio → Pose every joint**:
  - **Local · default**: humanoid hands and feet affect at most their nearest two parent bones. For a hand, elbow/upper arm; for a foot, knee/upper leg. Upper limbs, lower limbs and shoulders generally use one nearest parent. Head/neck remain one. Other skeletons use two nearest parent bones.
  - **Full reach**: explicit opt-in restoring up to three parents as before, e.g. can bring the shoulder or hips into a reaching movement.
- Both **finger dragging and on-screen movement arrows** share exactly the same mode.
- The selected bone's eligible parent names are shown in the UI, for transparent behavior.
- To rotate only one bone, use **Motion Studio's existing joint X/Y/Z sliders**; moving the selected bone's world-space point with IK necessarily changes its parents.
- Local is the default for a newly loaded model, but an existing saved **Full reach** preference is restored if explicitly set.
- No changes to the bone hierarchy, imported GLB, mannequin geometry, original guide meshes, animation clips, camera grammar, CSS layout, PWA app identity or local IndexedDB database names.
- The separate experimental **explicit three-bone IK panel** is unchanged.
- This is still a generic CCD prototype: no bend-plane constraints, joint angle limits, planted feet or human-specific pole vectors. A shorter chain can be unable to reach some positions, which is why Full reach remains available.

## Verification and acceptance
- Static syntax validation of the Advanced Workshop inline module after removing imports and of the skeleton module: PASS.
- Hand/foot/shoulder/head/unknown/root parent-chain regression cases: PASS in isolated JS checks.
- New repeatable `node --test colab/pose-reach.test.mjs` tests cover control and recovery wiring.
- Not yet visually tested in live phone/WebGL. No production update; artist approval still required before merging.
- Proposed test: import `Finn_Sylvara_Humanoid_Rig_v01.glb`; show **Connected mannequin**; Pose Local hand, foot, and elbow; compare Full reach on same pose after resetting. Check other limbs remain steady, all joints still targetable, and original clips still play. Export and reimport animated GLB separately before release.

**Rollback:** revert the experiment branch. Production v0.13.2 stays available.
