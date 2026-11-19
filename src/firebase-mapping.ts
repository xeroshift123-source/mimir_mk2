import type {AccountProfile,LinkedAccount,RawProfile,SavedScore} from '../shared/account';
import type {SharedDeckPost,SharedDeckInput} from '../shared/decks';
import type {BadgeState} from '../shared/achievements';

export type LegacyRecord=Record<string,any>;
export function savedDate(value:any):string{
 const date=value?.toDate?.()??(typeof value==='string'||typeof value==='number'?new Date(value):null);
 return date instanceof Date&&Number.isFinite(date.getTime())?date.toISOString():'';
}
export function linkedIds(data:LegacyRecord):string[]{return [...new Set([...(Array.isArray(data.linkedOpenIds)?data.linkedOpenIds:[]),data.openId].filter((v):v is string=>typeof v==='string'&&!!v.trim()&&!v.includes('/')))];}
export function linkedAccount(id:string,data:LegacyRecord,selected:string):LinkedAccount{return {id,nickname:String(data.nickname||'지휘관 정보 없음'),server:String(data.server||'알 수 없음'),updatedAt:savedDate(data.lastUpdatedAt),selected:id===selected};}
export function savedBadges(data:LegacyRecord):BadgeState{
 const unlocks=Object.entries(data.badgeUnlocks??{}).map(([id,value])=>({id,acquiredAt:savedDate((value as LegacyRecord)?.acquiredAt)}));
 return {unlocks,displayedBadgeIds:(Array.isArray(data.displayedBadgeIds)?data.displayedBadgeIds:[]).filter((id:string)=>unlocks.some(u=>u.id===id)).slice(0,10)};
}
export function savedProfile(account:LinkedAccount,data:LegacyRecord,stored:LegacyRecord):AccountProfile{
 const scores:Record<string,SavedScore>={};
 for(const [key,item] of Object.entries(stored.results??{}) as [string,LegacyRecord][]){
  const [code,weakness]=key.split(':');
  // Keep the persisted policy/version and quality metadata; never calculate on views.
  scores[key]={...item,nameCode:item.nameCode??Number(code),weakness:item.weakness??weakness} as SavedScore;
 }
 const profile={...data,characters:Array.isArray(data.characters)?data.characters:[],recycleRoom:Array.isArray(data.recycleRoom)?data.recycleRoom:[],recycleRoomComplete:data.recycleRoomComplete===true,stateEffects:Array.isArray(data.stateEffects)?data.stateEffects:[]} as RawProfile;
 const elementScores:NonNullable<AccountProfile['elementScores']>={};
 for(const item of stored.elements??[]){if(typeof item.score==='number'&&Number.isFinite(item.score))elementScores[String(item.key)]={score:item.score,sampleCount:item.sampleCount??0,average:item.average??null,topPercent:item.topPercent??null,rank:item.rank??null};}
 const nikkeComparisons:NonNullable<AccountProfile['nikkeComparisons']>={};
 for(const [key,item] of Object.entries(scores)){if(item.status==='complete'&&typeof item.nameCode==='number'&&item.weakness)nikkeComparisons[key]={nameCode:item.nameCode,weakness:item.weakness,score:item.score??null,average:item.average??null,topPercent:item.topPercent??null,sampleCount:item.sampleCount??0};}
 for(const [key,item] of Object.entries(stored.comparisons??{}) as [string,LegacyRecord][]){if(typeof item.nameCode==='number'&&typeof item.weakness==='string')nikkeComparisons[key]={nameCode:item.nameCode,weakness:item.weakness,score:item.score??null,average:item.average??null,topPercent:item.topPercent??null,rank:item.rank??null,sampleCount:item.sampleCount??0};}
 return {account,profile,scores,elementScores,nikkeComparisons,scoreStatus:stored.status??'not_saved'};
}
export function savedDeck(id:string,data:LegacyRecord):SharedDeckPost{
 const rows=(Array.isArray(data.squadsNikkeIds)?data.squadsNikkeIds:[]).map((row:any)=>Array.isArray(row)?row:Array.isArray(row?.nikkeIds)?row.nikkeIds:[]);
 return {id,title:String(data.title??''),description:String(data.description??''),season:String(data.season??''),squadDescriptions:data.squadDescriptions??[],authorId:String(data.authorUid??''),authorName:String(data.authorName||'지휘관'),createdAt:savedDate(data.createdAt),upvotes:Number(data.upvotes)||0,downvotes:Number(data.downvotes)||0,myVote:0,badgeIds:data.displayedBadgeIds??[],deck:{type:data.raidType==='union'?'union':'solo',squads:rows,names:data.squadNames??[],elements:data.squadWeaknessElements??[],weakness:data.weaknessElement??'Water',candidates:[],hasCandidate:false}};
}
export function legacyDeck(input:SharedDeckInput,uid:string,authorName:string){
 if(!input.title?.trim()||input.title.length>80||input.description.length>1200)throw Error('덱 제목은 80자, 전체 설명은 1,200자까지 입력해 주세요.');
 if(!['solo','union'].includes(input.deck.type)||input.deck.squads.length!==(input.deck.type==='solo'?5:3)||input.deck.squads.some(row=>row.length!==5||row.some(id=>typeof id!=='string'||!id)))throw Error('모든 스쿼드에 니케 5명을 편성해 주세요.');
 return {authorUid:uid,authorName,title:input.title.trim(),description:input.description,season:input.season,raidType:input.deck.type,squadNames:input.deck.names,squadWeaknessElements:input.deck.elements,squadDescriptions:input.squadDescriptions,weaknessElement:input.deck.weakness,squadsNikkeIds:input.deck.squads.map(nikkeIds=>({nikkeIds}))};
}
