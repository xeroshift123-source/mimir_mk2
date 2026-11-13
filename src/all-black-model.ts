import type {Growth} from './profile-data';
import type {Nikke} from './deck-model';
import {optionValue} from './overload-simulator-model';
import type {SimEquipment} from './overload-simulator-model';
export const allBlackTargets=[['우월 코드',4],['차지 속도',4],['공격력',2],['장탄 수',2]] as const;
export function allBlackProgress(equipment:SimEquipment[]){const slots=equipment.flatMap(e=>e.slots);return allBlackTargets.map(([name,target])=>({name,target,matched:Math.min(target,slots.filter(s=>s.type===name).length),count:Math.min(target,slots.filter(s=>s.type===name&&s.tier===15).length)}));}
export function allBlackComplete(equipment:SimEquipment[]){return equipment.length===4&&equipment.every(e=>e.slots.length===3)&&allBlackProgress(equipment).every(p=>p.count===p.target);}
export function neonChallengeGrowth(nikke:Nikke):Growth{return {nikke,level:400,cp:0,grade:0,core:0,bond:1,skills:[1,1,1],score:null,research:{common:0,role:0,company:0},collection:null,cube:null,equipment:['머리','몸통','팔','다리'].map(name=>({name,level:5,tier:10,options:[]}))};}

export function allBlackResultOptions(equipment:SimEquipment[]){const slots=equipment.flatMap(e=>e.slots);return allBlackTargets.map(([name])=>{const matched=slots.filter(s=>s.type===name);return {name,count:matched.length,value:Math.round(matched.reduce((sum,s)=>sum+optionValue(name,s.tier??0),0)*100)/100};});}
