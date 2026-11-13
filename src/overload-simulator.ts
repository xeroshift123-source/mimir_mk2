import {loadingMarkup} from './loading';
import {allBlackProgress,allBlackComplete,allBlackResultOptions} from './all-black-model';
import './my-nikke.css';
import './all-black.css';
import type {Growth} from './profile-data';
import {number,overloadColorClass,sumOptions} from './profile-data';
import {OverloadSimulation,rollCost,optionValue,effectWeights as effectNames} from './overload-simulator-model';
import type {Lock,SimSlot} from './overload-simulator-model';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const lockNames:Record<Lock,string>={none:'잠금 해제',module:'모듈 잠금',initial:'기존 잠금',key:'락키 잠금'};
export function showSimulator(source:Growth,isCurrent:()=>boolean,allBlack=false){
 if(!isCurrent())return;
 if(allBlack&&document.querySelector('.all-black-dialog'))return;
 const sim=new OverloadSimulation(source),baseline=sim.cp;
 const saveKey='mimir-all-black-neon-v1';let storageFailed=false;
 if(allBlack)try{const saved=JSON.parse(localStorage.getItem(saveKey)??'null');if(saved&&saved.equipment?.length===4&&saved.equipment.every((e:any,i:number)=>e.name===sim.equipment[i].name&&e.slots?.length===3&&e.slots.every((s:any)=>(s.type===null||Object.hasOwn(effectNames,s.type))&&(s.tier===null||Number.isInteger(s.tier)&&s.tier>=1&&s.tier<=15)&&['none','module'].includes(s.lock)))&&[saved.modulesRolled,saved.modulesLocked,saved.rolls].every(n=>Number.isSafeInteger(n)&&n>=0)){sim.equipment=saved.equipment;sim.effectRolls=saved.equipment.map((e:any,i:number)=>Array.isArray(saved.effectRolls)&&Number.isSafeInteger(saved.effectRolls[i])&&saved.effectRolls[i]>=0?saved.effectRolls[i]:e.slots.some((s:any)=>s.type)?1:0);sim.modulesRolled=saved.modulesRolled;sim.modulesLocked=saved.modulesLocked;sim.rolls=saved.rolls;}}catch{}
 const saveChallenge=()=>{if(!allBlack)return;try{localStorage.setItem(saveKey,JSON.stringify({equipment:sim.equipment,effectRolls:sim.effectRolls,modulesRolled:sim.modulesRolled,modulesLocked:sim.modulesLocked,rolls:sim.rolls}));storageFailed=false;}catch{storageFailed=true;}};

 const dialog=document.createElement('dialog');dialog.className='overload-simulator-dialog'+(allBlack?' all-black-dialog':'');dialog.setAttribute('aria-labelledby','sim-title');
 let clearImageRequest:Promise<Blob>|null=null,clearImageUrl='';
 const getClearImage=()=>clearImageRequest??=import('./all-black-result-image').then(m=>m.allBlackResultImage(source.nikke,structuredClone(sim.equipment),sim.modulesUsed)).catch(error=>{clearImageRequest=null;throw error;});
 let message=allBlack?'네온 : 비전아이의 12개 목표 옵션을 모두 Lv.15로 완성하세요. 잠금 비용도 모듈 사용량에 포함됩니다.':'현재 장비에서 시작합니다. 시뮬레이션은 내 니케 정보를 변경하지 않아요.';
 const close=()=>{if(dialog.open)dialog.close();};window.addEventListener('hashchange',close);
 dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',close);if(clearImageUrl)URL.revokeObjectURL(clearImageUrl);dialog.remove();},{once:true});
 function slotSnapshot(part:number){return {slots:structuredClone(sim.equipment[part].slots),elements:Array.from(dialog.querySelectorAll('.sim-equipment')[part].querySelectorAll<HTMLElement>('.sim-slot')).map(el=>({content:el.querySelector('.sim-slot-value')!.cloneNode(true) as HTMLElement,background:getComputedStyle(el).backgroundColor,name:getComputedStyle(el.querySelector('.sim-slot-value')!).color,value:getComputedStyle(el.querySelector('.sim-slot-value b')??el).color}))};}
 function animateSlots(part:number,before:{slots:SimSlot[];elements:{content:HTMLElement;background:string;name:string;value:string}[]}){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const elements=dialog.querySelectorAll('.sim-equipment')[part].querySelectorAll<HTMLElement>('.sim-slot');
  sim.equipment[part].slots.forEach((slot,index)=>{
   const old=before.slots[index];if(old.type===slot.type&&old.tier===slot.tier)return;
   const el=elements[index],content=el.querySelector<HTMLElement>('.sim-slot-value')!,previous=before.elements[index];
   el.animate([{backgroundColor:previous.background},{backgroundColor:getComputedStyle(el).backgroundColor}],{duration:300,easing:'ease-out'});
   content.animate([{opacity:0,transform:'translateY(20%)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'ease-out'});
   const ghost=previous.content;ghost.classList.add('sim-option-outgoing');ghost.setAttribute('aria-hidden','true');ghost.style.color=previous.name;ghost.style.setProperty('--overload-value',previous.value);el.append(ghost);
   const out=ghost.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(20%)'}],{duration:400,easing:'ease-out',fill:'forwards'});
   void out.finished.then(()=>ghost.remove(),()=>ghost.remove());
  });
 }
 function render(){
  saveChallenge();
  if(allBlack&&allBlackComplete(sim.equipment)){
   dialog.innerHTML=`<header class="sim-heading"><h2 id="sim-title">올블랙 챌린지 · 클리어</h2><button data-sim="close" aria-label="시뮬레이터 닫기">×</button></header><section class="all-black-clear" aria-label="올블랙 챌린지 클리어 카드"><span class="all-black-clear-brand">MIMIR · ALL BLACK CHALLENGE</span><img src="/${esc(source.nikke.imageUrl)}" alt="${esc(source.nikke.name)}"/><div><p>${number(sim.modulesUsed)}개의 모듈로</p><h3>지상 최강의 화력을 완성!</h3><dl class="all-black-result-options">${allBlackResultOptions(sim.equipment).map(o=>`<div><dt>${esc(o.name)} <small>(${o.count})</small></dt><dd>+${o.value.toFixed(2)}%</dd></div>`).join('')}</dl><span>12개 옵션 모두 Lv.15</span></div></section><div class="all-black-clear-actions"><button data-sim="copy">이미지 복사</button><button data-sim="reset">다시 도전</button><button data-sim="close">닫기</button></div><p class="all-black-export-status" role="status"></p>`;dialog.scrollTop=0;
   const card=dialog.querySelector<HTMLElement>('.all-black-clear')!;
   void getClearImage().then(blob=>{if(!card.isConnected)return;if(clearImageUrl)URL.revokeObjectURL(clearImageUrl);clearImageUrl=URL.createObjectURL(blob);const preview=new Image();preview.className='all-black-share-preview';preview.alt='올블랙 챌린지 · '+source.nikke.name+' 클리어 카드';preview.src=clearImageUrl;card.replaceChildren(preview);}).catch(error=>{const status=dialog.querySelector('.all-black-export-status');if(card.isConnected&&status)status.textContent=(error as Error).message;});
   return;
  }
  const scroll=dialog.scrollTop,rulesOpen=dialog.querySelector<HTMLDetailsElement>('.sim-rules')?.open??false;
  const growth=sim.growth(),cp=sim.cp,diff=cp===null||baseline===null?null:cp-baseline;
  const limit=sim.grade+sim.core;
  dialog.innerHTML=`<header class="sim-heading"><div><small>OVERLOAD LAB / Lv.40</small><h2 id="sim-title">${allBlack?'올블랙 챌린지':'모듈작 시뮬레이터'}</h2><p>${esc(source.nikke.name)} · ${allBlack?'모듈 사용량 도전':source.isDemo?'예시 육성 데이터':'연결된 계정의 육성 정보'}</p></div><div><button data-sim="reset">${allBlack?'처음부터':'원본으로 초기화'}</button><button data-sim="close" aria-label="시뮬레이터 닫기">×</button></div></header><div class="sim-resource-bar"><div class="sim-cp"><span>40레벨 전투력 <small>협투력</small></span><strong>${number(cp)}</strong><b>${diff===null?'—':(diff>0?'+':'')+number(diff)}</b><small>시작 대비 · 큐브 Lv.15</small></div><div class="sim-resources"><span><img src="/assets/icons/module.png" alt=""/>커스텀 모듈 <b>${sim.modulesUsed}</b></span><span><img src="/assets/icons/lockkey.png" alt=""/>락키 <b>${sim.keysUsed}</b></span><span>변경 횟수 <b>${sim.rolls}</b></span></div></div><p class="sim-notice" role="status">${esc(message)}</p><div class="sim-layout"><aside><section class="sim-panel"><h3>오버로드 합계</h3><div class="sim-totals">${sumOptions(growth).map(o=>`<div class="${overloadColorClass(o.maxTier)}"><span>${esc(o.name)} <small>(${o.count})</small></span><b>+${number(o.value,2)}%</b></div>`).join('')||'<p>오버로드 옵션 없음</p>'}</div></section><section class="sim-panel"><h3>육성 조건</h3><label>돌파 · 코어<select data-stat="limit" aria-label="시뮬레이션 돌파와 코어">${Array.from({length:11},(_,i)=>`<option value="${i}" ${i===limit?'selected':''}>${i===0?'명함':i<=3?i+'돌파':'3돌파 +'+(i-3)+'코어'}</option>`).join('')}</select></label><label>호감도<input data-stat="bond" aria-label="시뮬레이션 호감도" type="number" min="1" max="40" value="${sim.bond}"/></label><div class="sim-skill-inputs">${sim.skills.map((v,i)=>`<label>${i===2?'버스트':'스킬 '+(i+1)}<input data-stat="skill" data-index="${i}" aria-label="시뮬레이션 ${i===2?'버스트':'스킬 '+(i+1)}" type="number" min="1" max="10" value="${v}"/></label>`).join('')}</div><p class="sim-help">연구실·소장품은 현재 니케 정보 기준입니다.</p></section><details class="sim-rules"><summary>확률·잠금 비용 안내</summary><p>원본 미미르 시뮬레이터 기준입니다.</p><p>효과 생성: 1슬롯 100% / 2슬롯 50% / 3슬롯 30%. 같은 장비에는 같은 효과가 중복되지 않아요.</p><p>빈 장비의 최초 효과 변경은 생성된 옵션이 모두 Lv.11입니다. 이후 단계 추첨: 1~5단계 60% / 6~10단계 35% / 11~15단계 5%. 각 구간 안에서는 동일 확률입니다. 기존과 완전히 같은 결과는 다시 추첨합니다.</p><p>효과 가중치: 우월 코드·공격력·크리티컬 확률·방어력 각 10, 나머지 각 12. 잠긴 효과는 제외하고 남은 가중치로 추첨합니다.</p><p>모듈 잠금 설정 시 1·2·3번째 잠금에 2·3·4개를 사용합니다. 기존 잠금은 설정 비용이 없어요.</p><p>변경 1회: 기본 모듈 1개 + 잠금 수. 락키는 모듈/기존 잠금 뒤의 순서에 따라 20·30·40개를 매번 사용합니다.</p><p>되돌리기는 직전 옵션·잠금만 복원합니다. 소모 재화는 반환하지 않아요. 원본으로 초기화하면 전체 실험과 소모량을 초기화합니다.</p></details></aside><div class="sim-equipment-grid">${sim.equipment.map((eq,part)=>{
   const cost=rollCost(eq);return `<section class="sim-equipment sim-panel"><div class="sim-equipment-heading"><h3>${eq.name} 장비</h3><label>강화<select data-level="${part}" aria-label="${eq.name} 장비 강화">${Array.from({length:6},(_,i)=>`<option value="${i}" ${i===eq.level?'selected':''}>+${i}</option>`).join('')}</select></label><button data-undo="${part}" ${sim.canUndo(part)?'':'disabled'}>되돌리기</button></div><p class="equipment-item-name equipment-overloaded">${esc(eq.label??eq.name+' 장비')} (+${eq.level})</p><div class="sim-slots">${eq.slots.map((slot,index)=>`<div class="sim-slot ${slot.type?overloadColorClass(slot.tier??undefined):'overload-normal'}"><div class="sim-slot-value"><span><small>${index+1}</small> ${slot.type?esc(slot.type):'효과 없음'}${slot.type?` <small>Lv.${slot.tier??'—'}</small>`:''}</span>${slot.type?`<b>+${number(optionValue(slot.type,slot.tier??0),2)}%</b>`:''}</div><label class="sim-slot-lock"><select title="${lockNames[slot.lock]}" data-lock="${part}" data-lock-state="${slot.lock}" data-slot="${index}" aria-label="${eq.name} ${index+1}슬롯 잠금" ${slot.type?'':'disabled'}>${(Object.entries(lockNames) as [Lock,string][]).filter(([key])=>!allBlack||key==='none'||key==='module').map(([key])=>`<option value="${key}" ${key===slot.lock?'selected':''}>${key==='none'?'해제':key==='module'?(allBlack?'잠금':'모듈'):key==='initial'?'기존':'락키'}</option>`).join('')}</select></label></div>`).join('')}</div><div class="sim-cost">이번 변경 <span>모듈 ${cost.modules}개${cost.keys?' · 락키 '+cost.keys+'개':''}</span></div><div class="sim-actions"><button data-roll="effect" data-part="${part}" ${sim.canRoll(part,'effect')?'':'disabled'}>효과 변경</button><button data-roll="value" data-part="${part}" ${sim.canRoll(part,'value')?'':'disabled'}>수치 변경</button></div></section>`;
  }).join('')}</div></div>`;
  if(allBlack){
   const neonPortrait=document.createElement('img');neonPortrait.className='all-black-neon';neonPortrait.src='/'+source.nikke.imageUrl;neonPortrait.alt=source.nikke.name;neonPortrait.draggable=false;dialog.querySelector('.sim-resource-bar')!.prepend(neonPortrait);
   const progress=allBlackProgress(sim.equipment);dialog.querySelector('.sim-cp')!.innerHTML=`<span>Lv.15 목표 달성</span><strong>${progress.reduce((n,p)=>n+p.count,0)} <small>/ 12</small></strong>`;
   const keyResource=dialog.querySelectorAll('.sim-resources>span')[1];keyResource?.remove();
   const growthPanel=dialog.querySelectorAll('.sim-layout aside>.sim-panel')[1];growthPanel.innerHTML='<h3>목표 옵션 · 모두 Lv.15</h3>'+progress.map(p=>`<div class="all-black-target ${p.count===p.target?'complete':p.matched>0?'matched':''}"><span>${p.name==='차지 속도'?'차지 속도 증가':p.name}</span><b>${p.matched} / ${p.target}</b></div>`).join('')+'<p class="sim-help">장비 부위와 옵션 순서는 자유입니다.<br>잠금은 모듈만 사용하며, 해제 후 다시 잠그면 비용이 다시 발생합니다.</p>';
   dialog.querySelector('.sim-layout aside>.sim-panel')!.remove();
   dialog.querySelectorAll('[data-level]').forEach(el=>el.closest('label')?.remove());
   const rules=dialog.querySelector('.sim-rules')!;rules.innerHTML='<summary>확률·잠금 비용 안내</summary><p>각 장비의 최초 효과 변경은 생성된 옵션이 모두 Lv.11입니다. 이후에는 기존 모듈작 시뮬레이터와 같은 확률입니다. 효과 생성은 1슬롯 100% / 2슬롯 50% / 3슬롯 30%, 옵션 단계는 1~5단계 60% / 6~10단계 35% / 11~15단계 5%입니다.</p><p>같은 장비의 효과는 중복되지 않습니다. 잠금 설정에 2·3·4모듈, 매 변경에 기본 1모듈 + 잠긴 옵션 수만큼 사용합니다.</p><p>되돌리기는 옵션·잠금만 복원하고 사용한 모듈은 반환하지 않습니다. 기록은 이 브라우저에 자동 저장됩니다.</p>';
   if(storageFailed)dialog.querySelector('.sim-notice')!.textContent+=' 진행 기록을 저장하지 못했어요.';
  }
  dialog.querySelector<HTMLDetailsElement>('.sim-rules')!.open=rulesOpen;dialog.scrollTop=scroll;
 }
 dialog.addEventListener('click',async e=>{
  const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.dataset.sim==='close'){close();return;}
  if(b.dataset.sim==='copy'){
   const status=dialog.querySelector<HTMLElement>('.all-black-export-status')!;b.disabled=true;status.innerHTML=loadingMarkup("이미지를 준비하는 중…");
   try{
    if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('이 브라우저에서는 이미지 복사를 지원하지 않아요.');
    const image=getClearImage();
    await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);status.textContent='이미지를 복사했어요. 원하는 곳에 붙여넣으세요.';
   }catch(error){status.textContent=(error as Error).message;}finally{b.disabled=false;}
   return;
  }
  if(b.dataset.sim==='reset'){clearImageRequest=null;if(clearImageUrl){URL.revokeObjectURL(clearImageUrl);clearImageUrl='';}sim.reset();message=allBlack?'새 도전을 시작합니다. 모든 옵션이 없는 장비에서 시작합니다.':'원본 장비와 육성 조건으로 초기화했어요.';render();return;}
  if(b.dataset.undo!==undefined){const part=Number(b.dataset.undo),before=slotSnapshot(part);sim.undo(part);message=`${sim.equipment[part].name} 장비를 되돌렸어요. 소모 재화는 유지됩니다.`;render();animateSlots(part,before);return;}
  if(b.dataset.roll){const part=Number(b.dataset.part),kind=b.dataset.roll as 'effect'|'value';const cost=rollCost(sim.equipment[part]),before=slotSnapshot(part);if(!sim.roll(part,kind))return;message=`${sim.equipment[part].name} ${kind==='effect'?'효과':'수치'} 변경 · 모듈 ${cost.modules}개${cost.keys?' · 락키 '+cost.keys+'개':''} 사용`;render();if(!allBlack||!allBlackComplete(sim.equipment))animateSlots(part,before);dialog.querySelector<HTMLButtonElement>(`[data-roll="${kind}"][data-part="${part}"]:not(:disabled)`)?.focus({preventScroll:true});}
 });
 dialog.addEventListener('change',e=>{
  const input=e.target as HTMLInputElement|HTMLSelectElement;const value=Number(input.value);
  if(input.dataset.lock!==undefined){if(allBlack&&!['none','module'].includes(input.value))return;const before=sim.modulesUsed;sim.setLock(Number(input.dataset.lock),Number(input.dataset.slot),input.value as Lock);message=`${lockNames[input.value as Lock]} 설정${sim.modulesUsed>before?' · 모듈 '+(sim.modulesUsed-before)+'개 사용':''}`;}
  else if(input.dataset.level!==undefined&&Number.isInteger(value)&&value>=0&&value<=5)sim.equipment[Number(input.dataset.level)].level=value;
  else if(input.dataset.stat==='limit'&&Number.isInteger(value)&&value>=0&&value<=10){sim.grade=Math.min(3,value);sim.core=Math.max(0,value-3);}
  else if(input.dataset.stat==='bond'&&Number.isInteger(value)&&value>=1&&value<=40)sim.bond=value;
  else if(input.dataset.stat==='skill'&&Number.isInteger(value)&&value>=1&&value<=10)sim.skills[Number(input.dataset.index)]=value;
  const selector=input.dataset.lock!==undefined?`[data-lock="${input.dataset.lock}"][data-slot="${input.dataset.slot}"]`:input.dataset.level!==undefined?`[data-level="${input.dataset.level}"]`:`[data-stat="${input.dataset.stat}"]${input.dataset.index!==undefined?`[data-index="${input.dataset.index}"]`:''}`;
  render();dialog.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
 });
 render();document.body.append(dialog);dialog.showModal();
}
