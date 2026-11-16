import type {RawProfile,ElementScore} from '../shared/account';
import themes from './data/recap-themes.json';
import type {Growth} from './profile-data';
import {number,sumOptions} from './profile-data';
import {elements} from './deck-model';
export interface RecapCard {title:string;detail:string;image?:string;colors:string[];eyebrow?:string;textColor?:string;accent?:string}
const costs=[[0,0,0,0],[8,0,0,0],[10,0,0,0],[26,0,0,0],[42,60,0,10],[126,90,0,15],[168,120,0,30],[210,150,90,70],[231,165,105,100],[273,190,120,135]];
export function skillInvestment(roster:Growth[]){const skill=[0,0,0],burst=[0,0,0],byElement:Record<string,number>={};let attribute=0;
 for(const g of roster)for(const [i,level] of g.skills.entries())for(let target=2;target<=level;target++){const c=costs[target-1];for(let j=0;j<3;j++)(i===2?burst:skill)[j]+=c[j];const amount=c[3]*(i===2?2:1);attribute+=amount;byElement[g.nikke.element]=(byElement[g.nikke.element]??0)+amount;}
 return {skill,burst,attribute,byElement,total:[...skill,...burst,attribute].reduce((a,b)=>a+b,0)};
}
const ol=(g:Growth)=>g.equipment.filter(e=>(e.tier??0)>=10||e.options.length>0);
/** Deterministic character choice for a saved account, independent of roster sorting. */
function pick(roster:Growth[],seed:string){const sorted=[...roster].sort((a,b)=>(a.nikke.blablaNameCode??0)-(b.nikke.blablaNameCode??0));let hash=0;for(let i=0;i<seed.length;i++)hash=(Math.imul(hash,31)+seed.charCodeAt(i))&0x7fffffff;return sorted[hash%sorted.length];}
export interface RecapContext {profile?:RawProfile;elementScores?:Record<string,ElementScore>;now?:Date}
// Accept the legacy date formats without treating absent or malformed dates as real records.
export function recapDate(value:unknown):Date|null{
 if(value==null||value==='')return null;
 if(typeof value==='object'&&!(value instanceof Date)){
  const v=value as {toDate?:()=>Date;seconds?:number;_seconds?:number};
  if(typeof v.toDate==='function'){try{return recapDate(v.toDate());}catch{return null;}}
  const seconds=v.seconds??v._seconds;return typeof seconds==='number'?recapDate(seconds*1000):null;
 }
 const raw=String(value).trim();let date:Date;
 if(/^\d{8}$/.test(raw)){const year=Number(raw.slice(0,4)),month=Number(raw.slice(4,6)),day=Number(raw.slice(6,8));date=new Date(Date.UTC(year,month-1,day));if(year<2000||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;}
 else if(value instanceof Date)date=value;
 else if(/^\d+$/.test(raw)){let n=Number(raw);if(n<=1000000000)return null;while(n>9999999999999)n=Math.floor(n/1000);date=new Date(n<100000000000?n*1000:n);}
 else if(typeof value==='string')date=new Date(value);else return null;
 return Number.isFinite(date.getTime())?date:null;
}
const seoulDay=(date:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function recapStoryComplete(value:unknown):boolean{
 // Verified against a user-confirmed 50-36 account saved in existing Firebase.
 if(Number(value)===6050044)return true;
 if(typeof value==='string')return value.toUpperCase().replace(/NORMAL|STAGE|BOSS/g,'').trim()==='50-36';
 if(value&&typeof value==='object'){const v=value as Record<string,unknown>;return Number(v.id)===6050044||(Number(v.chapter??v.chapter_id)===50&&Number(v.stage??v.stage_id)===36);}
 return false;
}
export function buildRecap(roster:Growth[],seed:string,context:RecapContext={}):RecapCard[]{
 if(!roster.length)return [];
 const cards:RecapCard[]=[];
 const add=(title:string,detail:string,g:Growth|undefined,colors:[string,string]=['#a94920','#161619'])=>cards.push({title,detail,image:g?'/'+g.nikke.imageUrl:undefined,colors});
 const profile=context.profile;
 const joined=recapDate(profile?.joinedAt??profile?.createdAt??profile?.created_at);
 if(joined){const start=seoulDay(joined),today=seoulDay(context.now??new Date()),days=Math.max(0,Math.floor((Date.parse(today)-Date.parse(start))/86400000));cards.push({title:`마리안과 처음 만난 지\n${number(days)}일이 지났어요`,detail:'가입일 '+start.replaceAll('-','.'),image:'/assets/nikke/marian.webp',colors:[],eyebrow:'OUR FIRST ENCOUNTER'});}
 if(recapStoryComplete(profile?.normalCampaign))cards.push({title:'니케의 모든 이야기를\n완료했어요',detail:'NORMAL 50-36',image:'/assets/nikke/marian_queen.webp',colors:[],eyebrow:'STORY COMPLETE'});
 const ranked=Object.entries(context.elementScores??{}).flatMap(([key,stat])=>{const code=Object.keys(elements).find(code=>code.toLowerCase()===key.toLowerCase());return code&&Number.isFinite(stat.score)&&stat.score>0&&stat.sampleCount>=20&&stat.topPercent!==null&&Number.isFinite(stat.topPercent)&&stat.topPercent>=0&&stat.topPercent<=100?[{code,...stat}]:[];}).sort((a,b)=>a.topPercent!-b.topPercent!||b.score-a.score||a.code.localeCompare(b.code));
 const bestScore=ranked[0];
 add(`${number(roster.length)}명의 니케들과\n함께했어요`,'',roster.find(g=>g.nikke.id==='privaty')??roster[0],['#127e79','#10232d']);
 const max=roster.filter(g=>g.core===7);add(`그중 ${number(max.length)}명의 니케의\n잠재력을 끝까지 폭발시켰어요`,'풀코강한 니케들의 수',pick(max,seed+':max-core'),['#7b1433','#141219']);
 const chips=skillInvestment(roster);add(`총 ${number(chips.total)}개의\n스킬 칩을 사용했어요`,`스킬 칩 · 파랑 ${number(chips.skill[0])} · 보라 ${number(chips.skill[1])} · 노랑 ${number(chips.skill[2])}\n버스트 칩 · 파랑 ${number(chips.burst[0])} · 보라 ${number(chips.burst[1])} · 노랑 ${number(chips.burst[2])}\n속성 칩 · ${number(chips.attribute)}`,roster.find(g=>g.nikke.id==='crown'),['#80642f','#201b16']);
 const top=Object.entries(chips.byElement).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
 if(top&&top[1]>0)add(`${elements[top[0]]} 속성에\n가장 많은 투자를 하셨군요!`,`속성 칩 ${number(top[1])}개`,roster.filter(g=>g.nikke.element===top[0]).sort((a,b)=>b.cp-a.cp)[0],['#284f80','#161e2f']);
 if(bestScore){const representative=roster.filter(g=>g.nikke.element===bestScore.code||(bestScore.code==='Iron'&&g.nikke.id==='rapi_red_hood')||(bestScore.code==='Water'&&g.nikke.id==='sugar')).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.cp-a.cp)[0];cards.push({title:`${elements[bestScore.code]} 속성 미미르 스코어가\n상위 ${number(bestScore.topPercent,1)}%로 가장 높아요!`,detail:`미미르 스코어 ${number(bestScore.score,2)}점 · ${number(bestScore.sampleCount)}계정 기준`,image:representative?'/'+representative.nikke.imageUrl:undefined,colors:[],eyebrow:'MIMIR SCORE'});}
 add(`${number(roster.reduce((n,g)=>n+ol(g).length,0))}개의\n오버로드 장비를 만들었어요`,'',roster.find(g=>g.nikke.id==='centi'),['#be5c08','#401523']);
 add(`니케들에게 ${number(roster.filter(g=>g.collection).length)}개의\n인형을 선물했어요`,'',roster.find(g=>g.nikke.id==='maxwell'),['#164a8d','#111827']);
 const shoes=roster.filter(g=>g.equipment.some(e=>e.name==='다리'&&e.level===5&&((e.tier??0)>=10||e.options.length>0)));
 if(shoes.length)add(`+5 강화 명품 신발을\n${number(shoes.length)}개나 가지고 있어요`,'+5강화한 신발의 갯수',pick(shoes,seed+':masterpiece-shoes'),['#6b6279','#15151c']);
 const costume=profile?.costumeCount;
 if((typeof costume==='number'||typeof costume==='string'&&costume.trim()!=='')&&Number.isSafeInteger(Number(costume))&&Number(costume)>=0)cards.push({title:`니케들의 코스튬을\n${number(Number(costume))}개나 가지고 있어요`,detail:'',image:'/assets/nikke/rupee.webp',colors:[],eyebrow:'FASHION COLLECTION'});
 const strength=(g:Growth)=>sumOptions(g).filter(o=>['우월 코드','공격력'].includes(o.name)).reduce((n,o)=>n+o.value,0);
 const strongest=[...roster].filter(g=>ol(g).length>0).sort((a,b)=>strength(b)-strength(a)||b.cp-a.cp||a.nikke.id.localeCompare(b.nikke.id))[0];
 if(strongest)add(`가장 강력한 니케는…\n${strongest.nikke.name}`,'우월코드 + 공격력이 제일 높은 니케',strongest,['#8a263a','#17121c']);
 const eva=roster.filter(g=>['asuka','rei(eva)','asuka_wille','rei_tentative_name'].includes(g.nikke.id)&&g.grade>=3);
 if(eva.length)add('에반게리온을\n정말 사랑해요!',eva.map(g=>g.nikke.name).join(', ')+'의 풀 돌파 보유',pick(eva,seed+':evangelion-full-limit'),['#463166','#17221b']);
 const crow=roster.find(g=>g.nikke.id==='crow'&&g.core>=1);if(crow)add('크로우단...\n이셨군요...? 세상에...',`크로우의 코어강화 +${crow.core}`,crow,['#781d39','#1c141c']);
 const attacker=roster.find(g=>g.nikke.type==='ATK'&&g.dataComplete!==false),defender=roster.find(g=>g.nikke.type==='DEF'&&g.dataComplete!==false);
 if(attacker&&defender&&attacker.research.role>defender.research.role)add(`화력을 방어보다\n${attacker.research.role-defender.research.role}만큼 더 사랑해요`,`화력형 콘솔 레벨 ${attacker.research.role}, 방어형 콘솔 레벨 ${defender.research.role}`,roster.find(g=>g.nikke.id==='neon_vision_eye'),['#075484','#111c2c']);
 const ult=roster.filter(g=>g.core===7&&g.skills.every(l=>l===10)&&ol(g).length===4&&g.equipment.every(e=>e.level===5)&&g.equipment.flatMap(e=>e.options).length>=11&&g.equipment.flatMap(e=>e.options).every(o=>o.tier!==undefined)&&g.equipment.flatMap(e=>e.options).reduce((a,o)=>a+o.tier!,0)/g.equipment.flatMap(e=>e.options).length>=11);
 if(ult.length)add(ult.length===1?`최강의 니케 ${ult[0].nikke.name}${(()=>{const c=ult[0].nikke.name.trim().charCodeAt(ult[0].nikke.name.trim().length-1);return c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?'을':'를';})()} 보유 중이에요`:`최강의 니케를\n${number(ult.length)}명 보유 중이에요`,'완전 강화 조건 달성',pick(ult,seed+':ultimate-nikke'),['#6a3b75','#241a20']);
 const soulmate=pick(roster.filter(g=>g.bond>=30&&ol(g).length===4),seed+':soulmate');if(soulmate){add('왠지 당신에게 어울릴거 같은\n천생연분 니케를 찾아봤어요!','',undefined,['#11162D','#120D22']);add(`당신의 천생연분 니케는...\n${soulmate.nikke.name}`,'',soulmate,['#6d1231','#2a101e']);}
 const elementThemes:Record<string,{colors:string[];accent:string}>={Fire:{colors:['#D62D20','#4A0B12'],accent:'#FFB09E'},Water:{colors:['#007EA8','#062A54'],accent:'#8DEBFF'},Wind:{colors:['#1FAE91','#123D52'],accent:'#B8FFE7'},Electric:{colors:['#7048D7','#21134C'],accent:'#D6C4FF'},Iron:{colors:['#9B7A42','#30343B'],accent:'#FFDEA0'}};
 const labels:[string,string][]=[['왠지 당신','ONE LAST STORY'],['천생연분 니케는','DESTINED PARTNER'],['잠재력','MAXIMUM POTENTIAL'],['스킬 칩','SKILL INVESTMENT'],['투자','ELEMENT SPECIALIST'],['오버로드 장비','OVERLOAD'],['인형','PRECIOUS GIFT'],['명품 신발','MASTERPIECE SHOES'],['가장 강력','THE STRONGEST NIKKE'],['에반게리온','EVANGELION LOVE'],['크로우','CROW DEVOTEE'],['화력을','FIREPOWER!'],['최강의 니케','ULTIMATE NIKKE']];
 for(const card of cards){card.eyebrow=card.eyebrow??labels.find(([key])=>card.title.includes(key))?.[1]??'TOGETHER WITH NIKKE';const theme=themes[card.eyebrow as keyof typeof themes];if(theme)Object.assign(card,theme);if(card.eyebrow==='MIMIR SCORE'&&bestScore)Object.assign(card,elementThemes[bestScore.code]);if(card.eyebrow==='ELEMENT SPECIALIST'&&top)Object.assign(card,elementThemes[top[0]]);if(card.eyebrow==='THE STRONGEST NIKKE'&&strongest){const t=elementThemes[strongest.nikke.element];card.colors=[t.colors[0],'#11131A',t.colors[1]];card.accent='#FFE17A';} }
 return cards;
}
