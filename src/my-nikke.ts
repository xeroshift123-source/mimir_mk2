import {loadingMarkup} from './loading';
import {scoreColor} from './statistics-color';
import {growthStatisticsPreview} from './growth-statistics-ui';
import type {Nikke} from './deck-model';
import {elements} from './deck-model';
import {elementIcon,burstIcon} from './card-design';
import {demoGrowth,number,sumOptions,topOverloadOptions,collectionProgress,overloadColorClass} from './profile-data';
import type {Growth} from './profile-data';
import {emptyProfileFilters,filterAndSortRoster,profileSorts,level40Cp} from './profile-controls';
import {rosterControls,rosterGrid,portraitValue} from './profile-roster-ui';
import {usesFirebase,accountProfile,accountSession,accountError,currentProfileSnapshot,isAccountRefreshing,openAccountProfile,refreshAccount,readSavedAccount,scoreCalculationPending} from './account-client';
import type {ProfileSnapshot} from './account-profile-cache';
import {profileGrowth,validScore,researchIds} from './account-profile';
import './my-nikke.css';

const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const paths:Record<string,string>={user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',sync:'<path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',power:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',level:'<path d="m3 17 9-9 9 9M3 10l9-8 9 8"/>',group:'<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 5a3 3 0 0 1 0 6m2 3a6 6 0 0 1 3 5v2"/>',cube:'<path d="m12 2 10 6v10l-10 6L2 18V8zm0 12L2 8m10 6 10-6m-10 6v10"/>',shield:'<path d="m12 2 9 4v7c0 6-9 10-9 10S3 19 3 13V6z"/>',plus:'<circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/>',arrow:'<path d="M5 19 19 5M5 5h14v14"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 3"/>',star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>'};
const icon=(key:string)=>`<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]??paths.info}</svg>`;
const company:Record<string,string>={Elysion:'엘리시온',Missilis:'미실리스',Tetra:'테트라',Pilgrim:'필그림',Abnormal:'어브노멀'};
const roles:Record<string,string>={ATK:'화력형',DEF:'방어형',SUP:'지원형'};
const demoResearch=[['공통 연구','250'],['화력형','80'],['방어형','75'],['지원형','80'],['엘리시온','70'],['미실리스','75'],['테트라','75'],['필그림','85'],['어브노멀','60']];

function collectionBadge(item:Growth['collection']){
 if(!item)return '<span class="collection-missing" title="소장품 정보 미수집">—</span>';
 const label=item.rank==='favorite'?'애장품':item.rank+' 소장품';
 const stars=collectionProgress(item);
 const marks=Array.from({length:stars},()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.5 3.2 6.6 7.3 1.1-5.3 5.1 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2L1.5 9.2l7.3-1.1z"/></svg>').join('');
 return `<span class="collection-badge collection-${item.rank.toLowerCase()}" title="${label} · ${item.level}단계" aria-label="${label} ${item.level}단계"><span class="collection-marks" aria-hidden="true">${marks}</span></span>`;
}

function equipmentOptionRows(eq:Growth['equipment'][number]){
 const sparse=eq.options.some(o=>o.slotIndex!==undefined),count=(eq.tier??(eq.options.length?10:0))>=10?3:eq.options.length;
 if(!count)return '<p class="my-detail-explainer">오버로드 옵션 없음</p>';
 return Array.from({length:count},(_,index)=>{const o=sparse?eq.options.find(o=>o.slotIndex===index):eq.options[index];
 if(!o)return '<div class="overload-option overload-normal overload-empty"><dt><span class="overload-slot">'+(index+1)+'</span> 효과 없음</dt><dd>—</dd></div>';
 return '<div class="overload-option '+overloadColorClass(o.tier)+'"><dt>'+icon('power')+'<span><span class="overload-slot">'+(index+1)+'</span> '+esc(o.name)+' <small>Lv.'+(o.tier??'—')+'</small></span></dt><dd>+'+number(o.value,2)+'%</dd></div>';
 }).join('');
}

export async function mountMyNikke(root:HTMLElement,isCurrent:()=>boolean){
 root.innerHTML=`<p class="my-loading">${loadingMarkup("니케 정보를 준비하는 중…")}</p>`;
 const load=openAccountProfile();
 const catalogRequest=fetch('/data/nikkes.json').then(async response=>{
  if(!response.ok)throw Error();
  return await response.json() as Nikke[];
 }).catch(()=>null);
 const [loadedCatalog,initial]=await Promise.all([catalogRequest,load.initial]);
 if(!isCurrent())return;
 if(!loadedCatalog){root.innerHTML='<p class="my-loading">데이터를 불러오지 못했어요. 새로고침해 주세요.</p>';return;}
 const catalog=loadedCatalog;
 const exampleRoster=()=>demoGrowth(catalog);
 let snapshot=initial.snapshot,account=snapshot?.profile??null;
 let roster=account?profileGrowth(account,catalog).roster:exampleRoster();
 let checking=initial.cached,verified=!!account&&!initial.cached;
 let profileNotice=initial.cached?'최신 정보 확인 중':account?.comparisonUnavailable?'비교 정보를 확인하지 못했어요.':'';
 const hasData=()=>demo||!!account;let demo=false,selected=roster[0]?.nikke.id??'',query='',sort='cp',tab='growth',filtersOpen=false,hideStats=false,view='list';let expandedScore:string|null=null;const filters=emptyProfileFilters();
 root.innerHTML=`<section class="my-page"><div class="my-breadcrumb"><a href="#">커맨드 센터</a><span>/</span>내 니케</div><div class="my-heading"><div><div class="eyebrow">MY NIKKE / COMMANDER PROFILE</div><h1>내 니케 정보<span>육성의 모든 순간을, 한눈에.</span></h1></div></div><div id="my-mode"></div><p id="my-account-action-status" class="my-account-action-status" role="status"></p><div id="my-content"></div><dialog class="my-dialog" id="my-dialog"><button class="my-dialog-close" aria-label="닫기">×</button><h2>스코어 안내</h2><p>${account?'계정 동기화로 가져온 육성 정보와 서버에서 저장한 미미르 스코어를 표시합니다.':'예시 보기에서는 합성 육성 데이터와 예시 스코어를 사용합니다.'}</p><p>미미르 스코어는 동기화 후 서버에서 계산해 저장합니다. 점수·정책 버전·표본이 유효할 때만 평균과 상위 비율을 비교합니다.</p><p>40레벨 투력은 원본 보정식과 테이블로 계산합니다. ${account?'수집 정보가 부족하면 협투력을 표시하지 않습니다.':'예시 보기의 육성 데이터는 합성 예시입니다.'} 정보 누락은 0점으로 대체하지 않습니다.</p><button class="my-connect" data-my="close-info">확인</button></dialog></section>`;
 const content=root.querySelector<HTMLElement>('#my-content')!,dialog=root.querySelector<HTMLDialogElement>('#my-dialog')!;
 // Use the roster's actual width: the adjacent detail panel also affects available space.
 const minimumListWidth=774;
 let observedRoster:HTMLElement|null=null,automaticGrid=false;
 const rosterResize=new ResizeObserver(()=>{
  if(!isCurrent()||!root.isConnected){rosterResize.disconnect();return;}
  const narrow=(observedRoster?.clientWidth??minimumListWidth)<minimumListWidth;
  if(narrow!==automaticGrid){automaticGrid=narrow;renderRoster();}
 });
 const profileEvents=new AbortController();
 const removalObserver=new MutationObserver(()=>{if(!root.isConnected){profileEvents.abort();rosterResize.disconnect();removalObserver.disconnect();}});
 removalObserver.observe(root.parentNode??document.body,{childList:true});
 const profilePage=root.querySelector<HTMLElement>('.my-page')!;
 // One content-width decision drives both the layout and detail-sheet behavior.
 const hasInlineDetail=()=>profilePage.clientWidth>=640;
 const detailSheet=document.createElement('dialog');detailSheet.className='mobile-nikke-sheet';detailSheet.setAttribute('aria-label','니케 상세 정보');
 detailSheet.innerHTML='<div class="mobile-sheet-header"><button class="mobile-sheet-grip" aria-label="상세 창 크기 조절" type="button"><span></span></button><button class="mobile-sheet-close" aria-label="니케 상세 닫기" type="button">×</button></div><div class="mobile-sheet-body"></div>';
 root.querySelector('.my-page')!.append(detailSheet);
 let sheetTrigger:HTMLElement|null=null,savedBodyOverflow='';
 const restoreDetail=()=>{const detail=detailSheet.querySelector('#my-detail');if(detail)root.querySelector('.my-layout')?.append(detail);document.body.style.overflow=savedBodyOverflow;detailSheet.style.removeProperty('height');if(sheetTrigger?.isConnected)sheetTrigger.focus({preventScroll:true});sheetTrigger=null;};
 detailSheet.addEventListener('close',restoreDetail);
 detailSheet.querySelector('.mobile-sheet-close')!.addEventListener('click',()=>detailSheet.close());
 detailSheet.addEventListener('click',e=>{if(e.target===detailSheet){const r=detailSheet.getBoundingClientRect(),p=e as MouseEvent;if(p.clientY<r.top||p.clientX<r.left||p.clientX>r.right)detailSheet.close();}});
 const openDetailSheet=(trigger:HTMLElement)=>{const detail=root.querySelector<HTMLElement>('#my-detail');if(!detail)return;sheetTrigger=trigger;detailSheet.querySelector('.mobile-sheet-body')!.append(detail);savedBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';detailSheet.showModal();detail.scrollTop=0;detailSheet.querySelector<HTMLButtonElement>('.mobile-sheet-close')!.focus({preventScroll:true});};
 const onDetailBreakpoint=()=>{
  const inline=hasInlineDetail();profilePage.classList.toggle('has-inline-detail',inline);
  if(inline&&detailSheet.open){detailSheet.close();restoreDetail();}
 };
 const detailLayoutResize=new ResizeObserver(onDetailBreakpoint);detailLayoutResize.observe(profilePage);onDetailBreakpoint();
 const sheetCleanup=new MutationObserver(()=>{if(!root.isConnected){if(detailSheet.open){detailSheet.close();document.body.style.overflow=savedBodyOverflow;}detailLayoutResize.disconnect();sheetCleanup.disconnect();}});sheetCleanup.observe(root.parentNode??document.body,{childList:true});
 const grip=detailSheet.querySelector<HTMLElement>('.mobile-sheet-grip')!;let resizing:{y:number;height:number;pointer:number}|null=null;
 grip.addEventListener('pointerdown',e=>{resizing={y:e.clientY,height:detailSheet.getBoundingClientRect().height,pointer:e.pointerId};grip.setPointerCapture(e.pointerId);});
 grip.addEventListener('pointermove',e=>{if(!resizing||resizing.pointer!==e.pointerId)return;detailSheet.style.height=Math.max(window.innerHeight*.5,Math.min(window.innerHeight*.95,resizing.height+resizing.y-e.clientY))+'px';});
 grip.addEventListener('pointerup',()=>{resizing=null;});grip.addEventListener('pointercancel',()=>{resizing=null;});
 const connect=()=>root.dispatchEvent(new CustomEvent('mimir-sync',{bubbles:true}));
 function scoreBreakdown(code:string){

  const rows=demo?roster.filter(g=>g.nikke.element===code).map((g,i)=>({nikke:g.nikke,average:280-i*19.7,score:g.score,topPercent:g.score===null?null:[12,42,67,85][i%4],sampleCount:null as number|null,owned:true})):
   Object.values(account?.nikkeComparisons??{}).filter(c=>c.weakness===code.toLowerCase()).flatMap(c=>{const nikke=catalog.find(n=>n.blablaNameCode===c.nameCode);return nikke?[{nikke,average:c.average,score:c.score,topPercent:c.topPercent,sampleCount:c.sampleCount,owned:!!account?.profile.characters.some(n=>n.name_code===c.nameCode)}]:[];});
  const hasAverage=rows.some(row=>row.average!==null);
  rows.sort((a,b)=>hasAverage?(b.average??-Infinity)-(a.average??-Infinity)||a.nikke.name.localeCompare(b.nikke.name,'ko'):(b.score??-Infinity)-(a.score??-Infinity)||a.nikke.name.localeCompare(b.nikke.name,'ko'));
  return '<div class="score-breakdown-inner"><div class="score-breakdown-heading"><strong>'+elements[code]+' 니케</strong><span>'+ (hasAverage?'전체 평균 높은순':'내 점수 높은순')+(demo?' · 예시':'')+'</span></div>'+ (rows.length?rows.map(row=>{
   const strength=row.topPercent===null?null:100-row.topPercent;
   return '<div class="score-breakdown-row"><img src="/'+esc(row.nikke.imageUrl)+'" alt="" loading="lazy"/><div class="score-breakdown-name"><strong>'+esc(row.nikke.name)+'</strong><small>'+ (row.average===null?'전체 평균 미제공':'전체 평균 '+number(row.average,2)+'점')+(row.sampleCount===null?' · 예시':' · '+row.sampleCount+'계정')+'</small></div><div class="score-breakdown-ranking"><div><span>'+ (row.topPercent===null?(row.owned?'비교 대기':'미보유'):'상위 '+number(row.topPercent,1)+'%')+'</span><small>내 점수 '+number(row.score,2)+'</small></div><span class="element-score-track"><i style="width:'+(strength??0)+'%;background:'+(strength===null?'#899187':scoreColor(strength))+'"></i></span></div></div>';
  }).join(''):'<p class="score-breakdown-empty">이 속성의 비교 통계가 아직 없어요.</p>')+'</div>';
 }
 function scoreChart(){
  if(!demo&&account?.scoreError)return `<p class="my-summary-note" role="status">${esc(account.scoreError)}</p>`;
  if(!demo&&scoreCalculationPending(account))return loadingMarkup('미미르 스코어 계산 중…');
  if(!demo&&account?.scoreStatus==='failed')return '<p class="my-summary-note" role="status">미미르 스코어를 계산하지 못했어요.</p>';
  const examples=[7.5,24,48,89,65];
  const scores=Object.entries(elements).map(([code,label],index)=>{
   const values=demo?roster.filter(g=>g.nikke.element===code&&g.score!==null).map(g=>g.score!):[];
   const comparison=account?.elementScores?.[code.toLowerCase()];
   return {code,label,score:demo?(values.length?values.reduce((a,b)=>a+b,0):null):comparison?.score??null,
    topPercent:demo?examples[index]:comparison?.topPercent??null,sampleCount:demo?null:comparison?.sampleCount??0};
  });

  return '<div class="element-score-chart"><div class="score-chart-caption"><span>'+ (demo?'전체 유저 대비 순위 · 표시 예시':'전체 유저 대비 순위')+'</span><span class="score-color-legend"><i></i> 낮음 → 높음</span></div>'+scores.map(s=>{
   const rank=s.topPercent===null?null:100-s.topPercent,color=rank===null?'#899187':scoreColor(rank);
   const label=s.topPercent===null?'비교 대기':'상위 '+number(s.topPercent,1)+'%';
   const description=demo?'합성 순위 예시 · 실제 통계 아님':'미미르 동일 정책·계산 버전 '+s.sampleCount+'계정 기준'+(s.topPercent===null?' · 유효 표본 20개 이상 필요':'');
   return '<button class="element-score-row '+(expandedScore===s.code?'active':'')+'" data-score-element="'+s.code+'" aria-expanded="'+(expandedScore===s.code)+'" aria-controls="score-breakdown-'+s.code+'" aria-label="'+s.label+' '+label+', 스코어 '+number(s.score,2)+', 니케별 순위 펼치기" title="'+description+'"><span class="score-row-label"><img src="/assets/icons/elements/icon-elements-'+s.code+'.webp" alt=""/>'+s.label+'</span><span class="element-score-track" aria-hidden="true"><i style="width:'+(rank??0)+'%;background:'+color+'"></i></span><strong>'+label+'</strong><small>'+number(s.score,2)+'점</small></button><div class="score-breakdown '+(expandedScore===s.code?'is-open':'')+'" id="score-breakdown-'+s.code+'" role="region" aria-label="'+s.label+' 니케별 순위" '+(expandedScore===s.code?'':'inert')+'><div>'+scoreBreakdown(s.code)+'</div></div>';
  }).join('')+'</div>';

 }
 function updateFreshness(){
  const target=root.querySelector<HTMLElement>('[data-profile-freshness]');
  if(target&&snapshot){
   const date=new Date(snapshot.checkedAt).toLocaleString('ko-KR');
   target.textContent='최근 조회 '+date+(profileNotice?' · '+profileNotice:'');
  }
  const refresh=root.querySelector<HTMLButtonElement>('[data-my="refresh-account"]');
  if(refresh){
   const refreshing=isAccountRefreshing();
   const label=refreshing?(scoreCalculationPending(account)?'스코어 계산 중':'갱신 중'):'갱신';
   refresh.disabled=refreshing||!verified||checking;
   refresh.classList.toggle('is-refreshing',refreshing);
   refresh.setAttribute('aria-label',refreshing?label:'정보 갱신');
   refresh.setAttribute('aria-busy',String(refreshing));
   refresh.querySelector('span')!.textContent=label;
  }
 }
 function showSnapshot(next:ProfileSnapshot|null){
  if(!isCurrent())return;
  const keepSheet=detailSheet.open&&!!next&&account?.account.id===next.profile.account.id;
  const detailScroll=root.querySelector('#my-detail')?.scrollTop??0;
  const search=root.querySelector<HTMLInputElement>('#my-search');
  const caret=search===document.activeElement?[search?.selectionStart,search?.selectionEnd] as const:null;
  snapshot=next;
  account=next?.profile??null;
  roster=account?profileGrowth(account,catalog).roster:exampleRoster();
  if(account)demo=false;
  if(!roster.some(g=>g.nikke.id===selected))selected=roster[0]?.nikke.id??'';
  render(keepSheet);
  const detail=root.querySelector<HTMLElement>('#my-detail');
  if(detail)detail.scrollTop=detailScroll;
  if(caret){
   const nextSearch=root.querySelector<HTMLInputElement>('#my-search');
   nextSearch?.focus({preventScroll:true});
   if(caret[0]!=null&&caret[1]!=null)nextSearch?.setSelectionRange(caret[0],caret[1]);
  }
 }
 function render(keepSheet=false){
  if(keepSheet)detailSheet.querySelector('.mobile-sheet-body')!.replaceChildren();
  else if(detailSheet.open){detailSheet.close();restoreDetail();}
  const refreshing=isAccountRefreshing();
  root.querySelector('#my-mode')!.innerHTML=demo?`<div class="my-demo"><div>${icon('info')}<span><strong>예시 계정 미리보기</strong> 실제 계정 연동 전 · 모든 수치는 화면 확인용 예시입니다.</span></div><button data-my="empty">예시 닫기 ×</button></div>`:'';
  if(!hasData()&&checking){content.innerHTML=loadingMarkup('선택된 지휘관 정보를 불러오는 중…');return;}
  if(!hasData()){content.innerHTML=`<section class="my-empty"><span class="my-empty-icon">${icon('user')}</span><h2>당신의 니케를 만나볼까요?</h2><p>BLABLALINK 전투 정보를 연결하면<br>보유 니케와 육성 정보를 한곳에서 확인할 수 있어요.</p><button class="my-connect" data-my="connect">${icon('sync')} 계정 연결하기</button><button class="my-text-button" data-my="demo">먼저 예시 화면 둘러보기</button><small>${esc(accountError||(!accountSession.configured?'OCI 서버와 Google 로그인 설정을 준비 중입니다.':'로그인 후 BLABLALINK 계정을 연결해 주세요.'))}</small></section>`;return;}
  const consoleLevels=demo?demoResearch:researchIds.map(([id,label])=>[label,String(account?.profile.recycleRoom.find(r=>r.tid===id)?.lv??'—')]);
  const consoleIcons=['reenergy.png','attacker-mono.webp','defender-mono.webp','supporter-mono.webp','elysion-mono.webp','missilis-mono.webp','tetra-mono.webp','pilgrim-mono.webp','abnormal-mono.webp'];
  const consoleMarkup=`<div class="commander-console">${icon('cube')}<div class="console-heading"><span>콘솔</span><details class="console-details"><summary aria-label="상세 콘솔 레벨 보기">${icon('plus')}</summary><div class="console-popover"><span class="console-popover-title">콘솔 레벨${demo?' · 예시':''}</span><dl>${consoleLevels.map(([label,value],i)=>`<div><dt>${i?`<img class="console-symbol" src="/assets/icons/console/${consoleIcons[i]}" alt="${label}" title="${label}"/>`:'공통 연구'}</dt><dd><small>Lv</small>${value}</dd></div>`).join('')}</dl></div></details></div><div class="console-common"><span class="console-common-label">공통 연구</span><strong><small>Lv</small> ${consoleLevels[0][1]}</strong></div></div>`;
  content.innerHTML=`<section class="commander-summary" aria-label="계정 요약"><div class="commander-identity"><div class="commander-avatar">M<span>02</span></div><div><div class="commander-name"><h2>${esc(account?.profile.nickname??'MIMIR 지휘관')}</h2><span>${demo?'DEMO':'CONNECTED'}</span>${demo?'':`<button class="commander-refresh ${refreshing?'is-refreshing':''}" data-my="refresh-account" aria-label="${refreshing?'정보 갱신 중':'정보 갱신'}" aria-busy="${refreshing}" ${refreshing?'disabled':''}>${icon('sync')}<span>${refreshing?'갱신 중':'갱신'}</span></button>`}</div><p><span>${esc(account?.profile.server??'한국')} 서버</span><i>·</i><span>${esc(account?.profile.union??'MIMIR UNION')}</span></p><div class="commander-freshness">${icon('clock')} ${demo?'예시 데이터 · 실제 동기화 기록 없음':`<span>마지막 갱신 ${esc(new Date(account!.account.updatedAt).toLocaleString('ko-KR'))}</span>`}</div>${demo?'':'<div class="commander-freshness" data-profile-freshness role="status"></div>'}</div></div><div class="commander-metrics">${consoleMarkup}<div>${icon('level')}<span>싱크로 레벨</span><strong>${number(account?.profile.synchroLevel??400)}</strong></div><div>${icon('group')}<span>보유 니케 <small>${demo?'예시':''}</small></span><strong>${account?.profile.ownedNikkesCount??roster.length}<small>명</small></strong></div></div></section><section class="element-score-section" aria-label="속성별 스코어"><div class="my-section-label"><h2>속성별 미미르 스코어 <span>${demo?'표시 예시':'저장 점수'}</span></h2><button data-my="info" aria-label="미미르 스코어 안내">${icon('info')}</button></div>${scoreChart()}<p class="my-summary-note">${demo?'점수·순위는 합성 예시이며 실제 전체 유저 통계가 아닙니다.':'미미르에 저장된 동일 정책·계산 버전의 계정과 비교합니다. 막대가 길수록 상위이며, 유효 표본 20개 미만은 비교 대기입니다.'}</p></section><div class="my-layout"><section class="my-roster" aria-label="보유 니케 목록"><div class="my-roster-heading"><h2>니케 목록 <span>${roster.length}</span></h2><div class="my-view-switch" role="group" aria-label="목록 보기 방식"><button data-view="list" aria-pressed="${view==='list'}" title="리스트 뷰">☰ <span>목록</span></button><button data-view="grid" aria-pressed="${view==='grid'}" title="그리드 뷰">▦ <span>그리드</span></button></div></div><div class="roster-search-toolbar"><div class="my-search">${icon('search')}<input id="my-search" type="search" placeholder="니케 이름 검색…" aria-label="내 니케 검색" value="${esc(query)}" autocomplete="off"/></div><button class="roster-icon-button roster-filter-button" data-my="filters" title="필터" aria-label="필터" aria-expanded="${filtersOpen}" aria-controls="profile-filters"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button></div>${rosterControls(filters,filtersOpen,hideStats,sort)}<div id="my-roster-items"></div></section><section class="my-detail" aria-label="선택한 니케 상세" id="my-detail"></section></div>`;
  const consoleDetails=root.querySelector<HTMLDetailsElement>('.console-details')!;
  consoleDetails.addEventListener('mouseenter',()=>{consoleDetails.open=true;});
  consoleDetails.addEventListener('mouseleave',()=>{if(!consoleDetails.contains(document.activeElement))consoleDetails.open=false;});
  consoleDetails.addEventListener('focusout',event=>{if(!consoleDetails.contains(event.relatedTarget as Node|null))consoleDetails.open=false;});
  consoleDetails.addEventListener('keydown',event=>{if(event.key==='Escape'){consoleDetails.open=false;consoleDetails.querySelector('summary')?.blur();}});
  root.querySelector<HTMLSelectElement>('#my-sort')!.value=sort;renderRoster();renderDetail();updateFreshness();
  if(keepSheet){
   detailSheet.querySelector('.mobile-sheet-body')!.append(root.querySelector('#my-detail')!);
   sheetTrigger=root.querySelector<HTMLElement>(`[data-nikke="${CSS.escape(selected)}"]`);
  }
 }
 function filtered(){return filterAndSortRoster(roster,query,filters,sort);}
 function renderRoster(){
  if(!hasData())return;
  const items=root.querySelector<HTMLElement>('#my-roster-items');if(!items)return;
  if(items!==observedRoster){rosterResize.disconnect();observedRoster=items;rosterResize.observe(items);}
  automaticGrid=items.clientWidth<minimumListWidth;
  const actualView=automaticGrid?'grid':view;
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>{
   button.setAttribute('aria-pressed',String(button.dataset.view===actualView));
   button.disabled=automaticGrid&&button.dataset.view==='list';
   button.title=button.disabled?'목록 영역이 넓어지면 리스트 보기를 사용할 수 있어요.':button.dataset.view==='list'?'리스트 뷰':'그리드 뷰';
  });
  const list=filtered();if(list.length&&!list.some(g=>g.nikke.id===selected))selected=list[0].nikke.id;renderDetail();
  if(actualView==='grid'&&list.length){root.querySelector('#my-roster-items')!.innerHTML=rosterGrid(list,selected,hideStats,sort);return;}
  const head='<div class="growth-list-header" aria-hidden="true"><span>니케 · 육성</span><span>스킬 1 / 2 / B</span><span>소장품 · 큐브</span><span>장비 강화</span><span>주요 오버로드 합계</span><span>스코어</span></div>';
  root.querySelector('#my-roster-items')!.innerHTML=`<div class="growth-list-scroll">${head}<div class="my-roster-items growth-list">${list.length?list.map(g=>{
   const cube=g.cube?.name??null;
   return `<button class="my-nikke-item growth-row ${selected===g.nikke.id?'selected':''}" data-nikke="${g.nikke.id}" aria-pressed="${selected===g.nikke.id}" aria-label="${esc(g.nikke.name)} 상세 보기"><span class="growth-identity"><span class="my-nikke-thumb"><img src="/${g.nikke.imageUrl}" alt="" loading="lazy"/><span class="my-thumb-element"><img src="${elementIcon(g.nikke)}" alt="${elements[g.nikke.element]}"/></span><span class="my-thumb-burst"><img src="${burstIcon(g.nikke)}" alt="버스트 ${g.nikke.burst}"/></span>${hideStats?'':`<span class="portrait-cp" title="${profileSorts[sort]??'전투력'} ${g.isDemo?'· 예시':''}">${portraitValue(g,sort)}</span>`}</span><span class="growth-name"><strong title="${esc(g.nikke.name)}">${esc(Array.from(g.nikke.name).length>10?Array.from(g.nikke.name).slice(0,10).join('')+'...':g.nikke.name)}</strong><span>Lv.${g.level}</span><span class="growth-limit"><span aria-label="${g.grade}돌파">${'★'.repeat(g.grade)+'☆'.repeat(3-g.grade)}</span>${g.core?`<b>+${g.core}</b>`:''}</span></span></span><span class="growth-skills"><small>스킬 1 / 2 / B</small><strong>${g.skills.map(lv=>`<b class="${lv===10?'max-skill':''}">${lv}</b>`).join('<i>/</i>')}</strong></span><span class="growth-items"><small>소장품 · 큐브</small>${collectionBadge(g.collection)}<span class="growth-cube" title="${g.cube?esc(g.cube.name)+' Lv.'+g.cube.level:'큐브 정보 미수집'}">${cube?`${esc(cube)} <b>${g.cube!.level}</b>`:'—'}</span></span><span class="growth-equipment"><small>장비 강화</small>${[['머리','몸통'],['장갑','신발']].map(pair=>`<span class="equipment-pair">${pair.map(part=>{const eq=g.equipment.find(e=>({팔:'장갑',다리:'신발'} as Record<string,string>)[e.name]===part||e.name===part);return `<b class="${eq?(eq.tier??0)>=10?'equipment-level-overload':eq.tier===9?'equipment-level-t9':'equipment-level-other':'equipment-level-other'}" title="${part} · ${eq?((eq.tier??0)>=10?'오버로드 장비':'일반 장비'):'정보 미수집'}" aria-label="${part} ${eq?'강화 '+eq.level:'정보 미수집'}">${eq?'+'+eq.level:'—'}</b>`;}).join('<i aria-hidden="true">/</i>')}</span>`).join('')}</span><span class="growth-overload"><small>주요 오버로드</small>${topOverloadOptions(g).map(o=>`<span class="${overloadColorClass(o.maxTier)}" title="${o.name} ${o.count}줄 합산 · 최고 Lv.${o.maxTier||'—'}"><span>${o.name}</span><b>${number(o.value,2)}%</b></span>`).join('')||'<span>오버로드 없음</span>'}</span><span class="my-item-score"><span>SCORE</span><strong>${number(g.score,2)}</strong></span></button>`;
  }).join(''):'<div class="my-no-results">검색 조건에 맞는 니케가 없어요.<button data-my="reset">필터 초기화</button></div>'}</div></div>`;
 }
 function renderDetail(){
  if(!hasData())return;if(!filtered().length){root.querySelector('#my-detail')!.innerHTML='<div class="my-no-results">조건에 맞는 니케가 없어요. 필터를 변경해 주세요.</div>';return;}const g=roster.find(n=>n.nikke.id===selected)!;const n=g.nikke;const coopCp=level40Cp(g);
  root.querySelector('#my-detail')!.innerHTML=`<div class="detail-character"><div class="detail-portrait"><img src="/${n.imageUrl}" alt="${esc(n.name)}"/><div class="detail-portrait-fade"></div></div><div class="detail-heading"><span class="detail-company">${company[n.company]??n.company}<i>/</i>${roles[n.type]??n.type}</span><h2>${esc(n.name)}</h2><div class="detail-nikke-badges"><span class="detail-symbol-badge" title="${elements[n.element]}" aria-label="${elements[n.element]}"><img src="${elementIcon(n)}" alt=""/></span><span class="detail-symbol-badge" title="버스트 ${n.burst==='0'?'ALL':n.burst}" aria-label="버스트 ${n.burst==='0'?'ALL':n.burst}"><img src="${burstIcon(n)}" alt=""/></span><span class="detail-weapon-badge">${n.weaponType}</span><span class="detail-symbol-badge" title="${esc(company[n.company]??n.company)}" aria-label="${esc(company[n.company]??n.company)}"><img class="detail-mono-symbol" src="/assets/icons/console/${n.company.toLowerCase()}-mono.webp" alt=""/></span><span class="detail-symbol-badge" title="${esc(roles[n.type]??n.type)}" aria-label="${esc(roles[n.type]??n.type)}"><img class="detail-mono-symbol" src="/assets/icons/console/${({ATK:'attacker',DEF:'defender',SUP:'supporter'} as Record<string,string>)[n.type]}-mono.webp" alt=""/></span></div></div></div><div class="detail-basic-metrics"><div><span>레벨</span><strong>${g.level}</strong></div><div><span>코어 강화</span><strong>+${g.core}</strong></div><div><span>호감도</span><strong>${g.bond}</strong></div><div><span>저장 전투력</span><strong>${number(g.cp)}</strong></div></div><section class="detail-coop" aria-label="40레벨 전투력"><div class="detail-coop-main"><div><span>40레벨 전투력 <small>협투력</small></span><strong>${number(coopCp)}</strong></div><button data-my="license" ${coopCp===null?'disabled':''}>면허증 발급 ${icon('arrow')}</button></div><p>${coopCp===null?'4부위 오버로드와 육성 정보가 필요해요.':'협동작전 Lv.40 기준 · 큐브 Lv.15 가정'}</p></section><div class="detail-tabs" role="tablist" aria-label="니케 상세 항목">${[['statistics','육성 통계'],['growth','육성 정보'],['equipment','장비·오버로드'],['score','스코어']].map(([key,label])=>`<button role="tab" id="detail-tab-${key}" data-tab="${key}" aria-selected="${tab===key}" aria-controls="detail-tab-panel" tabindex="${tab===key?0:-1}">${label}</button>`).join('')}</div><div class="detail-tab-panel" id="detail-tab-panel" role="tabpanel" aria-labelledby="detail-tab-${tab}" tabindex="0">${tabContent(g)}</div><p class="detail-data-note">${icon('info')} ${g.isDemo?'모든 육성 수치는 예시입니다. 실제 계정 연동 전.':'동기화된 육성 정보 · 협투력은 40레벨 보정값입니다.'}</p>`;
  if(tab==='statistics'&&!g.isDemo&&account&&n.blablaNameCode){
   const target=root.querySelector<HTMLElement>('[data-saved-statistics]'),openId=account.account.id,code=n.blablaNameCode;
   if(target){
    if(usesFirebase&&accountProfile?.account.id===openId)void import('./firebase-statistics').then(m=>{if(target.isConnected)m.mountSavedStatistics(target,openId,code);});
    else target.textContent=checking?'계정 정보를 확인하고 있어요.':'육성 통계를 불러오지 못했어요.';
   }
  }

 }
 function tabContent(g:Growth){
  if(tab==='statistics')return g.isDemo?growthStatisticsPreview(g):`<div data-saved-statistics role="status">${loadingMarkup("저장된 육성 통계를 불러오는 중…")}</div>`;
  if(tab==='equipment')return `<div class="detail-section-title"><h3>오버로드 합계</h3><span>${g.equipment.length}부위 합산</span></div><dl class="overload-sums">${sumOptions(g).map(o=>`<div class="overload-option ${overloadColorClass(o.maxTier)}" title="최고 옵션 Lv.${o.maxTier||'—'} 기준 색상"><dt>${o.name} <small>(${o.count})</small></dt><dd>+${number(o.value,2)}%</dd></div>`).join('')}</dl><div class="detail-section-title"><h3>장비 & 오버로드</h3><button class="profile-sim-launch" data-my="simulator">모듈작 시뮬레이터</button></div><div class="my-equipment-list">${g.equipment.map(eq=>`<details open><summary><span class="equipment-part">${icon('shield')}</span><strong>${eq.name} 장비</strong><span>${(eq.tier??0)>=10?'오버로드':'Tier '+(eq.tier??'—')} <b>Lv.${eq.level}</b></span><small>＋</small></summary><div class="equipment-item-name ${(eq.tier??(eq.options.length?10:9))>=10?'equipment-overloaded':'equipment-standard'}">${esc(eq.label??eq.name+' 장비')} (+${eq.level})</div><dl>${equipmentOptionRows(eq)}</dl></details>`).join('')}</div>`;
  if(tab==='score'){
   if(account?.scoreError)return `<p role="status">${esc(account.scoreError)}</p>`;
   if(!g.isDemo&&scoreCalculationPending(account))return loadingMarkup('미미르 스코어 계산 중…');
   if(!g.isDemo&&account?.scoreStatus==='failed')return '<p role="status">미미르 스코어를 계산하지 못했어요.</p>';
   const demoIndex=roster.filter(row=>row.nikke.element===g.nikke.element).findIndex(row=>row.nikke.id===g.nikke.id);
   const comparison=account?.nikkeComparisons?.[g.nikke.blablaNameCode??''];
   const top=g.isDemo?(g.score===null?null:[12,42,67,85][Math.max(0,demoIndex)%4]):comparison?.topPercent??g.scoreDetails?.topPercent??null;
   const strength=top===null?null:Math.max(0,Math.min(100,100-top));
   const rankBar=`<div class="personal-score-ranking"><div><strong>${top===null?'비교 대기':'상위 '+number(top,1)+'%'}</strong><small>${g.isDemo?'표시 예시':'전체 유저 대비'}</small></div><span class="element-score-track" role="img" aria-label="${top===null?'상위 비율 비교 대기':'상위 '+number(top,1)+'%'}"><i style="width:${strength??0}%;background:${strength===null?'#899187':scoreColor(strength)}"></i></span></div>`;
   return `<div class="detail-section-title"><h3>미미르 스코어</h3><button data-my="info" aria-label="스코어 계산 조건 안내">${icon('info')}</button></div><div class="personal-score"><span>${g.isDemo?'표시 예시':'저장된 스코어'}</span><strong>${number(g.score,2)}</strong><p>${g.score===null?'저장된 점수 없음 · 실제 연동 후 동기화 필요':g.isDemo?'합성 예시 점수 · 실제 계산 결과가 아닙니다.':'계산 버전 '+esc(g.scoreDetails?.calcVersion??'—')}</p>${rankBar}</div><div class="score-comparison"><div><span>표본 평균</span><strong>${number(g.scoreDetails?.average,2)}</strong></div><div><span>상위 비율</span><strong>${top===null?'—':number(top,1)+'%'}</strong></div><div><span>유효 표본</span><strong>${number(g.scoreDetails?.sampleCount)}</strong></div></div><p class="my-detail-explainer">평균과 상위 비율은 유효한 통계 표본이 있을 때 표시합니다. 누락된 점수는 0점으로 처리하지 않습니다.</p><button class="my-inline-link" data-my="info">평가 기준과 데이터 상태 ${icon('arrow')}</button>`;
  }
  return `<div class="detail-section-title"><h3>스킬 레벨</h3><span>SKILL DEVELOPMENT</span></div><div class="my-skills">${g.skills.map((lv,i)=>`<div><span>${i===2?'버스트 스킬':`스킬 ${i+1}`}</span><strong>${String(lv).padStart(2,'0')}<small> / 10</small></strong><div class="skill-track"><i style="width:${lv*10}%"></i></div></div>`).join('')}</div><div class="detail-section-title"><h3>장착 아이템</h3><span>큐브 & 소장품</span></div><div class="my-attached-item"><span class="attached-icon">${icon('cube')}</span><div><small>하모니 큐브</small><strong>${g.cube?esc(g.cube.name):'정보 미수집'}</strong></div><span>${g.cube?`Lv.${g.cube.level}`:'—'}</span></div><div class="my-attached-item"><span class="attached-icon">${icon('star')}</span><div><small>${g.collection?.rank==='favorite'?'애장품':g.collection?g.collection.rank+' 소장품':'소장품 · 애장품'}</small><span class="detail-collection-progress">${collectionBadge(g.collection)}${g.collection?`<strong>${g.collection.level}단계</strong>`:'<strong>정보 미수집</strong>'}</span></div></div><button class="my-score-peek" data-tab="score"><span>${icon('power')} 미미르 스코어 <small>${g.isDemo?'예시':'저장'}</small></span><strong>${number(g.score,2)} </strong></button>`;
 }
 root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.dataset.nikke){selected=b.dataset.nikke;root.querySelectorAll<HTMLButtonElement>('[data-nikke]').forEach(button=>{const active=button.dataset.nikke===selected;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});renderDetail();if(!hasInlineDetail())openDetailSheet(b);}
  if(b.dataset.tab){tab=b.dataset.tab;renderDetail();root.querySelector<HTMLElement>(`#detail-tab-${tab}`)?.focus({preventScroll:true});}
  if(b.dataset.filter&&b.dataset.value){const set=filters[b.dataset.filter as keyof typeof filters];const value=b.dataset.value;set.has(value)?set.delete(value):set.add(value);render();}
  if(b.dataset.scoreElement){
   expandedScore=expandedScore===b.dataset.scoreElement?null:b.dataset.scoreElement;
   root.querySelectorAll<HTMLButtonElement>('[data-score-element]').forEach(button=>{const open=button.dataset.scoreElement===expandedScore;button.classList.toggle('active',open);button.setAttribute('aria-expanded',String(open));});
   root.querySelectorAll<HTMLElement>('.score-breakdown').forEach(panel=>{const open=panel.id==='score-breakdown-'+expandedScore;panel.classList.toggle('is-open',open);panel.inert=!open;});
  }
  if(b.dataset.view){view=b.dataset.view;render();}
  switch(b.dataset.my){case 'simulator':{const g=roster.find(n=>n.nikke.id===selected);if(g)void import('./overload-simulator').then(({showSimulator})=>{if(isCurrent())showSimulator(g,isCurrent);});break;}case 'license':{const g=roster.find(n=>n.nikke.id===selected);if(g&&level40Cp(g)!==null)void import('./nikke-license').then(({showLicense})=>{if(isCurrent())return showLicense(g,isCurrent);});break;}case 'refresh-account':{
  if(isAccountRefreshing())break;
  const status=root.querySelector<HTMLElement>('#my-account-action-status')!;
  status.textContent='';
  void refreshAccount().catch(error=>{if(isCurrent())status.textContent=error.message;});
  break;
 }case 'read-scores':{b.disabled=true;b.dataset.loading='true';void readSavedAccount().catch(error=>{b.disabled=false;b.textContent=error.message;});break;}case 'empty':demo=false;render();break;case 'demo':demo=true;render();break;case 'connect':connect();break;case 'info':dialog.showModal();break;case 'close-info':dialog.close();break;case 'filters':filtersOpen=!filtersOpen;render();root.querySelector<HTMLElement>('.roster-filter-button')?.focus({preventScroll:true});break;case 'reset':query='';Object.values(filters).forEach(set=>set.clear());sort='cp';render();break;}
 });
 root.querySelector('.my-dialog-close')!.addEventListener('click',()=>dialog.close());
 root.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.id==='my-search'){query=input.value;renderRoster();}});
 root.addEventListener('change',e=>{const input=e.target as HTMLSelectElement;if(input.id==='my-sort'){sort=input.value;render();}if(input.id==='profile-hide-stats'){hideStats=(input as unknown as HTMLInputElement).checked;renderRoster();}});
 root.addEventListener('keydown',e=>{const target=e.target as HTMLElement;if(target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['statistics','growth','equipment','score'];const current=tabs.indexOf(tab);tab=e.key==='Home'?tabs[0]:e.key==='End'?tabs[tabs.length-1]:tabs[(current+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];renderDetail();root.querySelector<HTMLElement>(`#detail-tab-${tab}`)!.focus({preventScroll:true});});
 render();
 const onProfileChanged=(latest:ProfileSnapshot|null)=>{
  if(!isCurrent())return;
  if(latest&&latest.profile!==account){
   checking=false;
   verified=true;
   profileNotice=latest.profile.comparisonUnavailable?'비교 정보를 확인하지 못했어요.':'';
   showSnapshot(latest);
  }else updateFreshness();
 };
 document.addEventListener('mimir-account-profile-changed',event=>onProfileChanged((event as CustomEvent<ProfileSnapshot|null>).detail),{signal:profileEvents.signal});
 if(isAccountRefreshing())onProfileChanged(currentProfileSnapshot());
 if(initial.cached){
  void load.selection.then(id=>{
   if(!isCurrent()||!checking||id===undefined)return;
   verified=!!account&&id===account.account.id;
   if(!verified)showSnapshot(null);
  });
  void load.latest.then(latest=>{
   if(!isCurrent()||!checking)return;
   checking=false;
   const incomplete=!!(latest?.profile.scoreError||latest?.profile.comparisonUnavailable);
   if(account&&(!latest||(incomplete&&account.account.id===latest.profile.account.id))){
    profileNotice='최신 정보를 확인하지 못해 저장된 정보를 표시 중';
    updateFreshness();
    if(tab==='statistics'&&!demo)renderDetail();
    return;
   }
   verified=!!latest;
   profileNotice=incomplete?'일부 최신 정보를 확인하지 못했어요.':'';
   showSnapshot(latest);
  });
 }
}




