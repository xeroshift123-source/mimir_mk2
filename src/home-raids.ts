import {raidCountdown} from './raid-countdown';
import {raidHistory} from './data/raids';
import type {RaidInfo} from './data/raids';
import {elements} from './deck-model';
import './home-raids.css';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const element=(label:string)=>{const code=Object.entries(elements).find(([,v])=>v===label)?.[0];return code?`<img src="/assets/icons/elements/icon-elements-${code}.webp" alt=""/>`:'';};
const tags=(keywords:string[])=>keywords.map(k=>`<span class="raid-keyword">${esc(k)}</span>`).join('');
const card=(raid:RaidInfo)=>`<div class="raid-art ${raid.type==='union'?'union-art':''}"><img loading="lazy" draggable="false" src="/${esc(raid.imagePath)}" alt="${esc(raid.bossName??'유니온 레이드')}"/><span>${raid.type==='solo'?'SOLO RAID':'UNION RAID'}</span></div><div class="raid-identity"><span>${raid.type==='solo'?'솔로 레이드':'유니온 레이드'}</span><span class="raid-season-badge">${esc(raid.seasonName)}</span></div><h2>${esc(raid.bossName??'유니온 레이드')}</h2><p class="raid-period">◷ ${esc(raid.period)}</p><p class="raid-countdown" data-countdown="${esc(raid.id)}" hidden></p>${raid.type==='solo'?`<div class="raid-elements"><div class="raid-weakness"><span>약점 속성</span><strong>${element(raid.weakness!)}${esc(raid.weakness!)}</strong></div><div class="raid-keywords">${tags(raid.keyword??[])}</div></div>`:`<ul class="union-bosses">${(raid.unionBosses??[]).map(b=>`<li>${element(b.element)}<span>${esc(b.name)}</span><div>${tags(b.keyword)}</div></li>`).join('')}</ul>`}<div class="raid-actions"><a class="primary raid-build" href="#/builder/${raid.type}?raid=${encodeURIComponent(raid.id)}">덱 구성하기 <span aria-hidden="true"></span></a><button class="raid-library" data-raid-library="${raid.id}">덱 라이브러리 <span aria-hidden="true"></span></button></div>`;
export function mountHomeRaids(root:HTMLElement){
 let filter='all',index=raidHistory.length-1,renderedFilter='';
 const records=()=>raidHistory.filter(r=>filter==='all'||r.type===filter);
 root.className='home-raid raid-carousel';
 root.innerHTML=`<div class="raid-navigation"><div role="group" aria-label="레이드 종류 필터"><button data-kind="all">전체</button><button data-kind="solo">솔로</button><button data-kind="union">유니온</button></div></div><label for="raid-season" class="sr-only">레이드 선택</label><select id="raid-season"></select><div class="raid-carousel-window" tabindex="0" role="region" aria-roledescription="캐러셀" aria-label="레이드 카드"><div class="raid-carousel-track"></div><button class="raid-edge raid-edge-prev" data-step="-1" aria-label="이전 레이드">‹</button><button class="raid-edge raid-edge-next" data-step="1" aria-label="다음 레이드">›</button></div><div class="raid-pages" role="group" aria-label="레이드 페이지"></div><div class="raid-card-footer"><span id="raid-position" aria-live="polite"></span><button id="raid-latest">최신 기록</button></div><p class="raid-source">기존 미미르에 등록된 정보 · 실시간 일정 연동 전</p>`;
 const select=root.querySelector<HTMLSelectElement>('#raid-season')!,track=root.querySelector<HTMLElement>('.raid-carousel-track')!,viewport=root.querySelector<HTMLElement>('.raid-carousel-window')!;
 function render(){
  const list=records();index=Math.max(0,Math.min(index,list.length-1));
  if(renderedFilter!==filter){
   track.innerHTML=list.map((raid,i)=>`<article class="raid-slide" role="group" aria-label="${i+1} / ${list.length} · ${esc(raid.seasonName)}">${card(raid)}</article>`).join('');
   select.innerHTML=list.map((raid,i)=>`<option value="${i}">${esc(raid.seasonName)} · ${raid.type==='solo'?'솔로':'유니온'}${raid.bossName?' · '+esc(raid.bossName):''}</option>`).join('');
   root.querySelector('.raid-pages')!.innerHTML=list.map((raid,i)=>`<button data-page="${i}" aria-label="${esc(raid.seasonName)} 보기"></button>`).join('');renderedFilter=filter;
  }
  track.style.transform='translateX(-'+index*100+'%)';select.value=String(index);
  track.querySelectorAll<HTMLElement>('.raid-slide').forEach((slide,i)=>{slide.inert=i!==index;slide.setAttribute('aria-hidden',String(i!==index));slide.classList.toggle('is-current',i===index);});
  root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.kind===filter)));
  root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.page)===index)));
  root.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled=index===0;
  root.querySelector<HTMLButtonElement>('[data-step="1"]')!.disabled=index===list.length-1;
  root.querySelector('#raid-position')!.textContent=(index+1)+' / '+list.length;
  updateCountdowns();
 }
 function updateCountdowns(){
  const now=Date.now();root.querySelectorAll<HTMLElement>('[data-countdown]').forEach(node=>{
   const raid=raidHistory.find(r=>r.id===node.dataset.countdown),remaining=raid?raidCountdown(raid,now):null;
   node.hidden=remaining===null;node.textContent=remaining??'';
   const active=remaining?.startsWith('종료까지 ')??false;
   node.classList.toggle('is-active',active);
   node.closest('.raid-slide')?.querySelector('.raid-period')?.classList.toggle('is-active',active);
   node.classList.toggle('is-ended',remaining==='종료됨');
  });
 }
 const timer=window.setInterval(()=>{if(!root.isConnected){clearInterval(timer);return;}if(!document.hidden)updateCountdowns();},1000);
 const visibility=()=>{if(!root.isConnected){document.removeEventListener('visibilitychange',visibility);return;}updateCountdowns();};
 document.addEventListener('visibilitychange',visibility);
 const step=(delta:number)=>{index=Math.max(0,Math.min(records().length-1,index+delta));render();};
 let suppressClick=false;
 root.addEventListener('click',event=>{
  if(suppressClick){event.preventDefault();suppressClick=false;return;}
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.dataset.kind){filter=button.dataset.kind;index=records().length-1;render();}
  else if(button.dataset.step)step(Number(button.dataset.step));
  else if(button.dataset.page!==undefined){index=Number(button.dataset.page);render();}
  else if(button.id==='raid-latest'){index=records().length-1;render();}
  else if(button.dataset.raidLibrary)root.dispatchEvent(new CustomEvent('open-raid-library',{detail:button.dataset.raidLibrary}));
 });
 select.addEventListener('change',()=>{index=Number(select.value);render();});
 viewport.addEventListener('keydown',event=>{if(event.target!==viewport||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();if(event.key==='Home')index=0;else if(event.key==='End')index=records().length-1;else index+=event.key==='ArrowRight'?1:-1;render();});
 let drag:{id:number;x:number;y:number;dx:number}|null=null;
 viewport.addEventListener('pointerdown',event=>{if(event.button!==0||(event.target as HTMLElement).closest('a,button,select'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0};viewport.setPointerCapture(event.pointerId);});
 viewport.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>12){drag=null;return;}drag.dx=dx;if(Math.abs(dx)>8){track.classList.add('is-dragging');const bounded=(index===0&&dx>0)||(index===records().length-1&&dx<0)?dx*.2:dx;track.style.transform='translateX(calc(-'+index*100+'% + '+bounded+'px))';}});
 const end=(event:PointerEvent)=>{if(!drag||event.pointerId!==drag.id)return;const dx=drag.dx;drag=null;track.classList.remove('is-dragging');suppressClick=Math.abs(dx)>8;if(event.type!=='pointercancel'&&Math.abs(dx)>55)step(dx<0?1:-1);else render();};
 viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
 render();requestAnimationFrame(()=>track.classList.add('is-ready'));
}
