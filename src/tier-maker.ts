import {loadingMarkup} from './loading';
import {catalogPanel,mountCatalogControls} from './nikke-catalog';
import {elementIcon,burstIcon} from './card-design';
import {matchesNikke,elements} from './deck-model';
import type {Nikke} from './deck-model';
import {placeTierNikke,restoreTierRows,tierColors} from './tier-maker-model';
import type {TierRow} from './tier-maker-model';
import './builder.css';
import './tier-maker.css';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const storageKey='mimir-tier-maker-v1';
export async function mountTierMaker(root:HTMLElement,isCurrent:()=>boolean){
 root.innerHTML=`<p class="builder-loading">${loadingMarkup("니케 목록을 불러오는 중…")}</p>`;
 let catalog:Nikke[];
 try{const response=await fetch('/data/nikkes.json');if(!response.ok)throw Error();catalog=await response.json();}
 catch{if(isCurrent())root.innerHTML='<p>니케 목록을 불러오지 못했어요. 새로고침해 주세요.</p>';return;}
 if(!isCurrent())return;
 const byId=new Map(catalog.map(n=>[n.id,n]));
 let title='나의 티어표';
 let rows:TierRow[]=[],selected:string|null=null,query='',sort='name',hidePlaced=false;
 let history:TierRow[][]=[];
 const filters:Record<string,Set<string>>={burst:new Set(),element:new Set(),company:new Set(),weaponType:new Set(),rank:new Set()};
 let notice='니케 선택 후 티어 행을 누르거나, 원하는 행으로 드래그하세요.';
 try{title=(localStorage.getItem(storageKey+'-title')??'나의 티어표').slice(0,60);rows=restoreTierRows(JSON.parse(localStorage.getItem(storageKey)??'[]'),new Set(byId.keys()));}catch{notice='저장된 티어표를 불러오지 못했어요.';}
 root.innerHTML=`<section class="builder-page tier-maker-page"><div class="builder-breadcrumb"><a href="#/entertainment">엔터테인먼트!</a><span>/</span>티어 메이커</div><div class="builder-heading"><div><h1>티어 메이커</h1><p>나만의 기준으로 니케를 배치하세요.</p></div><div class="toolbar-actions"><button data-tier-capture>캡처</button><button data-tier-undo disabled>실행 취소</button></div></div><p class="tier-status" role="status"></p><div class="tier-layout"><div class="catalog-column">${catalogPanel(catalog.length)}</div><section class="tier-workspace" aria-label="티어표"><div class="catalog-title"><div class="tier-title-editor"><input class="tier-title-input" aria-label="티어표 이름" maxlength="60" placeholder="나의 티어표" value="${esc(title)}" title="티어표 이름 수정"/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-5-5L3 14l-1 7Z"/></svg></div><span class="tier-count"></span></div><div class="tier-rows"></div><button class="tier-add-row" data-tier-add aria-label="티어 행 추가"><span aria-hidden="true">+</span> 행 추가</button></section></div></section>`;
 mountCatalogControls(root);
 root.querySelector('.catalog-column')!.prepend(root.querySelector('.catalog-title')!);
 root.querySelector('.catalog-meta span:last-child')!.textContent='선택 후 티어 행 클릭 · 드래그로 배치';
 function status(text=notice){root.querySelector('.tier-status')!.textContent=text;}
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(rows));status();}catch{status('브라우저에 저장하지 못했어요. 저장 공간을 확인해 주세요.');}}
 function update(fn:()=>void){history.push(structuredClone(rows));if(history.length>30)history.shift();fn();save();renderRows();renderCatalog();}
 function place(id:string,rowId:string,beforeId?:string){if(!byId.has(id)||!rows.some(r=>r.id===rowId)||id===beforeId)return;update(()=>{placeTierNikke(rows,id,rowId,beforeId);selected=null;});status(`${byId.get(id)!.name} 배치 완료`);}
 function renderRows(){
  root.querySelector('.tier-rows')!.innerHTML=rows.length?rows.map((row,i)=>`<article class="tier-row" data-row-id="${esc(row.id)}"><div class="tier-label" style="--tier-label:${tierColors[i%tierColors.length]}"><input data-tier-name="${esc(row.id)}" value="${esc(row.name)}" maxlength="40" aria-label="티어 ${i+1} 이름" placeholder="티어명"/><button data-tier-delete="${esc(row.id)}" aria-label="티어 ${i+1} 삭제" title="행 삭제">×</button></div><div class="tier-drop-area" data-tier-drop="${esc(row.id)}">${row.nikkes.map(id=>{const n=byId.get(id)!;return `<button class="tier-nikke" data-tier-nikke="${esc(id)}" draggable="false" aria-label="${esc(n.name)} 배치 해제" title="${esc(n.name)} · 클릭하면 배치 해제"><img src="/${esc(n.imageUrl)}" alt="" draggable="false"/><span>${esc(n.name)}</span></button>`;}).join('')}<button class="tier-append" data-tier-append="${esc(row.id)}" aria-label="${esc(row.name||'티어 '+(i+1))}에 선택한 니케 배치"><span>${row.nikkes.length?'+':'니케 배치'}</span></button></div></article>`).join(''):'<div class="tier-empty"><p>아직 티어 행이 없어요.</p><span>아래 + 버튼으로 첫 행을 추가하세요.</span></div>';
  root.querySelector('.tier-count')!.textContent=`${rows.length}개 티어 · ${rows.reduce((sum,r)=>sum+r.nikkes.length,0)}명`;
  root.querySelector<HTMLButtonElement>('[data-tier-undo]')!.disabled=!history.length;
 }
 function renderCatalog(){
  const used=new Map(rows.flatMap(r=>r.nikkes.map(id=>[id,r.name] as const)));
  const list=catalog.filter(n=>matchesNikke(n,query,filters)&&(!hidePlaced||!used.has(n.id))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ko'):Number(a[sort as 'burst'|'coolTime'])-Number(b[sort as 'burst'|'coolTime'])||a.name.localeCompare(b.name,'ko'));
  root.querySelector('#catalog-count')!.textContent=`${list.length}명 표시`;
  root.querySelector('#nikke-grid')!.innerHTML=list.map(n=>`<article class="nikke-tile ${used.has(n.id)?'placed':''} ${selected===n.id?'selected-nikke':''}"><button class="nikke-add" draggable="false" data-tier-pick="${esc(n.id)}" aria-pressed="${selected===n.id}" aria-label="${esc(n.name)} 선택"><div class="nikke-portrait"><img src="/${esc(n.imageUrl)}" alt="" loading="lazy" decoding="async" draggable="false"/><span class="original-element"><img src="${elementIcon(n)}" alt="${elements[n.element]}"/></span><span class="original-burst"><img src="${burstIcon(n)}" alt="버스트 ${n.burst}"/></span><span class="original-name">${esc(n.name)}</span>${used.has(n.id)?`<span class="placed-label">${esc(used.get(n.id)||'배치됨')}</span>`:''}</div><strong>${esc(n.name)}</strong><span class="nikke-meta">${n.weaponType} · ${n.coolTime}초</span></button></article>`).join('')||'<p class="no-nikkes">검색 조건에 맞는 니케가 없어요.</p>';
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>{const on=filters[b.dataset.filter!].has(b.dataset.value!);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  const count=Object.values(filters).reduce((sum,s)=>sum+s.size,0);root.querySelector('#filter-count')!.textContent=count?`${count}개 적용`:'';
 }
 let suppressClick=false;
 root.addEventListener('click',async e=>{
  if(suppressClick){e.preventDefault();suppressClick=false;return;}
  const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.hasAttribute('data-tier-capture')){b.disabled=true;root.querySelector('.tier-status')!.innerHTML=loadingMarkup('티어표 이미지를 만드는 중…');const snapshot=structuredClone(rows),captureTitle=title.trim()||'나의 티어표';try{const {captureTierMaker,showTierCapture}=await import('./tier-capture');const blob=await captureTierMaker(snapshot,catalog,captureTitle);if(isCurrent()){showTierCapture(blob);status();}}catch(error){if(isCurrent())status((error as Error).message);}finally{if(isCurrent())b.disabled=false;}return;}
  if(b.hasAttribute('data-tier-add')){update(()=>rows.push({id:crypto.randomUUID(),name:`티어 ${rows.length+1}`,nikkes:[]}));root.querySelector<HTMLInputElement>('.tier-row:last-child input')?.focus();return;}
  if(b.hasAttribute('data-tier-undo')){const previous=history.pop();if(previous){rows=previous;selected=null;save();renderRows();renderCatalog();}return;}
  if(b.dataset.tierDelete){update(()=>{rows=rows.filter(r=>r.id!==b.dataset.tierDelete);});return;}
  if(b.dataset.tierPick){selected=selected===b.dataset.tierPick?null:b.dataset.tierPick;renderCatalog();status(selected?`${byId.get(selected)!.name} 선택됨 · 배치할 티어 행을 누르세요.`:notice);return;}
  if(b.dataset.tierNikke){update(()=>{rows.forEach(r=>{r.nikkes=r.nikkes.filter(id=>id!==b.dataset.tierNikke);});});return;}
  if(b.dataset.tierAppend){if(selected)place(selected,b.dataset.tierAppend);else status('왼쪽 목록에서 니케를 먼저 선택하세요.');return;}
  if(b.dataset.filter){const s=filters[b.dataset.filter],v=b.dataset.value!;s.has(v)?s.delete(v):s.add(v);renderCatalog();}
  if(b.dataset.action==='clear-filters'){query='';Object.values(filters).forEach(s=>s.clear());root.querySelector<HTMLInputElement>('#nikke-search')!.value='';renderCatalog();}
 });
 let renameBefore:TierRow[]|null=null;
 root.addEventListener('focusin',e=>{if((e.target as HTMLInputElement).dataset.tierName)renameBefore=structuredClone(rows);});
 root.addEventListener('input',e=>{const input=e.target as HTMLInputElement;
  if(input.classList.contains('tier-title-input')){title=input.value.slice(0,60);try{localStorage.setItem(storageKey+'-title',title);status();}catch{status('티어표 이름을 저장하지 못했어요. 저장 공간을 확인해 주세요.');}return;}
  if(input.dataset.tierName){const row=rows.find(r=>r.id===input.dataset.tierName);if(row&&row.name!==input.value){if(renameBefore){history.push(renameBefore);if(history.length>30)history.shift();renameBefore=null;}row.name=input.value.slice(0,40);input.closest('.tier-row')!.querySelector('.tier-append')!.setAttribute('aria-label',`${row.name||'티어 '+(rows.indexOf(row)+1)}에 선택한 니케 배치`);save();renderCatalog();root.querySelector<HTMLButtonElement>('[data-tier-undo]')!.disabled=false;}}
  if(input.id==='nikke-search'){query=input.value;renderCatalog();}
 });
 root.addEventListener('change',e=>{const input=e.target as HTMLInputElement;
  if(input.id==='nikke-sort'){sort=input.value;renderCatalog();}if(input.id==='hide-placed'){hidePlaced=input.checked;renderCatalog();}
 });
 let drag:{id:string;pointer:number;x:number;y:number;button:HTMLElement;ghost?:HTMLElement}|null=null;
 const dropAt=(x:number,y:number)=>{const el=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-tier-drop]');return el&&root.contains(el)?el:null;};
 const clearDrag=()=>{const current=drag;drag=null;current?.ghost?.remove();if(current?.button.hasPointerCapture(current.pointer))current.button.releasePointerCapture(current.pointer);root.querySelectorAll('.tier-drop-ready,.drag-origin').forEach(el=>el.classList.remove('tier-drop-ready','drag-origin'));};
 root.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;const button=(e.target as HTMLElement).closest<HTMLElement>('[data-tier-pick],[data-tier-nikke]');if(!button)return;drag={id:(button.dataset.tierPick??button.dataset.tierNikke)!,pointer:e.pointerId,x:e.clientX,y:e.clientY,button};button.setPointerCapture(e.pointerId);});
 root.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;
  if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){const ghost=new Image();ghost.src='/'+byId.get(drag.id)!.imageUrl;ghost.className='tier-drag-ghost';ghost.alt='';root.append(ghost);drag.ghost=ghost;drag.button.classList.add('drag-origin');}
  if(!drag.ghost)return;e.preventDefault();drag.ghost.style.left=(e.clientX+12)+'px';drag.ghost.style.top=(e.clientY+12)+'px';root.querySelectorAll('.tier-drop-ready').forEach(el=>el.classList.remove('tier-drop-ready'));dropAt(e.clientX,e.clientY)?.classList.add('tier-drop-ready');
 });
 root.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointer)return;const current=drag,drop=dropAt(e.clientX,e.clientY),before=(document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-tier-nikke]'))?.dataset.tierNikke;clearDrag();if(!current.ghost)return;e.preventDefault();suppressClick=true;setTimeout(()=>{suppressClick=false;},0);if(drop)place(current.id,drop.dataset.tierDrop!,before);});
 root.addEventListener('pointercancel',clearDrag);root.addEventListener('lostpointercapture',()=>{if(drag)clearDrag();});
 root.addEventListener('dragstart',e=>{if((e.target as HTMLElement).closest('[data-tier-pick],[data-tier-nikke]'))e.preventDefault();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){clearDrag();selected=null;renderCatalog();status();}});
 renderRows();renderCatalog();status();
}
