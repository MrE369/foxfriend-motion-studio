import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { test } from 'node:test';

const source=readFileSync(new URL('./skeleton-points.js',import.meta.url),'utf8');
const { poseReachLimit, skeletonAncestors }=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const bone=(name,parent=null)=>({name,isBone:true,parent});
const leftHand=bone('LeftHand',bone('LeftLowerArm',bone('LeftUpperArm',bone('LeftShoulder',bone('UpperChest')))));
const rightFoot=bone('RightFoot',bone('RightLowerLeg',bone('RightUpperLeg',bone('Hips',bone('Root')))));
const reach=(selected,mode)=>skeletonAncestors(selected,poseReachLimit(selected,mode)).map(p=>p.name);

test('Local hand pose excludes shoulder; Full reach includes it',()=>{
 assert.deepEqual(reach(leftHand,'local'),['LeftLowerArm','LeftUpperArm']);
 assert.deepEqual(reach(leftHand,'full'),['LeftLowerArm','LeftUpperArm','LeftShoulder']);
});
test('Local foot pose excludes hips; Full reach includes them',()=>{
 assert.deepEqual(reach(rightFoot,'local'),['RightLowerLeg','RightUpperLeg']);
 assert.deepEqual(reach(rightFoot,'full'),['RightLowerLeg','RightUpperLeg','Hips']);
});
test('Local upper arm rotates its nearby shoulder, not torso',()=>{
 assert.deepEqual(reach(bone('LeftUpperArm',bone('LeftShoulder',bone('UpperChest'))),'local'),['LeftShoulder']);
});
test('Local head and neck stay short',()=>{
 assert.deepEqual(reach(bone('Head',bone('Neck',bone('UpperChest'))),'local'),['Neck']);
});
test('Local fingertip movement stays within hand and forearm',()=>{
 const tip=bone('RightFinger',bone('RightHand',bone('RightLowerArm',bone('RightUpperArm'))));
 assert.deepEqual(reach(tip,'local'),['RightHand','RightLowerArm']);
});
test('Unnamed or non-humanoid joints use conservative generic two-parent chain',()=>{
 const custom=bone('TailTip',bone('TailMid',bone('TailBase',bone('Hips'))));
 assert.deepEqual(reach(custom,'local'),['TailMid','TailBase']);
 assert.deepEqual(reach(custom,'full'),['TailMid','TailBase','Hips']);
});
test('Skeleton root remains directly translatable and has no parents',()=>{
 assert.deepEqual(reach(bone('Root'),'local'),[]);
});
test('Motion Studio keeps both drag and nudge policies, mode buttons, and saved preference',()=>{
 const html=readFileSync(new URL('./director.html',import.meta.url),'utf8');
 for(const id of ['jointReachLocal','jointReachFull','jointReachHint'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/maxParents:poseReachLimit\(state\.bone,jointReachMode\)/);
 assert.match(html,/maxParents:poseReachLimit\(bone,jointReachMode\)/);
 assert.match(html,/reachMode:jointReachMode/);
 assert.match(html,/jointReachMode=pose\?\.reachMode==='full'\?'full':'local'/);
 assert.match(html,/createConnectedHumanoidMannequin/);
 const module=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(module,'Advanced Workshop inline JS module exists');
 const withoutImports=module[1].replace(/^\s*import[^\n]*;\s*$/gm,'');
 assert.doesNotThrow(()=>new Script(withoutImports), 'Workshop inline script syntax');
});
