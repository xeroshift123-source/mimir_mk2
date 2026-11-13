import {loadingMarkup} from './loading';
import {rememberBuilderRaid} from './builder-navigation';
import {catalogPanel,mountCatalogControls} from './nikke-catalog';
import {publishDeck} from './deck-publish';
import './deck-library.css';
import {elementIcon,burstIcon} from './card-design';
import {emptyDeck,encodeDeck,decodeDeck,moveSlot,deckSlot,placeDeckNikke,matchesNikke,elements} from './deck-model';
import type {Deck,Mode,Nikke} from './deck-model';
import './builder.css';
import {raidHistory} from './data/raids';
import type {RaidInfo} from './data/raids';

const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const badges=(n:Nikke)=>`<span class="original-element"><img src="${elementIcon(n)}" alt="${elements[n.element]}"/></span><span class="original-burst"><img src="${burstIcon(n)}" alt="버스트 ${n.burst==='0'?'ALL':n.burst}"/></span>`;
let catalog: Nikke[]=[];
let pending: Promise<Nikke[]>|undefined;
const load=()=>pending??=fetch('/data/nikkes.json').then(r=>{if(!r.ok)throw Error('니케 데이터를 불러오지 못했어요.');return r.json() as Promise<Nikke[]>;}).catch(e=>{pending=undefined;throw e;});

export async function mountBuilder(root: HTMLElement, mode: Mode, isCurrent:()=>boolean,raid?:RaidInfo) {
 root.innerHTML=`<div class="builder-loading">${loadingMarkup("니케 목록을 불러오는 중…")}</div>`;
 try{catalog=await load();}catch{if(isCurrent())root.innerHTML='<div class="builder-loading">데이터를 불러오지 못했어요. 새로고침해 주세요.</div>';return;}
 if(!isCurrent())return;
 const byId=new Map(catalog.map(n=>[n.id,n]));
 let selectedNikke:string|null=null;
 let deck=emptyDeck(mode),target:[number,number]=[0,0],moving:[number,number]|null=null;
 let query='',hidePlaced=false,sort='name',filters:Record<string,Set<string>>={burst:new Set(),element:new Set(),weaponType:new Set(),company:new Set(),rank:new Set()};
 const storageKey=raid?`mimir-mk2-deck-${mode}-raid-${raid.id}`:`mimir-mk2-deck-${mode}`;
 let undo: string[]=[],redo: string[]=[],saveFailed=false,storageWarning='';
 try { const stored=localStorage.getItem(storageKey)??(!localStorage.getItem(`mimir-mk2-deck-${mode}-raid-context`)?localStorage.getItem(`mimir-mk2-deck-${mode}`):null); if(stored){const parsed=JSON.parse(stored); const restored=decodeDeck(encodeDeck(parsed,catalog),catalog); deck={...restored,names:deck.names.map((x,i)=>typeof parsed.names?.[i]==='string'?parsed.names[i].slice(0,40):x),weakness:Object.keys(elements).includes(parsed.weakness)?parsed.weakness:'Water',hasCandidate:parsed.hasCandidate===true||parsed.candidates?.length>0,candidates:Array.isArray(parsed.candidates)?[...new Set<string>(parsed.candidates.filter((id:unknown)=>typeof id==='string'&&byId.has(id)&&!restored.squads.flat().includes(id)))].slice(0,10):[]};} }catch{storageWarning='저장된 편성을 복원하지 못했어요. 새 편성으로 시작합니다.';}
 if(raid?.type==='solo'){const weakness=Object.entries(elements).find(([,v])=>v===raid.weakness)?.[0];if(weakness)deck.weakness=weakness;}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify(deck));localStorage.setItem(`mimir-mk2-deck-${mode}`,JSON.stringify(deck));if(raid){localStorage.setItem(`mimir-mk2-deck-${mode}-raid-context`,raid.id);rememberBuilderRaid(raid.id);}saveFailed=false;}catch{saveFailed=true;}}
 function update(fn:()=>void){undo.push(JSON.stringify(deck));if(undo.length>40)undo.shift();redo=[];fn();persist();renderWorkspace();renderCatalog();}
 function toast(message:string){const node=root.querySelector<HTMLElement>('#builder-status')!;node.textContent=message;}
 let copyFeedbackTimer:number|undefined,copyButtonTimer:number|undefined;
 function showCopyFeedback(message:string,failed=false){
  let notice=root.querySelector<HTMLElement>('#copy-feedback');
  if(!notice){notice=document.createElement('div');notice.id='copy-feedback';notice.className='copy-feedback';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');root.append(notice);}
  window.clearTimeout(copyFeedbackTimer);notice.textContent=`${failed?'!':'✓'}  ${message}`;notice.setAttribute('aria-hidden','false');notice.classList.add('is-visible');
  copyFeedbackTimer=window.setTimeout(()=>{notice!.classList.remove('is-visible');notice!.setAttribute('aria-hidden','true');},3200);
 }

 function assign(id:string,position:[number,number]=target){update(()=>{placeDeckNikke(deck,id,position);target=position;selectedNikke=null;});toast(byId.get(id)!.name+' 배치 완료');}
 const img=(n:Nikke)=>`<img src="/${esc(n.imageUrl)}" alt="" loading="lazy" decoding="async" draggable="false"/>`;
 root.innerHTML=`<section class="builder-page"><div class="builder-breadcrumb"><a href="#">커맨드 센터</a><span>/</span>덱 빌더</div><div class="builder-heading"><div><div class="eyebrow muted">SQUAD CONFIGURATION</div><h1>레이드 덱 빌더<span>BUILD YOUR NEXT MOVE</span></h1><p>니케를 선택한 다음, 배치할 빈칸을 누르세요.</p></div><div class="builder-tabs" aria-label="레이드 유형"><a href="#/builder/solo" class="${mode==='solo'?'selected':''}">솔로 레이드 <span>05</span></a><a href="#/builder/union" class="${mode==='union'?'selected':''}">유니온 레이드 <span>03</span></a></div></div><div class="builder-toolbar"><div class="weakness-control">${mode==='solo'?`<label>보스 약점</label><details class="union-element-picker boss-weakness-picker"><summary aria-label="보스 약점 선택"><img id="boss-weakness-icon" src="/assets/icons/elements/icon-elements-${deck.weakness}.webp" alt=""/><span id="boss-weakness-name">${elements[deck.weakness]}</span><i aria-hidden="true">⌄</i></summary><div class="union-element-options" role="group" aria-label="보스 약점 속성">${Object.entries(elements).map(([code,label])=>`<button type="button" data-boss-weakness="${code}" aria-pressed="${deck.weakness===code}"><img src="/assets/icons/elements/icon-elements-${code}.webp" alt=""/>${label}</button>`).join('')}</div></details><select id="raid-boss" aria-label="레이드 보스 선택"></select><div id="boss-keywords" class="boss-keywords" aria-label="보스 공략 키워드"></div>`:'<span class="muted-copy">스쿼드별 공략 속성을 설정하세요.</span>'}</div><div class="toolbar-actions"><button data-action="undo" aria-label="실행 취소">↶ <span>실행 취소</span></button><button data-action="redo" aria-label="다시 실행">↷</button><button data-action="capture">▣ 캡처 모드</button><button data-action="library-save">덱 공유</button><button data-action="copy">⧉ 코드 복사</button><a class="toolbar-measure" target="_blank" rel="noopener noreferrer" aria-label="DILDORO 측정 (새 탭)">DILDORO 측정 ↗</a><button data-action="import">↓ 코드 가져오기</button><button data-action="reset" class="danger-text">전체 비우기</button></div></div><div id="builder-status" class="builder-status" role="status" aria-live="polite">${storageWarning||'브라우저에 자동 저장됩니다. 계정 동기화 없이 전체 니케로 편성할 수 있어요.'}</div><div class="mobile-builder-nav"><button data-action="open-nikke-sheet" aria-haspopup="dialog" aria-controls="builder-nikke-sheet"><span class="builder-sheet-grip" aria-hidden="true"></span><span>니케 목록 열기</span><small id="mobile-target"></small></button></div><div class="builder-layout"><section class="squad-panel" aria-label="스쿼드 편성"><div class="panel-caption"><span>스쿼드 목록</span><span id="deck-count"></span></div><div id="squads"></div><div id="candidate-workspace"></div><div class="save-indicator" id="save-indicator"></div></section>${catalogPanel(catalog.length)}</div></section><dialog id="deck-modal"><div class="dialog-head"><span class="eyebrow">덱 빌더</span><button data-action="close-dialog" class="close" aria-label="닫기">×</button></div><div id="deck-dialog-content"></div></dialog>`;
 mountCatalogControls(root);
 const catalogColumn=document.createElement('div');catalogColumn.className='catalog-column';
 catalogColumn.append(root.querySelector('.catalog-title')!,root.querySelector('.catalog-panel')!);
 root.querySelector('.builder-layout')!.prepend(catalogColumn);
 // Reuse one catalog so search, filters and scroll position survive sheet toggles.
 const sheet=document.createElement('dialog');sheet.id='builder-nikke-sheet';sheet.className='builder-nikke-sheet';sheet.setAttribute('aria-label','니케 목록');
 sheet.innerHTML='<header class="builder-sheet-heading"><button type="button" data-action="close-nikke-sheet" aria-label="니케 목록 닫기"><span class="builder-sheet-grip" aria-hidden="true"></span>닫기</button></header>';
 root.querySelector('.builder-page')!.append(sheet);
 const mobileLayout=window.matchMedia('(max-width:800px)');
 const sheetBody=document.createElement('div');sheetBody.className='builder-sheet-body';sheet.append(sheetBody);
 const openSheet=()=>{if(!mobileLayout.matches||sheet.open)return;sheetBody.append(catalogColumn);sheet.showModal();};
 const restoreCatalog=()=>{root.querySelector('.builder-layout')?.prepend(catalogColumn);};
 sheet.addEventListener('close',restoreCatalog);
 sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientY<r.top||event.clientY>r.bottom||event.clientX<r.left||event.clientX>r.right)sheet.close();}});
 sheet.addEventListener('cancel',event=>event.stopPropagation());
 const layoutEvents=new AbortController();
 mobileLayout.addEventListener('change',()=>{if(!isCurrent()){layoutEvents.abort();return;}if(!mobileLayout.matches&&sheet.open){sheet.close();restoreCatalog();}},{signal:layoutEvents.signal});
 window.addEventListener('hashchange',()=>{if(sheet.open)sheet.close();layoutEvents.abort();},{once:true,signal:layoutEvents.signal});

 root.addEventListener('keydown',e=>{if(e.key==='Escape')root.querySelectorAll<HTMLDetailsElement>('.union-element-picker[open]').forEach(p=>{p.open=false;p.querySelector('summary')?.focus();});});
 root.addEventListener('click',e=>{root.querySelectorAll<HTMLDetailsElement>('.union-element-picker[open]').forEach(p=>{if(!p.contains(e.target as Node))p.open=false;});});
 const dialog=root.querySelector<HTMLDialogElement>('#deck-modal')!;
 let captureUrl:string|undefined;
 let captureBlob:Blob|undefined;
 let captureRequest=0;
 dialog.addEventListener('close',()=>{captureRequest++;if(captureUrl)URL.revokeObjectURL(captureUrl);captureUrl=undefined;captureBlob=undefined;dialog.classList.remove('capture-dialog');});
 function show(html:string){root.querySelector('#deck-dialog-content')!.innerHTML=html;dialog.showModal();}
 function renderWorkspace(){
  if(mode==='solo'){
   root.querySelector<HTMLImageElement>('#boss-weakness-icon')!.src='/assets/icons/elements/icon-elements-'+deck.weakness+'.webp';
   root.querySelector('#boss-weakness-name')!.textContent=elements[deck.weakness];
   const bosses=[...raidHistory].reverse().filter(r=>r.type==='solo'&&r.weakness===elements[deck.weakness]);
   const current=bosses.find(r=>r.id===raid?.id);
   const bossSelect=root.querySelector<HTMLSelectElement>('#raid-boss')!;
   bossSelect.innerHTML='<option value="">'+(bosses.length?'보스 선택':'등록된 보스 없음')+'</option>'+bosses.map(r=>`<option value="${esc(r.id)}">${esc(r.bossName??r.seasonName)} · ${esc(r.seasonName)}</option>`).join('');
   bossSelect.value=current?.id??'';bossSelect.disabled=!bosses.length;
   root.querySelector('#boss-keywords')!.innerHTML=(current?.keyword??[]).map(k=>`<span class="raid-keyword">${esc(k)}</span>`).join('');
   root.querySelectorAll<HTMLButtonElement>('[data-boss-weakness]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.bossWeakness===deck.weakness)));
  }
  const measure=root.querySelector<HTMLAnchorElement>('.toolbar-measure')!;
  try{measure.href=`http://dildoro.com/m?c=${encodeURIComponent(encodeDeck(deck,catalog))}`;measure.removeAttribute('aria-disabled');measure.title='현재 편성을 DILDORO에서 측정';}catch{measure.removeAttribute('href');measure.setAttribute('aria-disabled','true');measure.title='외부 코드가 없는 니케를 제외해 주세요.';}
  if(selectedNikke&&deck.squads.flat().includes(selectedNikke))selectedNikke=null;
  root.querySelector('#mobile-target')!.textContent=selectedNikke?`${byId.get(selectedNikke)!.name} 선택됨`:'니케 선택 → 빈칸 클릭';
  root.querySelector('#deck-count')!.textContent=`${deck.squads.flat().filter(Boolean).length} / ${deck.squads.length*5} 배치`;
  root.querySelector('#squads')!.innerHTML=deck.squads.map((row,s)=>{
   const ns=row.filter((id):id is string=>!!id).map(id=>byId.get(id)!); const stages=[1,2,3].map(b=>ns.some(n=>Number(n.burst)===b||n.burst==='0'));
   return `<article class="squad ${target[0]===s?'active-squad':''}"><div class="squad-head"><span class="squad-number">${String(s+1).padStart(2,'0')}</span>${mode==='solo'?`<input data-name="${s}" aria-label="스쿼드 ${s+1} 이름" maxlength="40" value="${esc(deck.names[s])}"/>`:''}${mode==='union'?`<details class="union-element-picker"><summary aria-label="스쿼드 ${s+1} 공략 속성 선택"><img src="/assets/icons/elements/icon-elements-${Object.entries(elements).find(([,label])=>label===deck.elements[s])?.[0]??'Electric'}.webp" alt=""/><span>${esc(deck.elements[s])}</span><i aria-hidden="true">⌄</i></summary><div class="union-element-options" role="group" aria-label="스쿼드 ${s+1} 속성">${Object.entries(elements).map(([code,label])=>`<button type="button" data-set-element="${s}" data-element-value="${label}" aria-pressed="${deck.elements[s]===label}"><img src="/assets/icons/elements/icon-elements-${code}.webp" alt=""/>${label}</button>`).join('')}</div></details>`:''}<span class="burst-check" aria-label="버스트 단계 보유 여부">${stages.map((has,i)=>`<span class="${has?'ready':''}" title="버스트 ${i+1} ${has?'보유':'미배치'}">${['I','II','III'][i]}</span>`).join('')}</span><button data-clear="${s}" aria-label="스쿼드 ${s+1} 비우기" title="스쿼드 비우기">↺</button></div><div class="squad-slots">${row.map((id,i)=>{const n=id?byId.get(id):undefined;const selected=false;return `<div class="slot ${selected?'target-slot':''} ${moving?.[0]===s&&moving[1]===i?'moving-slot':''}" data-drop="${s}:${i}"><button class="slot-select" data-slot="${s}:${i}" draggable="false" aria-label="스쿼드 ${s+1} 슬롯 ${i+1}${n?` ${esc(n.name)}`:' 비어 있음'}${selected?' 선택됨':''}" aria-pressed="${selected}">${n?`${img(n)}${badges(n)}<span class="slot-name">${esc(n.name)}</span>`:`<span class="slot-plus">+</span><small>${i+1}</small>`}</button></div>`;}).join('')}</div><div class="squad-foot"><span>${row.filter(Boolean).length} / 5명</span><span>${ns.length===0?'니케를 선택해 스쿼드를 구성하세요.':stages.every(Boolean)?'버스트 I · II · III 보유':`버스트 ${stages.map((x,i)=>!x?['I','II','III'][i]:'').filter(Boolean).join(' · ')} 미배치`}</span></div></article>`;
  }).join('');
  const candidateIndex=deck.squads.length;
  root.querySelector('#candidate-workspace')!.innerHTML=deck.hasCandidate?`<section class="candidate-panel candidate-deck" aria-label="후보 덱"><div class="panel-caption"><span>후보 덱 <small>${deck.candidates.length} / 10명</small></span><div><button data-action="clear-candidates" aria-label="후보 덱 비우기">↺</button><button data-action="remove-candidates" aria-label="후보 덱 제거">×</button></div></div><div class="candidate-slots">${[...deck.candidates,...(deck.candidates.length<10?[null]:[])].map((id,i)=>{const n=id?byId.get(id):undefined;return `<div class="slot" data-drop="${candidateIndex}:${i}"><button class="slot-select" data-slot="${candidateIndex}:${i}" draggable="false" aria-label="후보 덱 슬롯 ${i+1}${n?' '+esc(n.name):' 비어 있음'}">${n?`${img(n)}${badges(n)}<span class="slot-name">${esc(n.name)}</span>`:`<span class="slot-plus">+</span><small>${i+1}</small>`}</button></div>`;}).join('')}</div></section>`:'<button class="add-candidate-deck" data-action="add-candidates">＋ 후보 덱 추가</button>';
  root.querySelector('#save-indicator')!.textContent=saveFailed?'⚠ 브라우저 저장 실패 · 코드로 내보내 편성을 보관해 주세요.':'● 이 브라우저에 자동 저장됨';
  root.querySelector<HTMLButtonElement>('[data-action="undo"]')!.disabled=!undo.length;root.querySelector<HTMLButtonElement>('[data-action="redo"]')!.disabled=!redo.length;
 }
 function renderCatalog(){
  const used=new Set([...deck.squads.flat().filter(Boolean),...deck.candidates]);
  const list=catalog.filter(n=>matchesNikke(n,query,filters)&&(!hidePlaced||!used.has(n.id))).sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ko'):Number(a[sort as 'coolTime'|'burst'])-Number(b[sort as 'coolTime'|'burst'])||a.name.localeCompare(b.name,'ko'));
  root.querySelector('#catalog-count')!.textContent=`${list.length}명 표시`;
  root.querySelector('#nikke-grid')!.innerHTML=list.length?list.map(n=>`<article class="nikke-tile ${used.has(n.id)?'placed':''} ${selectedNikke===n.id?'selected-nikke':''}"><button class="nikke-add" draggable="false" data-add="${esc(n.id)}" aria-pressed="${selectedNikke===n.id}" ${used.has(n.id)?'disabled':''} aria-label="${esc(n.name)} 선택"><div class="nikke-portrait">${img(n)}${badges(n)}<span class="original-name">${esc(n.name)}</span>${used.has(n.id)?`<span class="placed-label"><span aria-hidden="true">▣</span>${deck.candidates.includes(n.id)?'후보 덱':esc(deck.names[deck.squads.findIndex(r=>r.includes(n.id))])}</span>`:''}${n.isTemporary?'<span class="temporary-label">임시</span>':''}</div><strong>${esc(n.name)}</strong><span class="nikke-meta">${n.weaponType} <span>·</span> ${n.coolTime}초</span></button></article>`).join(''):'<div class="no-nikkes">검색 조건에 맞는 니케가 없어요.<button data-action="clear-filters">검색과 필터 초기화</button></div>';
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>{const on=filters[b.dataset.filter!].has(b.dataset.value!);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  const count=Object.values(filters).reduce((sum,set)=>sum+set.size,0);root.querySelector('#filter-count')!.textContent=count?`${count}개 적용`:'';
 }
 root.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(el.id==='nikke-search'){query=el.value;renderCatalog();}});
 root.addEventListener('change',e=>{const el=e.target as HTMLInputElement;
  if(el.id==='raid-boss'){const boss=raidHistory.find(r=>r.id===el.value&&r.type==='solo'&&r.weakness===elements[deck.weakness]);if(boss)location.hash='/builder/solo?raid='+encodeURIComponent(boss.id);}
  if(el.dataset.name!==undefined){update(()=>{deck.names[Number(el.dataset.name)]=el.value.trim()||`스쿼드 ${Number(el.dataset.name)+1}`;});}
  if(el.dataset.element!==undefined)update(()=>{deck.elements[Number(el.dataset.element)]=el.value;});
  if(el.id==='weakness')update(()=>{deck.weakness=el.value;});
  if(el.id==='hide-placed'){hidePlaced=el.checked;renderCatalog();}if(el.id==='nikke-sort'){sort=el.value;renderCatalog();}
 });
 let suppressClick=false;
 root.addEventListener('click',async e=>{if(suppressClick){e.preventDefault();suppressClick=false;return;}const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b||!root.contains(b))return;
  if(b.dataset.bossWeakness&&Object.hasOwn(elements,b.dataset.bossWeakness)){update(()=>{deck.weakness=b.dataset.bossWeakness!;});root.querySelector<HTMLDetailsElement>('.boss-weakness-picker')!.open=false;}
  if(b.dataset.setElement!==undefined){const index=Number(b.dataset.setElement),value=b.dataset.elementValue!;if(Object.values(elements).includes(value))update(()=>{deck.elements[index]=value;});}
  if(b.dataset.filter){const set=filters[b.dataset.filter],value=b.dataset.value!;set.has(value)?set.delete(value):set.add(value);renderCatalog();}
  if(b.dataset.action==='open-nikke-sheet')openSheet();
  if(b.dataset.action==='close-nikke-sheet')sheet.close();
  if(b.dataset.add){selectedNikke=selectedNikke===b.dataset.add?null:b.dataset.add;renderWorkspace();renderCatalog();if(sheet.open)sheet.close();toast(selectedNikke?`${byId.get(selectedNikke)!.name} 선택됨 · 스쿼드의 빈칸을 눌러 배치하세요.`:'니케 선택을 해제했어요.');}
  if(b.dataset.slot){const position=b.dataset.slot.split(':').map(Number) as [number,number];const [s,i]=position;moving=null;const id=deckSlot(deck,position);if(id){update(()=>{if(s===deck.squads.length)deck.candidates.splice(i,1);else deck.squads[s][i]=null;target=position;});toast(byId.get(id)!.name+' 편성을 해제했어요.');}else if(selectedNikke)assign(selectedNikke,position);else toast('니케 목록에서 니케를 먼저 선택해 주세요.');}
  if(b.dataset.clear!==undefined){const s=Number(b.dataset.clear);show(`<h2>스쿼드 ${s+1}을 비울까요?</h2><p>다른 스쿼드는 유지됩니다. 실행 취소로 복원할 수 있어요.</p><button class="primary" data-confirm-clear="${s}">스쿼드 비우기</button>`);}
  if(b.dataset.confirmClear!==undefined){const s=Number(b.dataset.confirmClear);moving=null;update(()=>{deck.squads[s]=Array(5).fill(null);target=[s,0];});dialog.close();toast('스쿼드를 비웠어요.');}
  switch(b.dataset.action){
   case 'library-save':if(await publishDeck(deck,catalog,undefined,raid?.id))toast('공유 덱을 게시했어요.');break;
   case 'jump-slots':root.querySelectorAll('.squad')[target[0]].scrollIntoView({behavior:'smooth',block:'start'});break;
   case 'jump-catalog':root.querySelector('.catalog-panel')!.scrollIntoView({behavior:'smooth',block:'start'});break;
   case 'capture':{
    const snapshot:Deck=JSON.parse(JSON.stringify(deck));
    const request=++captureRequest;
    dialog.classList.add('capture-dialog');
    show(`<h2>편성 이미지 캡처</h2><p role="status">${loadingMarkup("니케 이미지를 불러와 캡처하는 중…")}</p>`);
    try{
     const {captureDeck}=await import('./deck-capture');
     const blob=await captureDeck(snapshot,catalog,raid);
     if(!isCurrent()||!dialog.open||request!==captureRequest)return;
     captureBlob=blob;captureUrl=URL.createObjectURL(blob);
     const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
     root.querySelector('#deck-dialog-content')!.innerHTML=`<h2>편성 이미지 캡처</h2><p>전체 스쿼드${snapshot.candidates.length?'와 후보 니케':''}를 한 장의 PNG로 저장합니다.</p><div class="capture-preview"><img src="${captureUrl}" alt="${snapshot.type==='solo'?'솔로':'유니온'} 레이드 전체 편성 캡처 미리보기"/></div><div class="capture-actions"><a class="primary" href="${captureUrl}" download="MIMIR-${snapshot.type}-${stamp}.png">PNG 이미지 저장 ↓</a><button data-action="copy-image" class="capture-copy">이미지 복사</button></div><p class="hint" id="capture-status" role="status">빈 스쿼드는 제외됩니다. 화면 크기와 스크롤 위치에 관계없이 저장합니다.</p>`;
    }catch(err){if(isCurrent()&&dialog.open&&request===captureRequest)root.querySelector('#deck-dialog-content')!.innerHTML=`<h2>캡처하지 못했어요</h2><p role="alert">${esc(err instanceof Error?err.message:'다시 시도해 주세요.')}</p><button data-action="close-dialog" class="primary">닫기</button>`;}
    break;
   }
   case 'copy-image':{
    const status=root.querySelector('#capture-status')!;
    if(!captureBlob||!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){status.textContent='이미지 복사를 지원하지 않는 브라우저예요. PNG 이미지 저장을 이용해 주세요.';break;}
    try{await navigator.clipboard.write([new ClipboardItem({'image/png':captureBlob})]);if(dialog.open)status.textContent='이미지를 클립보드에 복사했어요.';}catch{if(dialog.open)status.textContent='이미지 복사가 허용되지 않았어요. PNG 이미지 저장을 이용해 주세요.';}
    break;
   }
   case 'close-dialog':dialog.close();break;
   case 'add-candidates':update(()=>{deck.hasCandidate=true;deck.candidates=[];});break;
   case 'clear-candidates':update(()=>{deck.candidates=[];});break;
   case 'remove-candidates':update(()=>{deck.hasCandidate=false;deck.candidates=[];});break;
   case 'clear-filters':query='';filters={burst:new Set(),element:new Set(),weaponType:new Set(),company:new Set(),rank:new Set()};hidePlaced=false;root.querySelector<HTMLInputElement>('#nikke-search')!.value='';root.querySelector<HTMLInputElement>('#hide-placed')!.checked=false;renderCatalog();break;
   case 'undo':case 'redo':{const source=b.dataset.action==='undo'?undo:redo,dest=b.dataset.action==='undo'?redo:undo;if(!source.length)break;dest.push(JSON.stringify(deck));deck=JSON.parse(source.pop()!);moving=null;persist();renderWorkspace();renderCatalog();const select=root.querySelector<HTMLSelectElement>('#weakness');if(select)select.value=deck.weakness;toast('편성을 복원했어요.');break;}
   case 'reset':show('<h2>현재 덱을 비울까요?</h2><p>스쿼드와 후보가 모두 초기화됩니다.<br>다른 레이드 유형의 편성은 유지됩니다.</p><button class="primary" data-action="confirm-reset">전체 비우기</button>');break;
   case 'confirm-reset':moving=null;update(()=>{deck=emptyDeck(mode);target=[0,0];});{const select=root.querySelector<HTMLSelectElement>('#weakness');if(select)select.value=deck.weakness;}dialog.close();toast('편성을 초기화했어요. 실행 취소로 되돌릴 수 있어요.');break;
   case 'copy':{
    let code:string;try{code=encodeDeck(deck,catalog);}catch(err){toast((err as Error).message);break;}
    try{await navigator.clipboard.writeText(code);if(isCurrent()){showCopyFeedback('덱 코드가 복사되었습니다');window.clearTimeout(copyButtonTimer);b.textContent='✓ 복사 완료';b.classList.add('copy-success');copyButtonTimer=window.setTimeout(()=>{b.textContent='⧉ 코드 복사';b.classList.remove('copy-success');},2500);}}catch{if(isCurrent()){window.clearTimeout(copyButtonTimer);b.textContent='⧉ 코드 복사';b.classList.remove('copy-success');showCopyFeedback('복사하지 못했어요. 클립보드 권한을 확인해 주세요.',true);}}
    break;
   }
   case 'import':show(`<h2>덱 코드 가져오기</h2><p>기존 미미르의 숫자 코드와 이전 ID 코드를 지원해요.<br>현재 ${mode==='solo'?'솔로':'유니온'} 편성을 교체합니다. 실행 취소로 복원할 수 있어요.</p><form id="import-form"><label for="import-code">덱 코드</label><textarea id="import-code" required maxlength="20000" placeholder="미미르 덱 코드를 붙여넣으세요."></textarea><button class="primary" type="submit">편성 가져오기</button><p id="import-status" role="alert"></p></form>`);break;
  }
 });

 root.addEventListener('submit',e=>{if((e.target as HTMLElement).id!=='import-form')return;e.preventDefault();try{const incoming=decodeDeck(root.querySelector<HTMLTextAreaElement>('#import-code')!.value,catalog);if(incoming.type!==mode)throw Error(`${incoming.type==='solo'?'솔로':'유니온'} 레이드 코드예요. 상단에서 레이드 유형을 변경해 주세요.`);moving=null;update(()=>{deck=incoming;target=[0,0];});const select=root.querySelector<HTMLSelectElement>('#weakness');if(select)select.value=deck.weakness;dialog.close();toast('덱 코드를 가져왔어요.');}catch(err){root.querySelector('#import-status')!.textContent=(err as Error).message;}});
 let pointerDrag:{id:string;from?:[number,number];x:number;y:number;pointer:number;button:HTMLElement;active:boolean;ghost?:HTMLElement}|null=null;
 const clearPointer=()=>{pointerDrag?.ghost?.remove();pointerDrag=null;root.querySelectorAll('.drop-ready,.drag-origin').forEach(el=>el.classList.remove('drop-ready','drag-origin'));};
 root.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.pointerType==='touch')return;
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-add],[data-slot]');
  if(!button||button.disabled)return;
  const position=button.dataset.slot?.split(':').map(Number) as [number,number]|undefined;const id=button.dataset.add??(position?deckSlot(deck,position):null);if(!id)return;
  suppressClick=false;pointerDrag={id,from:position,x:e.clientX,y:e.clientY,pointer:e.pointerId,button,active:false};button.setPointerCapture(e.pointerId);
 });
 root.addEventListener('pointermove',e=>{
  const drag=pointerDrag;if(!drag||drag.pointer!==e.pointerId)return;
  if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6){
   drag.active=true;drag.button.classList.add('drag-origin');const ghost=drag.button.cloneNode(true) as HTMLElement;
   ghost.className='nikke-add pointer-ghost';ghost.removeAttribute('data-add');ghost.style.width=`${drag.button.getBoundingClientRect().width}px`;ghost.setAttribute('aria-hidden','true');root.append(ghost);drag.ghost=ghost;
  }
  if(!drag.active)return;e.preventDefault();drag.ghost!.style.left=`${e.clientX+14}px`;drag.ghost!.style.top=`${e.clientY+14}px`;
  root.querySelectorAll('.drop-ready').forEach(el=>el.classList.remove('drop-ready'));
  const drop=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-drop]');if(drop&&root.contains(drop))drop.classList.add('drop-ready');
 });
 root.addEventListener('pointerup',e=>{
  const drag=pointerDrag;if(!drag||drag.pointer!==e.pointerId)return;
  const drop=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-drop]');const active=drag.active,id=drag.id,from=drag.from;
  clearPointer();if(!active)return;e.preventDefault();suppressClick=true;window.setTimeout(()=>{suppressClick=false;},0);
  if(drop&&root.contains(drop)){moving=null;const to=drop.dataset.drop!.split(':').map(Number) as [number,number];if(from){if(from.join(':')!==to.join(':'))update(()=>{moveSlot(deck,from,to);selectedNikke=null;target=to;});}else assign(id,to);}
 });
 root.addEventListener('pointercancel',clearPointer);
 root.addEventListener('dragstart',e=>{if((e.target as HTMLElement).closest('[data-slot],[data-add]'))e.preventDefault();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.open&&selectedNikke){selectedNikke=null;renderWorkspace();renderCatalog();toast('니케 선택을 해제했어요.');}});
 persist();renderWorkspace();renderCatalog();
}















