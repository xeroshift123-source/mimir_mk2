import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allBlackComplete,allBlackProgress,allBlackResultOptions,neonChallengeGrowth} from '../src/all-black-model';
import {OverloadSimulation,rollCost} from '../src/overload-simulator-model';
import type {Nikke} from '../src/deck-model';
const catalog=JSON.parse(readFileSync('public/data/nikkes.json','utf8')) as Nikke[],neon=catalog.find(n=>n.id==='neon_vision_eye')!;
const completed=()=>{const sim=new OverloadSimulation(neonChallengeGrowth(neon));sim.equipment.forEach((e,i)=>{e.slots=[{type:'우월 코드',tier:15,lock:'none'},{type:'차지 속도',tier:15,lock:'none'},{type:i<2?'공격력':'장탄 수',tier:15,lock:'none'}];});return sim;};
test('all black requires exactly 4 elemental, 4 charge-speed, 2 attack and 2 ammo at tier 15',()=>{
 const sim=completed();assert.equal(sim.original.nikke.name,'네온 : 비전아이');assert(allBlackComplete(sim.equipment));assert.deepEqual(allBlackProgress(sim.equipment).map(p=>[p.count,p.target]),[[4,4],[4,4],[2,2],[2,2]]);
 sim.equipment[0].slots[0].tier=14;assert(!allBlackComplete(sim.equipment));sim.equipment[0].slots[0].tier=15;sim.equipment[1].slots[2].type='장탄 수';assert(!allBlackComplete(sim.equipment));assert(!allBlackComplete(sim.equipment.slice(0,3)));
});
test('new Neon challenge starts empty and counts roll and module-lock costs, including paid undo',()=>{
 const source=neonChallengeGrowth(neon),sim=new OverloadSimulation(source,()=>.01);assert(!allBlackComplete(sim.equipment));assert.equal(sim.modulesUsed,0);assert.equal(sim.equipment.flatMap(e=>e.slots).filter(s=>s.type).length,0);
 sim.roll(0,'effect');assert.equal(sim.modulesUsed,1);sim.setLock(0,0,'module');assert.equal(sim.modulesUsed,3);assert.equal(rollCost(sim.equipment[0]).modules,2);sim.roll(0,'value');assert.equal(sim.modulesUsed,5);assert(sim.undo(0));assert.equal(sim.modulesUsed,5);assert.equal(sim.equipment[0].slots[0].lock,'module');assert.equal(sim.keysUsed,0);assert.equal(source.equipment[0].options.length,0);
 sim.reset();assert.equal(sim.modulesUsed,0);assert.equal(sim.equipment.flatMap(e=>e.slots).filter(s=>s.type).length,0);
});
test('first effect roll on each empty equipment generates level 11 and cannot be repeated by undo',()=>{
 const sim=new OverloadSimulation(neonChallengeGrowth(neon),()=>.01);
 for(let part=0;part<4;part++){sim.roll(part,'effect');assert(sim.equipment[part].slots.every(s=>s.type!==null&&s.tier===11));assert.equal(sim.effectRolls[part],1);}
 sim.undo(0);assert(sim.equipment[0].slots.every(s=>!s.type));sim.roll(0,'effect');assert.equal(sim.effectRolls[0],2);assert(sim.equipment[0].slots.some(s=>s.tier!==11));
 sim.reset();assert(sim.effectRolls.every(n=>n===0));sim.roll(0,'effect');assert(sim.equipment[0].slots.every(s=>s.tier===11));
});
test('goal count shows matching effects separately from max-level completion',()=>{
 const sim=completed();sim.equipment[0].slots[0].tier=11;const goal=allBlackProgress(sim.equipment).find(p=>p.name==='우월 코드')!;assert.equal(goal.matched,4);assert.equal(goal.count,3);assert.equal(goal.target,4);sim.equipment[0].slots[0].tier=15;assert.equal(allBlackProgress(sim.equipment)[0].count,4);
});

test('result percentages sum actual slot values and round to two decimals',()=>{
 const sim=completed();assert.deepEqual(allBlackResultOptions(sim.equipment),[
  {name:'우월 코드',count:4,value:116.64},
  {name:'차지 속도',count:4,value:24.36},
  {name:'공격력',count:2,value:29.26},
  {name:'장탄 수',count:2,value:170.74}
 ]);
 sim.equipment[0].slots[0].tier=11;assert.equal(allBlackResultOptions(sim.equipment)[0].value,111.04);
});
