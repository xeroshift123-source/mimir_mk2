import type {Growth} from './profile-data';
import {matchesNikke} from './deck-model';
import tables from './data/profile-stats.json';

export type ProfileFilters=Record<'burst'|'element'|'company'|'weaponType',Set<string>>;
export const emptyProfileFilters=():ProfileFilters=>({burst:new Set(),element:new Set(),company:new Set(),weaponType:new Set()});
export const profileSorts:Record<string,string>={cp:'전투력',cp40:'40레벨 투력',uko:'우코',atk:'공격력',ukoAtk:'우공',score:'스코어',name:'이름',skill:'스킬 레벨'};
export function overloadTotal(g:Growth,kind:string){return g.equipment.flatMap(e=>e.options).filter(o=>kind==='uko'?o.name.replace(/\s/g,'').includes('우월코드'):kind==='atk'?o.name.includes('공격력'):o.name.includes('공격력')||o.name.replace(/\s/g,'').includes('우월코드')).reduce((sum,o)=>sum+o.value,0);}
/** Round exact halves to the even integer (Python round convention). */
export function pyRound(value:number){const lower=Math.floor(value),fraction=value-lower;return fraction===.5?lower+(Math.abs(lower)%2):Math.round(value);}
/** Port of C:\MIMIR\lib\utils\cp_calculator.dart, using its level-40 tables.
 * Missing equipment/tier data stays unavailable instead of inventing a CP. */
export function level40Cp(g:Growth,assumeCube15=true):number|null{
 if(g.dataComplete===false)return null;
 if(g.equipment.length!==4||g.equipment.some(e=>(!e.options.length&&(e.tier??0)<10)||e.options.some(o=>!o.tier||o.tier<1||o.tier>15)))return null;
 const role=g.nikke.type==='DEF'?'Defender':g.nikke.type==='SUP'?'Supporter':'Attacker';
 const base=tables.base[role],bond=tables.bond[String(g.bond) as keyof typeof tables.bond]?.[role];
 if(!bond)return null;
 const cubeLevel=assumeCube15?15:g.cube?.level??0;
 const cube=cubeLevel?tables.cube[String(cubeLevel) as keyof typeof tables.cube]:null;
 const grade=g.collection?.rank==='favorite'?'SR':g.collection?.rank??'R';
 const colLevel=g.collection?.rank==='favorite'?15:g.collection?.level??0;
 // The legacy calculator uses R level 0 even when the collection is absent.
 const col=tables.collection[grade][String(colLevel) as keyof typeof tables.collection.R];
 if(!col||(g.cube&&!cube))return null;
 const equip={HP:0,ATK:0,DEF:0};
 const slots:Record<string,string>={'머리':'head','몸통':'torso','팔':'arm','다리':'leg'};
 for(const e of g.equipment){const row=tables.equipment[role]['0'];const values=row[slots[e.name] as keyof typeof row] as {HP?:number;ATK?:number;DEF?:number}|undefined;if(!values)return null;for(const key of ['HP','ATK','DEF'] as const)equip[key]+=(values[key]??0)*(10+Math.min(5,Math.max(0,e.level)))/10;}
 const consoleStats={HP:g.research.common*450+g.research.role*750,ATK:g.research.company*25,DEF:g.research.role*5+g.research.company*5};
 const baseStats={HP:base.HP,ATK:base.ATK,DEF:base.DEF[g.nikke.weaponType as keyof typeof base.DEF]??base.DEF.AR};
 const perGrade={HP:3000,ATK:20,DEF:100};const final={HP:0,ATK:0,DEF:0};
 // This table contains overload level-0 stats, so no additional T9 manufacturer bonus.
 // Keep fractions until the completed stat, except for the limit-break floor.
 for(const key of ['HP','ATK','DEF'] as const){
  const limitBreak=Math.floor((baseStats[key]*(100+2*g.grade)+100*perGrade[key]*g.grade)/100);
  final[key]=Math.floor((limitBreak+bond[key]+consoleStats[key])*(100+2*g.core)/100+equip[key]+col[key]+(cube?.[key]??0));
 }
 const overloadValue=g.equipment.flatMap(e=>e.options).reduce((sum,o)=>sum+pyRound((o.name.replace(/\s/g,'').includes('우월코드')?82.8:69)*o.tier!),0);
 const cubeCoef=cube?cube.s1+cube.s2+(cubeLevel>=5?4:0):0;
 // Legacy conversion retained pending the actual per-level cube/collection coefficient tables.
 const colCoef=grade==='R'?col.skill*6.33:col.skill*2+10.66;
 const coef=1.3+.01*g.skills[0]+.01*g.skills[1]+.02*g.skills[2]+overloadValue/10000+.0092*cubeCoef+.0069*colCoef;
 const survival=Math.floor(7*(final.HP+100*final.DEF)/10);
 const attack=Math.floor(final.ATK*387/20); // ATK x 1.075 x 18.
 return pyRound((survival+attack)*coef/100);
}
export function profileSortValue(g:Growth,sort:string){return sort==='cp40'?level40Cp(g):['uko','atk','ukoAtk'].includes(sort)?overloadTotal(g,sort):sort==='skill'?g.skills.reduce((s,n)=>s+n,0):sort==='score'?g.score:g.cp;}
export function filterAndSortRoster(roster:Growth[],query:string,filters:ProfileFilters,sort:string){
 return roster.filter(g=>matchesNikke(g.nikke,query,{...filters,burst:g.nikke.burst==='0'?new Set():filters.burst})).sort((a,b)=>sort==='name'?a.nikke.name.localeCompare(b.nikke.name,'ko'):(profileSortValue(b,sort)??-1)-(profileSortValue(a,sort)??-1)||b.cp-a.cp);
}
