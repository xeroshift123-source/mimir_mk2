import type {RawProfile,RawCharacter} from './account.js';
export interface BadgeUnlock {id:string;acquiredAt:string}
export interface BadgeState {unlocks:BadgeUnlock[];displayedBadgeIds:string[]}
export const overloaded=(e:RawCharacter['equipment'][number])=>e.tier>=10||e.overloadOptions.some(id=>id!==0);
export function ultimate(c:RawCharacter){
 const equipment=new Map(c.equipment.map(e=>[e.slot,e]));
 if(c.core!==7||Object.values(c.skills).some(l=>l!==10)||!['head','torso','arm','leg'].every(s=>{const e=equipment.get(s);return e&&overloaded(e)&&e.level===5;}))return false;
 const levels=[...equipment.values()].flatMap(e=>e.overloadOptions).filter(id=>id!==0).map(id=>id%100).filter(l=>l>=1&&l<=15);
 return levels.length>=11&&levels.reduce((a,b)=>a+b,0)/levels.length>=11;
}
/** Evaluated against a saved snapshot, never against client-supplied evidence. */
export function earnedBadges(profile:RawProfile):string[]{
 const chars=profile.characters.filter(c=>c.growthDataQuality?.complete===true),earned:string[]=[];
 const room=new Map(profile.recycleRoom.map(r=>[r.tid,r.lv]));
 if([5129,5169,5170].every(code=>chars.some(c=>c.name_code===code&&c.bondLevel>=40)))earned.push('counters');
 if(profile.recycleRoomComplete&&room.has(1101)&&room.has(1102)&&room.get(1101)!-room.get(1102)!>=10)earned.push('extreme_firepower');
 if(chars.some(c=>(c.harmonyCube?.level??0)>=15))earned.push('reliable_companion');
 const low=new Set([1013,1014,1015,1016,1017,1018,1023,1024,1025,3001,3002,3003,3005,3006,3007,3008,3009,3010,3011,3012,3013,3014,3015,3016,3018,3019,5063,5096]);
 if(chars.some(c=>low.has(c.name_code)&&['head','torso','arm','leg'].every(s=>c.equipment.some(e=>e.slot===s&&overloaded(e)))))earned.push('no_distinction');
 if(chars.some(c=>[5055,5056,5059,5078].includes(c.name_code)&&c.grade>=3))earned.push('union_leader_tears');
 if(chars.filter(c=>c.equipment.some(e=>e.slot==='leg'&&overloaded(e)&&e.level===5)).length>=20)earned.push('shoes_20');
 const max=Math.max(0,...chars.map(c=>c.level));
 for(const level of [400,500,600,700,808,911,1000])if(max>=level)earned.push('level_'+level);
 for(const c of chars)if(ultimate(c))earned.push('ultimate_'+c.name_code);
 return [...new Set(earned)];
}
