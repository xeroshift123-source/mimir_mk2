import {ApiError} from './errors.js';
import type {RawProfile,RawCharacter,RawEquipment} from '../shared/account.js';
type Obj=Record<string,any>;
export function parseProfileUrl(value:string){
 let url:URL;try{url=new URL(value);}catch{throw new ApiError(400,'올바른 BLABLALINK 프로필 주소를 입력해 주세요.');}
 if(url.protocol!=='https:'||!['blablalink.com','www.blablalink.com'].includes(url.hostname)||url.port||url.username||url.password||url.pathname!=='/user')throw new ApiError(400,'BLABLALINK의 HTTPS /user 프로필 주소가 필요해요.');
 let openId=url.searchParams.get('openid')?.trim()??'';
 if(!openId||openId.length>512||url.searchParams.getAll('openid').length!==1)throw new ApiError(400,'프로필 주소의 openid를 확인해 주세요.');
 if(/^[A-Za-z0-9+/=]+$/.test(openId)&&openId.length%4===0){const decoded=Buffer.from(openId,'base64').toString('utf8').replace(/\0/g,'').trim();if(/^[A-Za-z0-9_-]{1,200}$/.test(decoded))openId=decoded;}
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(openId))throw new ApiError(400,'지원하지 않는 프로필 식별자예요.');
 return openId;
}
export function hasIntroCode(profile:unknown,code:string):boolean{
 const visit=(value:unknown,depth:number):boolean=>{if(!value||typeof value!=='object'||depth>3)return false;return Object.entries(value).some(([key,item])=>(['signature','description','desc','bio','introduction','intro'].includes(key.toLowerCase())&&typeof item==='string'&&item.includes(code))||(['info','profile','user_profile','user'].includes(key)&&visit(item,depth+1)));};
 return visit(profile,0);
}
const integer=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
function quality(c:Obj,d:Obj){const missingFields:string[]=[];const check=(obj:Obj,key:string)=>{if(!integer(obj[key]))missingFields.push(key);};for(const key of ['name_code','grade','core'])check(c,key);for(const key of ['skill1_lv','skill2_lv','ulti_skill_lv','attractive_lv','favorite_item_tid','harmony_cube_tid'])check(d,key);for(const key of ['skill1_lv','skill2_lv','ulti_skill_lv'])if(d[key]===0)missingFields.push(key);if(d.favorite_item_tid)check(d,'favorite_item_lv');if(d.harmony_cube_tid)check(d,'harmony_cube_lv');for(const slot of ['head','torso','arm','leg']){check(d,slot+'_equip_tid');if(!d[slot+'_equip_tid'])continue;check(d,slot+'_equip_lv');const tier=Math.trunc(d[slot+'_equip_tid']/100)%100;if(tier<10)check(d,slot+'_equip_corporation_type');if(tier>=10)for(let i=1;i<=3;i++)check(d,`${slot}_equip_option${i}_id`);}return {schemaVersion:1,complete:!missingFields.length,missingFields};}
export interface ProfileProvider{publicProfile(openId:string):Promise<unknown>;collect(openId:string,publicProfile:unknown):Promise<RawProfile>}
export function blablaProvider(cookie='',transport:typeof fetch=fetch):ProfileProvider{
 async function post(path:string,body:Obj):Promise<Obj>{
  let response:Response;
  try{response=await transport('https://api.blablalink.com/api/'+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','X-language':'ko','Origin':'https://www.blablalink.com','Referer':'https://www.blablalink.com/',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}catch{throw new ApiError(502,'BLABLALINK 연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');}
  if(!response.ok)throw new ApiError(502,'BLABLALINK에서 정보를 가져오지 못했어요.');
  const reader=response.body?.getReader();if(!reader)throw new ApiError(502,'BLABLALINK 응답이 비어 있어요.');let bytes=0;const chunks:Uint8Array[]=[];try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>12*1024*1024){await reader.cancel();throw Error();}chunks.push(value);}}catch{throw new ApiError(502,'BLABLALINK 응답을 읽지 못했어요.');}
  let result:Obj;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(502,'BLABLALINK 응답 형식이 올바르지 않아요.');}
  if(result.code!==0||!result.data||typeof result.data!=='object')throw new ApiError(502,'프로필 공개 설정이나 BLABLALINK 연결 상태를 확인해 주세요.');return result.data;
 }
 return {
  publicProfile:openId=>post('ugc/direct/standalonesite/User/GetUserProfile',{intl_openid:openId}),
  async collect(openId,publicProfile){
   const profile=publicProfile as Obj;
   const game=await post('ugc/direct/standalonesite/User/GetUserGamePlayerInfo',{intl_openid:openId});
   const rawId=openId.includes('-')?openId.split('-')[1]:openId;
   const payload={intl_open_id:rawId,nikke_area_id:Number(game.area_id)||83};
   const [basic,outpost,list]=await Promise.all([post('game/proxy/Game/GetUserProfileBasicInfo',payload),post('game/proxy/Game/GetUserProfileOutpostInfo',payload),post('game/proxy/Game/GetUserCharacters',payload)]);
   const info={...game,...(basic.basic_info??basic),...(outpost.outpost_info??outpost)};
   if(!Array.isArray(list.characters)||list.characters.length>1000)throw new ApiError(502,'니케 목록을 확인할 수 없어요.');
   const detailMap=new Map<number,Obj>(),effects=new Map<number,unknown>();
   const codes=[...new Set<number>(list.characters.map((c:Obj)=>c.name_code).filter((v:unknown)=>Number.isSafeInteger(v)))];
   for(let i=0;i<codes.length;i+=100){const data=await post('game/proxy/Game/GetUserCharacterDetails',{...payload,name_codes:codes.slice(i,i+100)});if(!Array.isArray(data.character_details))throw new ApiError(502,'니케 육성 정보를 확인할 수 없어요.');for(const d of data.character_details)detailMap.set(d.name_code,d);for(const effect of data.state_effects??[])if(Number.isSafeInteger(effect.id)&&effect.function_details?.[0])effects.set(effect.id,{id:effect.id,function_details:[{function_type:effect.function_details[0].function_type,function_value:effect.function_details[0].function_value}]});}
   const characters:RawCharacter[]=list.characters.map((c:Obj)=>{const d=detailMap.get(c.name_code)??{};const equipment:RawEquipment[]=['head','torso','arm','leg'].flatMap(slot=>{const tid=d[slot+'_equip_tid'];return tid?[{slot,tid,tier:Math.trunc(Number(tid)/100)%100,level:d[slot+'_equip_lv']??0,corporationType:d[slot+'_equip_corporation_type']??0,overloadOptions:[1,2,3].map(n=>d[`${slot}_equip_option${n}_id`]??0)}]:[];});return {name_code:c.name_code,level:c.lv,combat:c.combat,grade:c.grade,core:c.core,skills:{skill1:d.skill1_lv??1,skill2:d.skill2_lv??1,burst:d.ulti_skill_lv??1},bondLevel:d.attractive_lv??1,favoriteItem:d.favorite_item_tid?{tid:d.favorite_item_tid,level:d.favorite_item_lv??0}:null,harmonyCube:d.harmony_cube_tid?{tid:d.harmony_cube_tid,level:d.harmony_cube_lv??0}:null,equipment,growthDataQuality:quality(c,d)};});
   let union=info.guild_name??'없음';const guildId=info.gsn??info.basic_info?.gsn;
   if(guildId&&String(guildId)!=='0'){try{const guild=await post('game/proxy/Game/GetGuildDetail',{...payload,guild_id:String(guildId)});union=guild.guild_detail?.guild_name??union;}catch{/* Optional guild lookup must not discard valid growth data. */}}
   const server=({'81':'일본','82':'일본','83':'한국','84':'글로벌','85':'글로벌','86':'동남아'} as Record<string,string>)[String(game.area_id)]??'알 수 없음';
   return {nickname:String(profile.info?.username??profile.username??'지휘관').slice(0,100),server,union:String(union).slice(0,100),synchroLevel:Number(info.synchro_level)||0,commanderLevel:Number(info.player_level)||0,ownedNikkesCount:Number(info.own_nikke_cnt??info.character_count)||characters.length,combatPower:Number(info.team_combat)||0,recycleRoom:Array.isArray(info.recycle_room_researches)?info.recycle_room_researches:[],recycleRoomComplete:Array.isArray(info.recycle_room_researches),characters,stateEffects:[...effects.values()]};
  }
 };
}
