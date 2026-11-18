import type {Nikke} from './deck-model';
import type {Growth} from './profile-data';
import type {AccountProfile,RawCharacter,SavedScore} from '../shared/account';
import equipmentNames from './data/equipment-names.json';
import stats from './data/profile-stats.json';
const optionNames=['우월 코드','명중률','장탄 수','공격력','차지 대미지','차지 속도','크리티컬 확률','크리티컬 대미지','방어력'] as const;
const cubeNames=['명중률','차뎀','재장전','탄충','차속','장탄수','버충','체력','방어력','힐량','뎀감','체증','파츠뎀','관통뎀','방무뎀','엄폐물'];
export const validScore=(score:SavedScore)=>score.status==='complete'&&typeof score.score==='number'&&Number.isFinite(score.score)&&score.score>=0;
export const researchIds:[number,string][]=[[1001,'공통'],[1101,'화력형'],[1102,'방어형'],[1103,'지원형'],[1201,'엘리시온'],[1202,'미실리스'],[1203,'테트라'],[1204,'필그림'],[1205,'어브노멀']];
export const characterEquipment=(c:RawCharacter)=> (Array.isArray(c.equipment)?c.equipment:[]).map(e=>({name:({head:'머리',torso:'몸통',arm:'팔',leg:'다리'} as Record<string,string>)[e.slot]??e.slot,label:equipmentNames[String(e.tid) as keyof typeof equipmentNames],tier:e.tier,level:e.level,options:(Array.isArray(e.overloadOptions)?e.overloadOptions:[]).flatMap((id,slotIndex)=>{const index=Math.floor(id/100)-70005,tier=id%100,name=optionNames[index];return name&&tier>=1&&tier<=15?[{name,tier,slotIndex,value:stats.options[name][tier]}]:[];})}));
export const characterCollection=(c:RawCharacter)=>c.favoriteItem?{rank:c.favoriteItem.tid>=200000?'favorite' as const:c.favoriteItem.tid%10===2?'SR' as const:'R' as const,level:c.favoriteItem.tid>=200000?c.favoriteItem.level+1:c.favoriteItem.level}:null;
export function profileGrowth(account:AccountProfile,catalog:Nikke[]){const byCode=new Map(catalog.map(n=>[n.blablaNameCode,n]));let skipped=0;const room=new Map(account.profile.recycleRoom.map(r=>[r.tid,r.lv]));const roster:Growth[]=account.profile.characters.flatMap(c=>{
 const nikke=byCode.get(c.name_code);const known=[c.level,c.combat,c.grade,c.core,c.bondLevel,c.skills?.skill1,c.skills?.skill2,c.skills?.burst].every(n=>Number.isSafeInteger(n)&&n>=0);
 if(!nikke||!known||c.grade>3||c.core>7||(c.core>0&&c.grade!==3)||c.level<1||c.bondLevel<1||c.bondLevel>40||[c.skills.skill1,c.skills.skill2,c.skills.burst].some(v=>v<1||v>10)||c.growthDataQuality?.complete!==true){skipped++;return [];}
 const saved=Object.values(account.scores).filter(s=>s.nameCode===c.name_code&&validScore(s));const detail=saved.find(s=>s.weakness===nikke.element.toLowerCase())??saved[0];
 return [{nikke,isDemo:false,dataComplete:account.profile.recycleRoomComplete&&researchIds.every(([id])=>Number.isSafeInteger(room.get(id))),level:c.level,cp:c.combat,grade:c.grade,core:c.core,bond:c.bondLevel,skills:[c.skills.skill1,c.skills.skill2,c.skills.burst] as [number,number,number],research:{common:room.get(1001)??0,role:room.get(({ATK:1101,DEF:1102,SUP:1103} as Record<string,number>)[nikke.type])??0,company:room.get(({Elysion:1201,Missilis:1202,Tetra:1203,Pilgrim:1204,Abnormal:1205} as Record<string,number>)[nikke.company])??0},score:detail?.score??null,scoreDetails:detail,equipment:characterEquipment(c),cube:c.harmonyCube?{name:cubeNames[c.harmonyCube.tid-1000301]??'큐브',level:c.harmonyCube.level}:null,collection:characterCollection(c)}];
 });return {roster,skipped};}
