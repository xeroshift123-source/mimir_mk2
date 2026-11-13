import type {Growth} from './profile-data';
import {level40Cp} from './profile-controls';
import tables from './data/profile-stats.json';
export type Lock='none'|'module'|'initial'|'key';
export interface SimSlot{type:string|null;tier:number|null;lock:Lock}
export interface SimEquipment{name:string;label?:string;level:number;slots:SimSlot[]}
// Weights, slot chances and tier bands are copied from OverloadSimulatorProvider.
export const effectWeights:Record<string,number>={'우월 코드':10,'명중률':12,'장탄 수':12,'공격력':10,'차지 대미지':12,'차지 속도':12,'크리티컬 대미지':12,'크리티컬 확률':10,'방어력':10};
export const slotChances=[1,.5,.3];
export const tierWeight=(tier:number)=>tier<=5?12:tier<=10?7:1;
export function optionValue(type:string,tier:number){return tables.options[type as keyof typeof tables.options]?.[tier]??0;}
export function rollCost(eq:SimEquipment){const normal=eq.slots.filter(s=>s.lock==='module'||s.lock==='initial').length,keys=eq.slots.filter(s=>s.lock==='key').length;return {modules:1+normal+keys,keys:Array.from({length:keys},(_,i)=>[20,30,40][Math.min(2,normal+i)]).reduce((a,b)=>a+b,0)};}
function weighted<T>(values:{value:T;weight:number}[],random:()=>number):T{if(!values.length)throw Error('추첨 가능한 옵션이 없어요.');const total=values.reduce((sum,item)=>sum+item.weight,0);let pick=random()*total;for(const item of values){pick-=item.weight;if(pick<0)return item.value;}return values[values.length-1].value;}
export class OverloadSimulation{
 readonly original:Growth;
 equipment:SimEquipment[]=[];
 grade=0;core=0;bond=1;skills:[number,number,number]=[1,1,1];
 modulesRolled=0;modulesLocked=0;keysUsed=0;rolls=0;effectRolls:number[]=[];
 private previous=new Map<number,SimSlot[]>();
 constructor(source:Growth,private random:()=>number=Math.random){this.original=structuredClone(source);this.reset();}
 get modulesUsed(){return this.modulesRolled+this.modulesLocked;}
 reset(){const g=this.original;this.effectRolls=g.equipment.map(e=>e.options.length?1:0);this.equipment=g.equipment.map(e=>({name:e.name,label:e.label,level:e.level,slots:Array.from({length:3},(_,i)=>({type:(e.options.some(o=>o.slotIndex!==undefined)?e.options.find(o=>o.slotIndex===i):e.options[i])?.name??null,tier:(e.options.some(o=>o.slotIndex!==undefined)?e.options.find(o=>o.slotIndex===i):e.options[i])?.tier??null,lock:'none' as Lock}))}));this.grade=g.grade;this.core=g.core;this.bond=g.bond;this.skills=[...g.skills];this.modulesRolled=0;this.modulesLocked=0;this.keysUsed=0;this.rolls=0;this.previous.clear();}
 growth():Growth{return {...this.original,grade:this.grade,core:this.core,bond:this.bond,skills:[...this.skills],equipment:this.equipment.map(e=>({name:e.name,label:e.label,tier:10,level:e.level,options:e.slots.filter(s=>s.type!==null).map(s=>({name:s.type!,tier:s.tier??undefined,value:optionValue(s.type!,s.tier??0)}))}))};}
 get cp(){return level40Cp(this.growth());}
 canUndo(part:number){return this.previous.has(part);}
 canRoll(part:number,kind:'effect'|'value'){return this.equipment[part].slots.some(s=>s.lock==='none'&&(kind==='effect'||s.type!==null));}
 setLock(part:number,index:number,mode:Lock){const eq=this.equipment[part],slot=eq.slots[index];if(!slot.type)return;if(slot.lock===mode)mode='none';if(mode==='module'){const count=eq.slots.filter(s=>s.lock==='module'||s.lock==='initial').length;const costs=[0,2,5,9];this.modulesLocked+=costs[Math.min(3,count+1)]-costs[count];}slot.lock=mode;}
 undo(part:number){const slots=this.previous.get(part);if(!slots)return false;this.equipment[part].slots=structuredClone(slots);this.previous.delete(part);return true;}
 roll(part:number,kind:'effect'|'value'){
  if(!this.canRoll(part,kind))return false;
  const initialEffect=kind==='effect'&&this.effectRolls[part]===0;
  if(kind==='effect')this.effectRolls[part]++;
  const eq=this.equipment[part];this.previous.set(part,structuredClone(eq.slots));const cost=rollCost(eq);this.modulesRolled+=cost.modules;this.keysUsed+=cost.keys;this.rolls++;
  const excluded=new Set(eq.slots.filter(s=>s.lock!=='none'&&s.type).map(s=>s.type!));
  eq.slots.forEach((slot,index)=>{
   if(slot.lock!=='none')return;
   if(kind==='value'){
    if(!slot.type)return;
    slot.tier=weighted(Array.from({length:15},(_,i)=>({value:i+1,weight:tierWeight(i+1)})).filter(v=>v.value!==slot.tier),this.random);return;
   }
   if(this.random()>=slotChances[index]){slot.type=null;slot.tier=null;return;}
   // Conditional joint draw is equivalent to retrying an identical type/tier.
   const choices=Object.entries(effectWeights).filter(([type])=>!excluded.has(type)).flatMap(([type,weight])=>Array.from({length:initialEffect?1:15},(_,i)=>({value:{type,tier:initialEffect?11:i+1},weight:weight*(initialEffect?1:tierWeight(i+1))}))).filter(c=>c.value.type!==slot.type||c.value.tier!==slot.tier);
   const next=weighted(choices,this.random);slot.type=next.type;slot.tier=next.tier;excluded.add(next.type);
  });return true;
 }
}
