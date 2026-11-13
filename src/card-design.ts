import type {Nikke} from './deck-model';
export const elementIcon=(n:Nikke)=>`/assets/icons/elements/icon-elements-${n.element}.webp`;
export const burstIcon=(n:Nikke)=>`/assets/icons/burst/icon-burst-${Number(n.burst)}.webp`;
/** Original capture rules: raid matches take precedence over generic traits. */
export function squadTraits(nikkes:Nikke[],weakness:string,raidKeywords:string[]=[]){
 const count=(ability:string)=>nikkes.filter(n=>n.ability.includes(ability)).length;
 const cooldown=count('버스트 쿨타임 감소')>0,extended=count('풀 버스트 시간 증가')>0;
 const specialTags:string[]=[],genericTags:string[]=[];
 const add=(label:string,aliases:string[],has:boolean,generic:boolean)=>{if(has&&aliases.some(k=>raidKeywords.includes(k)))specialTags.push(label);else if(generic)genericTags.push(label);};
 add('코어',['코어'],count('코어데미지증가')>0,false);
 add('파츠',['파츠'],count('파츠')>0,count('파츠')>=2);
 add('힐',['힐'],count('힐')>0,count('힐')>0);
 const tove=nikkes.some(n=>n.name==='토브');add('샷건',['샷건'],tove,tove);
 for(const [ability,label] of [['방어력무시데미지','방무뎀'],['관통데미지','관통뎀'],['지속데미지','지속딜'],['받는데미지증가','받뎀증'],['분배데미지','분배뎀']])add(label,[ability,label],count(ability)>0,count(ability)>=2);
 add('재장전',['재장전속도증가','재장전'],count('재장전속도증가')>0,count('재장전속도증가')>0);
 const explosion=count('폭발데미지');add('폭발뎀',['폭발데미지','폭발뎀'],explosion>0,explosion>=2||(explosion>=1&&nikkes.some(n=>n.weaponType==='RL')));
 return {weakness:nikkes.some(n=>n.element===weakness),cooldown:cooldown||extended,cooldownLabel:!cooldown&&extended?'풀버연장':'버쿨감',specialTags,genericTags,tags:[...specialTags,...genericTags]};
}
