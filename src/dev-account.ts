import type {AccountProfile,AccountSession,SavedScore} from '../shared/account';
import type {BadgeState} from '../shared/achievements';
import {earnedBadges} from '../shared/achievements';
import {demoGrowth} from './profile-data';
import type {Nikke} from './deck-model';
const id='00000000-0000-4000-8000-000000000001';
let snapshot:Promise<AccountProfile>|undefined;
async function profile():Promise<AccountProfile>{
 if(!snapshot)snapshot=(async()=>{
  const response=await fetch('/data/nikkes.json');if(!response.ok)throw Error('테스트 데이터를 불러오지 못했어요.');
  const roster=demoGrowth(await response.json() as Nikke[]);
  const account={id,nickname:'테스트 지휘관',server:'한국',updatedAt:'2026-11-10T09:00:00.000Z',selected:true};
  const names=['우월 코드','명중률','장탄 수','공격력','차지 대미지','차지 속도','크리티컬 확률','크리티컬 대미지','방어력'];
  const characters=roster.map(g=>({name_code:g.nikke.blablaNameCode!,level:g.level,combat:g.cp,grade:g.grade,core:g.core,bondLevel:g.bond,skills:{skill1:g.skills[0],skill2:g.skills[1],burst:g.skills[2]},favoriteItem:g.collection?{tid:g.collection.rank==='favorite'?200000:g.collection.rank==='SR'?100002:100001,level:g.collection.rank==='favorite'?g.collection.level-1:g.collection.level}:null,harmonyCube:g.cube?{tid:g.cube.name==='차뎀'?1000302:g.cube.name==='명중률'?1000301:1000303,level:g.cube.level}:null,equipment:g.equipment.map((e,i)=>({slot:['head','torso','arm','leg'][i],tid:3101001+i*100000+(g.nikke.type==='DEF'?20000:g.nikke.type==='SUP'?30000:10000),tier:10,level:e.level,corporationType:0,overloadOptions:e.options.map(o=>(70005+names.indexOf(o.name))*100+o.tier!)})),growthDataQuality:{schemaVersion:1,complete:true,missingFields:[]}}));
  // Mix equipment states so every visual treatment can be reviewed in the roster.
  characters.forEach((c,index)=>{
   const variant=index%8;
   if(variant===0)return; // Fully upgraded overload reference.
   if(variant===5){c.equipment=[];return;} // Unequipped, not an unknown character.
   c.equipment=c.equipment.filter((_,slot)=>variant!==4||slot!==3).map((e,slot)=>{
    const tier=variant===1?9:variant===3?8:variant===2?[10,9,10,8][slot]:10;
    const level=variant===1?[5,3,1,0][slot]:variant===2?[3,5,0,2][slot]:variant===3?[0,1,2,3][slot]:[4,2,1,0][slot];
    return {...e,tid:e.tid-(10-tier)*100,tier,level,corporationType:tier===9?1:0,overloadOptions:tier<10?[0,0,0]:variant===6?[e.overloadOptions[0],0,0]:variant===7?[e.overloadOptions[0],0,e.overloadOptions[2]]:e.overloadOptions};
   });
  });
  const scores:Record<string,SavedScore>={},nikkeComparisons:NonNullable<AccountProfile['nikkeComparisons']>={};
  roster.forEach((g,i)=>{const weakness=g.nikke.element.toLowerCase(),key=g.nikke.blablaNameCode+':'+weakness,score=g.score??Math.round((110-i)*100)/100,topPercent=Number((8+i*3.5).toFixed(1));scores[key]={status:'complete',nameCode:g.nikke.blablaNameCode,weakness,score,damage:Math.round(score*1000000),policyHash:'synthetic-ui-fixture',calcVersion:'demo',sampleCount:120,average:145.5,topPercent};nikkeComparisons[key]={nameCode:g.nikke.blablaNameCode!,weakness,score,average:145.5-i*1.5,topPercent,sampleCount:120};});
  const elementScores:NonNullable<AccountProfile['elementScores']>={};
  ['Electric','Iron','Fire','Water','Wind'].forEach((element,i)=>{elementScores[element.toLowerCase()]={score:roster.filter(g=>g.nikke.element===element).reduce((n,g)=>n+(scores[g.nikke.blablaNameCode+':'+element.toLowerCase()].score??0),0),sampleCount:120,average:500,topPercent:[7.5,24,48,89,65][i]};});
  return {account,profile:{nickname:account.nickname,server:'한국',union:'테스트 유니온',synchroLevel:400,commanderLevel:250,ownedNikkesCount:characters.length,combatPower:825000,recycleRoom:[1001,1101,1102,1103,1201,1202,1203,1204,1205].map((tid,i)=>({tid,lv:[250,100,80,90,75,75,75,85,60][i]})),recycleRoomComplete:true,characters,stateEffects:[]},scores,nikkeComparisons,elementScores,scoreStatus:'complete'};
 })().catch(e=>{snapshot=undefined;throw e;});
 return snapshot;
}
/** Local development fixture: never forwards writes to the account server. */
export async function devApi(path:string,body?:unknown):Promise<unknown>{
 if(!import.meta.env.DEV)throw Error('개발 환경에서만 사용할 수 있어요.');
 const data=await profile();
 if(path==='/session')return {configured:false,user:{id:'local-dummy',nickname:'테스트 지휘관',email:'test.commander@example.com',picture:'/assets/mimir-logo.png'},accounts:[data.account]} satisfies AccountSession;
 if(path==='/account/delete'){if((body as {confirmation?:string})?.confirmation!=='탈퇴')throw Error('탈퇴를 입력해 주세요.');sessionStorage.removeItem('mimir-dev-account');sessionStorage.removeItem('mimir-dev-badges');sessionStorage.removeItem('mimir-dev-worldcup-badges');snapshot=undefined;return {ok:true};}
 if(path==='/logout'){sessionStorage.removeItem('mimir-dev-account');return {ok:true};}
 if(path==='/accounts/'+id||path==='/accounts/'+id+'/refresh')return data;
 if(path==='/accounts/'+id+'/select')return {ok:true};
 const worldcupUnlocks=JSON.parse(sessionStorage.getItem('mimir-dev-worldcup-badges')??'[]') as {id:string;acquiredAt:string}[];
 const unlocks=[...earnedBadges(data.profile).map(id=>({id,acquiredAt:'2026-11-10T09:00:00.000Z'})),...worldcupUnlocks];
 if(path==='/worldcup/badge'){
  const [response,model]=await Promise.all([fetch('/data/nikkes.json'),import('./nikke-worldcup-model')]);const catalog=await response.json() as {id:string}[];const ids=new Set(catalog.map(n=>n.id));if(!model.validWorldcup(body,ids)||body.pool.length!==1||body.total!==ids.size)throw Error('전체 니케 월드컵을 끝까지 완료해 주세요.');const badgeId='worldcup_'+body.pool[0];if(!worldcupUnlocks.some(u=>u.id===badgeId)){worldcupUnlocks.splice(0,worldcupUnlocks.length,{id:badgeId,acquiredAt:new Date().toISOString()});const display=JSON.parse(sessionStorage.getItem('mimir-dev-badges')??'[]') as string[];sessionStorage.setItem('mimir-dev-badges',JSON.stringify(display.filter(id=>!id.startsWith('worldcup_'))));sessionStorage.setItem('mimir-dev-worldcup-badges',JSON.stringify(worldcupUnlocks));}return {badgeId};
 }
 if(path==='/badges')return {unlocks,displayedBadgeIds:JSON.parse(sessionStorage.getItem('mimir-dev-badges')??'["level_400","reliable_companion"]')} satisfies BadgeState;
 if(path==='/badges/display'){
  const ids=(body as {badgeIds:string[]}).badgeIds;
  if(ids.length>10||new Set(ids).size!==ids.length||ids.some(id=>!unlocks.some(u=>u.id===id)))throw Error('획득한 뱃지를 최대 10개 선택해 주세요.');
  sessionStorage.setItem('mimir-dev-badges',JSON.stringify(ids));return {displayedBadgeIds:ids};
 }
 throw Error('더미 계정에서는 실제 계정 연결을 진행하지 않아요.');
}
