import './loading.css';
import {loadingMarkup} from './loading';
import './raid-tags.css';
import {builderEntry,lastBuilderRaid} from './builder-navigation';
import './typography.css';
import './page-layout.css';
import './buttons.css';
import './legal.css';
import './theme.css';
import {mountThemeToggle} from './theme';
import './style.css';
import {accountReady,accountProfile,accountSession,ensureAccountProfile,showAccountDialog,isTestAccount,mountAccountPage,usesFirebase} from './account-client';
import './account.css';
import './palette.css';
import {mountHomeRaids} from './home-raids';
import {raidHistory} from './data/raids';


const arrow = '';
const icon = (name: string) => {
 const paths: Record<string,string> = { grid:'<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><rect x="15" y="15" width="6" height="6"/>', layers:'<path d="m12 3 10 6-10 6L2 9zM2 14l10 6 10-6M2 19l10 6 10-6"/>', sync:'<path d="M20 7a9 9 0 0 0-15-1L2 9m0-6v6h6M4 17a9 9 0 0 0 15 1l3-3m0 6v-6h-6"/>', chart:'<path d="M4 20V10m8 10V4m8 16v-7"/>', calc:'<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M8 7h8M8 12h1m6 0h1m-8 5h1m6 0h1"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>' };
 return `<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.grid}</svg>`;
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
 <header class="header"><a class="brand" href="#" aria-label="MIMIR 홈"><img class="brand-logo" src="/assets/mimir-logo.png" alt="" width="38" height="34"/><strong>MIMIR</strong></a><nav aria-label="주 메뉴"><a href="#" class="active">커맨드 센터</a><button data-builder>덱 빌더</button><button data-library>덱 라이브러리</button><button data-profile>내 니케</button><button data-account-page>내 정보</button><button data-entertainment>엔터테인먼트!</button></nav><div class="header-actions"><button class="theme-toggle" type="button" data-theme-toggle></button><button class="login" type="button" data-account-open data-auth-pending disabled></button></div></header>
 <main><section class="hero"><div class="hero-copy"><h1>니케 덱 빌딩 도우미<br><em>MIMIR!</em></h1><p>흩어진 전투 정보를 하나로.<br>나의 니케를 이해하고, 더 나은 스쿼드를 완성하세요.</p><div class="hero-actions"><button class="primary" data-builder>덱 구성 시작하기 ${icon('arrow')}</button><button class="text-button" data-profile>내 니케 정보</button>
 <a class="text-button" href="https://dildoro.com" target="_blank" rel="noopener noreferrer">딜도로 바로가기 <span aria-hidden="true">↗</span></a>
 <a class="text-button" href="https://soloraidhistory.vercel.app/" target="_blank" rel="noopener noreferrer">솔레 금서고 바로가기 <span aria-hidden="true">↗</span></a>
 </div><section id="home-account-summary" aria-label="연동 지휘관 정보" hidden></section></div><div class="hero-art" aria-label="라피 레드 후드 캐릭터 아트"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="cross c1">+</div><div class="cross c2">+</div><span class="art-word">MIMIR</span><img src="/images/rapi_red_hood.webp" alt="라피 : 레드 후드" class="rapi"/><div class="art-label"><span class="tiny">FEATURED NIKKE / 001</span><strong>라피 : 레드 후드</strong><span>RAPI : RED HOOD <b>SSR</b></span></div><span class="art-coordinate">TACTICAL ARCHIVE — MIMIR</span></div></section>
 <section class="sync-strip"><div class="strip-icon">${icon('sync')}</div><div><h2>당신의 니케로 시작하세요.</h2><p>BLABLALINK 전투 정보를 연결하면, 내 육성에 맞춰 덱을 준비할 수 있어요.</p></div><button data-sync>전투 정보 동기화 ${arrow}</button></section>
 <section id="tools" class="tools"><div class="section-heading"><div><h2>미미르 도구</h2></div></div><div class="tool-grid"><button class="tool-card" data-builder><div class="card-top"><span class="tool-icon">${icon('grid')}</span><span class="card-no">01</span></div><h3>레이드 덱 빌더</h3><p>솔로·유니온 레이드 스쿼드를 편성하세요.</p><div class="mini-squad"><img src="/images/rapi_red_hood.webp" alt=""/><img src="/images/cinderella.webp" alt=""/><span>+</span><span>+</span><span>+</span></div></button><button class="tool-card" data-library><div class="card-top"><span class="tool-icon">${icon('layers')}</span><span class="card-no">02</span></div><h3>덱 라이브러리</h3><p>다른 지휘관의 덱을 찾아보고 공유하세요.</p></button><button class="tool-card" data-profile><div class="card-top"><span class="tool-icon">${icon('chart')}</span><span class="card-no">03</span></div><h3>내 니케 · 육성 분석</h3><p>니케 육성과 장비, 미미르 스코어를 확인하세요.</p></button><button class="tool-card" data-feature="계산기 · 시뮬레이터"><div class="card-top"><span class="tool-icon">${icon('calc')}</span><span class="card-no">04</span></div><h3>계산기 · 시뮬레이터</h3><p>버프와 오버로드 옵션을 비교해 보세요.</p></button></div></section>
 </main>
 <footer class="site-footer"><div class="footer-top"><a class="brand" href="#" aria-label="MIMIR 홈"><img class="brand-logo" src="/assets/mimir-logo.png" alt="" width="32" height="28"/><strong>MIMIR</strong></a><p>승리의 여신: 니케 비공식 팬 서비스</p><span class="prototype"></span></div><nav class="footer-links" aria-label="서비스 안내"><a href="#/privacy">개인정보처리방침</a><a href="#/terms">이용약관</a><a href="#/contact">문의 및 제보</a></nav><p class="footer-disclaimer">개인이 비영리 목적으로 운영하는 팬 서비스입니다. 게임 관련 자산의 권리는 시프트업·Level Infinite 및 각 권리자에게 있으며, 공식 제휴를 의미하지 않습니다.</p><span class="footer-copyright">© 2026 MIMIR</span></footer>
 <dialog id="modal"><div class="dialog-head"><span class="eyebrow">MIMIR</span><button class="close" aria-label="닫기">×</button></div><div id="modal-content"></div></dialog>`;

mountThemeToggle();
document.querySelectorAll('[data-entertainment]').forEach(button=>button.addEventListener('click',()=>{location.hash='/entertainment';}));
document.querySelectorAll('[data-library]').forEach(b=>b.addEventListener('click',()=>{location.hash='/library';}));

const modal = document.querySelector<HTMLDialogElement>('#modal')!;
const content = document.querySelector<HTMLDivElement>('#modal-content')!;
function show(html: string,raidPicker=false) { modal.classList.toggle('raid-picker',raidPicker);modal.querySelector('.eyebrow')!.textContent=raidPicker?'덱 빌더':'MIMIR';content.innerHTML = html; modal.showModal(); }
document.querySelector('.close')!.addEventListener('click', () => modal.close());
modal.addEventListener('click', e => { if (e.target === modal) { const r=modal.getBoundingClientRect(); const m=e as MouseEvent; if(m.clientX<r.left||m.clientX>r.right||m.clientY<r.top||m.clientY>r.bottom) modal.close(); }});
document.querySelectorAll<HTMLElement>('[data-feature]').forEach(button => button.addEventListener('click', () => show(`<h2>${button.dataset.feature}</h2><p>아직 준비 중인 기능이에요.</p><button class="primary" id="confirm">확인 ${icon('arrow')}</button>`)));
content.addEventListener('click', e => { if ((e.target as HTMLElement).closest('#confirm')) modal.close(); });
document.querySelectorAll('[data-sync],[data-account-open]').forEach(button=>button.addEventListener('click',()=>showAccountDialog()));
document.addEventListener('mimir-sync',()=>showAccountDialog());
function updateAccountHeader(){
 document.querySelector('#dev-account-notice')?.remove();
 if(accountSession.user&&isTestAccount()){const note=document.createElement('div');note.id='dev-account-notice';note.className='dev-account-notice';note.textContent='더미 계정 테스트 중 · 실제 로그인 및 계정 데이터가 아닙니다.';document.querySelector('.header')!.after(note);}
 const button=document.querySelector<HTMLButtonElement>('[data-account-open]')!;button.replaceChildren();button.dataset.signedIn=String(!!accountSession.user);delete button.dataset.authPending;button.disabled=false;
 if(accountSession.user){const ring=document.createElement('span');ring.className='header-avatar';ring.setAttribute('aria-hidden','true');const initial=document.createElement('span');initial.textContent=Array.from(accountSession.user.nickname.trim())[0]?.toUpperCase()??'M';ring.append(initial);button.append(ring);}
 else button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 4h6v16h-6M3 12h12m-5-5 5 5-5 5"/></svg><span>로그인</span>';
 button.title=accountSession.user?accountSession.user.nickname+' · 내 정보':'Google 로그인';button.setAttribute('aria-label',accountSession.user?accountSession.user.nickname+' 내 정보':'로그인');document.querySelector('.prototype')!.textContent=accountSession.user?'미미르 · 로그인됨':'미미르 · 로그인 전';}
function updateHomeAccount(){const root=document.querySelector<HTMLElement>('#home-account-summary');if(!root)return;const p=accountProfile?.profile??accountSession.commanderSummary;root.hidden=!p;if(!p){root.replaceChildren();return;}root.replaceChildren();const heading=document.createElement('strong');heading.textContent=p.nickname+' · '+p.server+' 서버';root.append(heading);const list=document.createElement('dl');for(const [label,value] of [['지휘관 레벨',p.commanderLevel],['보유 니케',p.ownedNikkesCount],['싱크로 레벨',p.synchroLevel]]){const item=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=String(label);dd.textContent=typeof value==='number'?value.toLocaleString('ko-KR')+(label==='보유 니케'?'명':''):'—';item.append(dt,dd);list.append(item);}root.append(list);}
function updateAccount(){
 updateAccountHeader();
 updateHomeAccount();
 if(!usesFirebase&&accountSession.accounts.length&&!accountProfile)void ensureAccountProfile().then(updateHomeAccount);
}
document.addEventListener('mimir-account-auth-changed',updateAccountHeader);
document.addEventListener('mimir-account-profile-changed',updateHomeAccount);
void accountReady.then(updateAccount);
document.addEventListener('mimir-account-changed',()=>{updateAccount();if(location.hash==='#/my-nikke'||location.hash==='#/account'||location.hash==='#/entertainment')void route();});
document.querySelector('[data-account-page]')?.addEventListener('click',()=>{location.hash='/account';});
document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{location.hash='/my-nikke';}));
document.querySelectorAll('[data-builder]').forEach(button=>button.addEventListener('click',()=>{location.hash=builderEntry();}));




const homeMain=document.querySelector<HTMLElement>('main')!;
const raidCard=document.createElement('section');
raidCard.setAttribute('aria-label','레이드 정보');
homeMain.querySelector('.hero-art')!.replaceWith(raidCard);
mountHomeRaids(raidCard);
raidCard.addEventListener('open-raid-library',event=>{
 const raid=raidHistory.find(r=>r.id===(event as CustomEvent<string>).detail);
 if(!raid)return;
 location.hash='/library?raid='+encodeURIComponent(raid.id);
});
let routeVersion=0;
async function route(){
 const version=++routeVersion;
 const match=location.hash.match(/^#\/builder\/(solo|union)(?:\?(.*))?$/);
 const library=/^#\/library(?:\?.*)?$/.test(location.hash);
 const profile=location.hash==='#/my-nikke';
 const accountPage=location.hash==='#/account';
 const tierMaker=location.hash==='#/tier-maker';
 const entertainment=location.hash==='#/entertainment'||tierMaker;
 const legal=location.hash.match(/^#\/(privacy|terms|contact)$/)?.[1];
 document.querySelector('#account-root')?.remove();
 document.querySelector('#legal-root')?.remove();
 document.querySelector('#my-nikke-root')?.remove();
 document.querySelector('#builder-root')?.remove();
 document.querySelector('#library-root')?.remove();
 document.querySelector('#entertainment-root')?.remove();
 document.querySelector('#tier-maker-root')?.remove();
 homeMain.hidden=!!match||library||profile||!!legal||accountPage||entertainment;
 const homeLink=document.querySelector<HTMLAnchorElement>('.header nav a')!;
 homeLink.classList.toggle('active',!match&&!library&&!profile&&!legal&&!accountPage&&!entertainment);
 document.querySelector('.header nav [data-builder]')?.classList.toggle('active-builder',!!match);
 document.querySelector('.header nav [data-profile]')?.classList.toggle('active-profile',profile);
 document.querySelector('.header nav [data-account-page]')?.classList.toggle('active-profile',accountPage);
 document.querySelector('.header nav [data-account-page]')?.setAttribute('aria-current',accountPage?'page':'false');
 document.querySelectorAll<HTMLElement>('.header nav a,.header nav button').forEach(item=>{const active=item.hasAttribute('data-entertainment')?entertainment:item.hasAttribute('data-library')?library:item.hasAttribute('data-account-page')?accountPage:item.hasAttribute('data-profile')?profile:item.hasAttribute('data-builder')?!!match:item.tagName==='A'?!match&&!library&&!profile&&!legal&&!accountPage&&!entertainment:false;item.classList.toggle('nav-current',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});
 if(tierMaker){
  const root=document.createElement('main');root.id='tier-maker-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);document.title='티어 메이커 — MIMIR';
  const {mountTierMaker}=await import('./tier-maker');if(version===routeVersion)await mountTierMaker(root,()=>version===routeVersion);
 }else if(entertainment){
  const root=document.createElement('main');root.id='entertainment-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);document.title='엔터테인먼트! — MIMIR';
  const {mountEntertainment}=await import('./entertainment');if(version===routeVersion)await mountEntertainment(root,()=>version===routeVersion);
 }else if(library){
  const root=document.createElement('main');root.id='library-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);document.title='덱 라이브러리 — MIMIR';
  const {mountDeckLibrary}=await import('./deck-library');if(version===routeVersion)await mountDeckLibrary(root,()=>version===routeVersion);
 }else if(accountPage){
  const root=document.createElement('main');root.id='account-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);
  await accountReady;if(version!==routeVersion)return;
  document.title='내 정보 — MIMIR';
  if(version===routeVersion)mountAccountPage(root);
 }else if(legal){
  const root=document.createElement('main');root.id='legal-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);
  const {mountLegal}=await import('./legal');if(version===routeVersion)mountLegal(root,legal);
 }else if(profile){
  const root=document.createElement('main');root.id='my-nikke-root';root.innerHTML=`<p class="my-loading">${loadingMarkup("계정 정보를 불러오는 중…")}</p>`;homeMain.after(root);
  document.title='내 니케 정보 — MIMIR';
  const {mountMyNikke}=await import('./my-nikke');
  if(version===routeVersion)await mountMyNikke(root,()=>version===routeVersion);
 }else if(match){
  const root=document.createElement('main');root.id='builder-root';root.innerHTML=loadingMarkup('화면을 불러오는 중…');homeMain.after(root);
  document.title='레이드 덱 빌더 — MIMIR';
  const {mountBuilder}=await import('./builder');
  const raidId=new URLSearchParams(match[2]??'').get('raid');
  const raid=raidHistory.find(r=>r.id===raidId&&r.type===match[1])??lastBuilderRaid(match[1] as 'solo'|'union');
  if(raid&&!raidId)history.replaceState(null,'',`#/builder/${raid.type}?raid=${encodeURIComponent(raid.id)}`);
  if(version===routeVersion)await mountBuilder(root,match[1] as 'solo'|'union',()=>version===routeVersion,raid);
 }else{document.title='MIMIR — 니케 덱 빌딩 도우미';}
 if(match||library||profile||accountPage||entertainment||legal||!location.hash)window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>void route());
void route();

