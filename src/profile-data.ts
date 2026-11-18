import type {Nikke} from './deck-model';
import type {SavedScore} from '../shared/account';
import stats from './data/profile-stats.json';
import equipmentNames from './data/equipment-names.json';

// Synthetic UI fixtures only. No account records, measured damage or rankings.
export interface Collection {rank:'R'|'SR'|'favorite';level:number}
export function collectionProgress(item:Collection){return Math.max(0,Math.min(3,item.rank==='favorite'?Math.floor(item.level):Math.floor(item.level/5)));}
export interface Growth {nikke:Nikke;isDemo?:boolean;dataComplete?:boolean;scoreDetails?:SavedScore;level:number;cp:number;grade:number;research:{common:number;role:number;company:number};core:number;bond:number;skills:[number,number,number];score:number|null;equipment:{name:string;level:number;tier?:number;label?:string;options:{name:string;value:number;tier?:number;slotIndex?:number}[]}[];cube:{name:string;level:number}|null;collection:Collection|null}
export const demoIds=['rapi_red_hood','cinderella','scarlet_black_shadow','marian_queen','dorothy_serendipity','anis_star','crown','little_mermaid','nayuta','naga','liter','privaty','alice','dorothy','red_hood','snow_white','modernia','helm','tove','blanc','noir','d','miranda','drake'];
export function demoGrowth(catalog:Nikke[]):Growth[]{
 const byId=new Map(catalog.map(n=>[n.id,n]));
 return demoIds.flatMap((id,i)=>{const nikke=byId.get(id);if(!nikke)return [];return [{nikke,isDemo:true,grade:3,research:{common:100,role:nikke.type==='DEF'?75:80,company:({Elysion:70,Missilis:75,Tetra:75,Pilgrim:85,Abnormal:60} as Record<string,number>)[nikke.company]??0},level:400,cp:Math.max(85000,182450-i*3140),core:Math.max(0,7-Math.floor(i/3)),bond:i<8?40:30,skills:(i<8?[10,10,10]:i<16?[7,7,10]:[4,4,7]) as [number,number,number],score:i<16?Number((248.62-i*8.37).toFixed(2)):null,equipment:['머리','몸통','팔','다리'].map((name,j)=>({name,level:5,tier:10,label:equipmentNames[String(3101001+j*100000+(nikke.type==='DEF'?20000:nikke.type==='SUP'?30000:10000)) as keyof typeof equipmentNames],options:[{name:'공격력',value:Math.max(4.77,14.63-(i%4)*1.18)},{name:'우월 코드',value:Math.max(9.54,29.26-j*2.9-(i%3)*1.1)},{name:j%2?'장탄 수':'차지 속도',value:j%2?68.93:4.92}].map(option=>{const values=stats.options[option.name as keyof typeof stats.options];const tier=values.reduce((best,value,index)=>index>0&&Math.abs(value-option.value)<Math.abs(values[best]-option.value)?index:best,1);return {...option,value:values[tier],tier};})})),cube:i===23?null:{name:i%3===0?'차뎀':i%3===1?'재장전':'명중률',level:i<12?15:10},collection:i===23?null:{rank:(i%6===1?'favorite':i%6===3?'R':'SR') as Collection['rank'],level:i%6===1?3:[15,3,10,0,5,0][i%6]}}];});
}
export const number=(value:number|null|undefined,digits=0)=>value==null?'—':value.toLocaleString('ko-KR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
/** Game UI colors are based on option tier, never the summed percentage. */
export function overloadColorClass(tier:number|undefined){return tier===15?'overload-max':tier!==undefined&&tier>=12&&tier<=14?'overload-high':tier!==undefined&&tier>=1&&tier<=11?'overload-normal':'overload-unknown';}
export function sumOptions(item:Pick<Growth,'equipment'>){const groups=new Map<string,{name:string;value:number;count:number;maxTier:number}>();for(const eq of item.equipment)for(const option of eq.options){const group=groups.get(option.name)??{name:option.name,value:0,count:0,maxTier:0};group.value+=option.value;group.count++;group.maxTier=Math.max(group.maxTier,option.tier??0);groups.set(option.name,group);}return [...groups.values()].sort((a,b)=>b.count-a.count||b.value-a.value);}
/** Same priority and max-tier color rule as the original roster. */
export function topOverloadOptions(item:Growth){return sumOptions(item).slice(0,4);}
