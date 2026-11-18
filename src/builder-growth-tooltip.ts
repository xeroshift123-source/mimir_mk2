import {readCommanderCharacters} from './account-client';
import type {Nikke} from './deck-model';
import './builder-growth-tooltip.css';

const selector='[data-growth-nikke]';
const equipmentSlots=[['머리','머리'],['몸통','몸통'],['장갑','팔'],['신발','다리']];
const escapeText=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const level=(value:number|undefined,prefix='')=>typeof value==='number'&&Number.isInteger(value)&&value>=0?prefix+value:'—';

export function mountGrowthTooltip(root:HTMLElement,byId:ReadonlyMap<string,Nikke>){
 const tooltip=document.createElement('div');
 tooltip.id='builder-growth-tooltip';
 tooltip.className='builder-growth-tooltip';
 tooltip.setAttribute('role','tooltip');
 tooltip.hidden=true;
 root.append(tooltip);

 let anchor:HTMLElement|null=null,described:HTMLElement|null=null,request=0;
 function close(){
  request++;
  described?.removeAttribute('aria-describedby');
  described=null;
  anchor=null;
  tooltip.hidden=true;
 }
 async function show(target:HTMLElement,focus?:HTMLElement){
  if(anchor===target)return;
  close();
  anchor=target;
  const nikke=byId.get(target.dataset.growthNikke!);
  if(!nikke?.blablaNameCode)return;
  const current=request;
  try{
   const characters=await readCommanderCharacters();
   const growth=characters.find(character=>character.name_code===nikke.blablaNameCode);
   if(!growth||current!==request||!target.isConnected)return;
   const [{characterEquipment,characterCollection},{sumOptions,overloadColorClass,number}]=await Promise.all([
    import('./account-profile'),import('./profile-data'),
   ]);
   if(current!==request||!target.isConnected)return;
   const equipment=characterEquipment(growth);
   const collection=characterCollection(growth);
   const overload=sumOptions({equipment});
   const skills=[growth.skills?.skill1,growth.skills?.skill2,growth.skills?.burst].map(value=>level(value)).join(' / ');
   const collectionLabel=collection?(collection.rank==='favorite'
    ?'애장품 '+level(collection.level)+'단계':collection.rank+' 소장품 Lv.'+level(collection.level)):'—';
   tooltip.innerHTML=`<strong class="builder-growth-name">${escapeText(nikke.name)}</strong>
    <dl class="builder-growth-facts">
     <div><dt>돌파 · 코어</dt><dd>${level(growth.grade)}돌파 / ${level(growth.core,'+')}</dd></div>
     <div><dt>스킬 1 / 2 / 버스트</dt><dd>${skills}</dd></div>
     <div><dt>소장품</dt><dd>${collectionLabel}</dd></div>
    </dl>
    <strong class="builder-growth-label">장비 강화</strong>
    <dl class="builder-growth-equipment">${equipmentSlots.map(([label,name])=>`<div><dt>${label}</dt><dd>${level(equipment.find(item=>item.name===name)?.level,'+')}</dd></div>`).join('')}</dl>
    ${overload.length?`<strong class="builder-growth-label">오버로드 합계</strong><dl class="builder-growth-overload">${overload.map(option=>`<div class="${overloadColorClass(option.maxTier)}"><dt>${escapeText(option.name)}</dt><dd>+${number(option.value,2)}%</dd></div>`).join('')}</dl>`:''}`;
   tooltip.hidden=false;
   const rect=target.getBoundingClientRect(),width=tooltip.offsetWidth,height=tooltip.offsetHeight;
   const left=rect.right+10+width<=document.documentElement.clientWidth-8?rect.right+10:rect.left-width-10;
   tooltip.style.left=`${Math.max(8,left)}px`;
   tooltip.style.top=`${Math.max(8,Math.min(rect.top,window.innerHeight-height-8))}px`;
   if(focus){described=focus;focus.setAttribute('aria-describedby',tooltip.id);}
  }catch{if(current===request)close();}
 }

 const card=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLElement>(selector):null;
 root.addEventListener('pointerover',event=>{
  const target=card(event.target);
  if(event.pointerType==='mouse'&&!event.buttons&&target)void show(target);
 });
 root.addEventListener('pointerout',event=>{
  if(anchor&&card(event.target)===anchor&&card(event.relatedTarget)!==anchor)close();
 });
 root.addEventListener('focusin',event=>{
  const target=card(event.target);
  if(target&&event.target instanceof HTMLElement&&event.target.matches(':focus-visible'))void show(target,event.target);
 });
 root.addEventListener('focusout',event=>{if(card(event.target)===anchor)close();});
 root.addEventListener('pointerdown',close);
 root.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
 const listeners=new AbortController();
 window.addEventListener('scroll',close,{capture:true,passive:true,signal:listeners.signal});
 window.addEventListener('resize',close,{signal:listeners.signal});
 for(const event of ['mimir-account-changed','mimir-account-profile-changed']){
  document.addEventListener(event,close,{signal:listeners.signal});
 }
 const observer=new MutationObserver(()=>{
  if(!root.isConnected){listeners.abort();observer.disconnect();}
 });
 observer.observe(root.parentNode??document.body,{childList:true});
 return close;
}
