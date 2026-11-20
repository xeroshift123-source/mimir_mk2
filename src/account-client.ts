import {loadingMarkup} from './loading';
import {clearProfileCache,pruneProfileCache,readProfileCache,writeProfileCache,type ProfileSnapshot} from './account-profile-cache';
import type {AccountSession,AccountProfile,AccountUser} from '../shared/account';
export let accountSession:AccountSession={configured:false,user:null,accounts:[]};
export let accountProfile:AccountProfile|null=null;
export let accountError='';
let accountAuthPending=true;
export function isTestAccount(){
 try{return import.meta.env.DEV&&sessionStorage.getItem('mimir-dev-account')==='1';}
 catch{return false;}
}
export const usesFirebase=import.meta.env.VITE_ACCOUNT_BACKEND!=='oci';
export async function api<T>(path:string,body?:unknown):Promise<T>{if(isTestAccount())return (await (await import('./dev-account')).devApi(path,body)) as T;if(usesFirebase)return (await (await import('./firebase-client')).firebaseApi(path,body)) as T;let response:Response;try{response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',signal:AbortSignal.timeout(body===undefined?20000:180000),headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw Error('계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');}let data;try{data=await response.json();}catch{throw Error('계정 서버에 연결하지 못했어요. 서버 실행 상태를 확인해 주세요.');}if(!response.ok)throw Error(data.error??'요청을 처리하지 못했어요.');return data as T;}
function changed(){document.dispatchEvent(new CustomEvent('mimir-account-changed'));}
let sessionRevision=0;
let sessionVerified=false;
let profileCheckedAt=0;
let profileReadVersion=0;
let profileRequest:Promise<AccountProfile|null>|undefined;
let refreshRequest:Promise<void>|undefined;
export const isAccountRefreshing=()=>!!refreshRequest;
export const scoreCalculationPending=(profile:AccountProfile|null|undefined)=>profile?.scoreStatus==='pending'||profile?.scoreStatus==='running';
const selectedAccount=(session:AccountSession)=>session.accounts.find(a=>a.selected)??session.accounts[0];
function authResolved(){
 accountAuthPending=false;
 document.dispatchEvent(new Event('mimir-account-auth-changed'));
}
async function readSession(revision:number,notify:boolean){
 if(revision!==sessionRevision)return;
 try{
  const session=await api<AccountSession>('/session');
  if(revision!==sessionRevision)return;
  if(typeof session.configured!=='boolean'||!Array.isArray(session.accounts))throw Error('계정 서버 응답을 확인할 수 없어요.');
  if(accountSession.user?.id!==session.user?.id||accountProfile?.account.id!==selectedAccount(session)?.id)accountProfile=null;
  accountSession=session;
  sessionVerified=true;
  accountError='';
 }catch(error){
  if(revision!==sessionRevision)return;
  accountError=error instanceof Error?error.message:'계정 정보를 불러오지 못했어요.';
 }
 if(accountAuthPending)authResolved();
 if(notify)changed();
}
export function loadSession(){
 accountProfile=null;
 sessionVerified=false;
 profileRequest=undefined;
 refreshRequest=undefined;
 return accountReady=readSession(++sessionRevision,true);
}
async function observeFirebaseAuth(){
 try{
  const {watchFirebaseAuth}=await import('./firebase-client');
  await new Promise<void>(resolve=>{
   let initial=true;
   watchFirebaseAuth(user=>{
    if(!isTestAccount()&&(accountAuthPending||accountSession.user?.id!==user?.id)){
     const previousUserId=accountSession.user?.id;
     if(previousUserId)void clearProfileCache(previousUserId);
     accountSession={configured:true,user,accounts:[]};
     accountProfile=null;
     accountError='';
     if(!initial)void loadSession();
     authResolved();
     if(!initial)changed();
    }
    initial=false;
    resolve();
   });
  });
 }catch{/* The session request reports Firebase initialization errors. */}
}
const restoreFirebase=usesFirebase&&!isTestAccount();
const restoredAuth=restoreFirebase?observeFirebaseAuth():Promise.resolve();
export let accountReady=restoredAuth.then(()=>readSession(0,false));
if(usesFirebase&&!restoreFirebase)void accountReady.then(observeFirebaseAuth);
export async function waitForAccountAuth(){
 if(!accountAuthPending)return;
 await restoredAuth;
 if(accountAuthPending)await accountReady;
}
function acceptProfile(profile:AccountProfile){
 accountProfile=profile;
 profileCheckedAt=Date.now();
 const uid=accountSession.user?.id;
 if(uid&&usesFirebase&&!isTestAccount()&&!scoreCalculationPending(profile)){
  void writeProfileCache(uid,{profile,checkedAt:profileCheckedAt});
 }
 return profile;
}
export function currentProfileSnapshot():ProfileSnapshot|null{
 return accountProfile?{profile:accountProfile,checkedAt:profileCheckedAt}:null;
}
export async function ensureAccountProfile(){
 await accountReady;
 const account=selectedAccount(accountSession);
 if(!sessionVerified||!account)return null;
 if(refreshRequest)return accountProfile;
 if(accountProfile&&!accountProfile.scoreError&&!accountProfile.comparisonUnavailable)return accountProfile;
 const revision=sessionRevision,version=profileReadVersion;
 const isCurrent=()=>revision===sessionRevision&&version===profileReadVersion;
 return profileRequest??=api<AccountProfile>('/accounts/'+encodeURIComponent(account.id)).then(profile=>{
  if(revision!==sessionRevision)return null;
  if(!isCurrent())return accountProfile;
  accountError='';
  return acceptProfile(profile);
 }).catch(error=>{
  if(isCurrent())accountError=error instanceof Error?error.message:'니케 정보를 불러오지 못했어요.';
  return null;
 }).finally(()=>{if(isCurrent())profileRequest=undefined;});
}
function confirmedCommander(){
 return sessionVerified?selectedAccount(accountSession)?.id??null:undefined;
}
export async function readCommanderCharacters(){
 await accountReady;
 const id=confirmedCommander(),uid=accountSession.user?.id,revision=sessionRevision;
 if(!id||!uid)return [];
 if(accountProfile?.account.id===id)return accountProfile.profile.characters;
 if(!usesFirebase||isTestAccount())return (await ensureAccountProfile())?.profile.characters??[];
 const {firebaseCommanderCharacters}=await import('./firebase-client');
 return revision===sessionRevision?firebaseCommanderCharacters(id):[];
}
export function openAccountProfile(){
 const latest=ensureAccountProfile().then(profile=>profile?{profile,checkedAt:profileCheckedAt}:null);
 const selection=accountReady.then(()=>{
  const commander=confirmedCommander(),uid=accountSession.user?.id;
  if(commander!==undefined&&uid&&usesFirebase&&!isTestAccount())void pruneProfileCache(uid,commander);
  return commander;
 });
 const saved=(async()=>{
  if(!usesFirebase)return null;
  await waitForAccountAuth();
  const uid=accountSession.user?.id,revision=sessionRevision;
  if(!uid||isTestAccount())return null;
  const snapshot=await readProfileCache(uid);
  if(!snapshot||revision!==sessionRevision||accountSession.user?.id!==uid)return null;
  const commander=confirmedCommander();
  if(commander!==undefined&&commander!==snapshot.profile.account.id)return null;
  return snapshot;
 })();
 const initial=Promise.race([
  saved.then(snapshot=>snapshot?{snapshot,cached:true}:latest.then(snapshot=>({snapshot,cached:false}))),
  latest.then(async snapshot=>{
   if(snapshot&&!snapshot.profile.scoreError&&!snapshot.profile.comparisonUnavailable)return {snapshot,cached:false};
   const fallback=await saved;
   return fallback&&(!snapshot||snapshot.profile.account.id===fallback.profile.account.id)
    ?{snapshot:fallback,cached:true}:{snapshot,cached:false};
  }),
 ]);
 return {initial,latest,selection};
}
export async function selectAccount(id:string){await api('/accounts/'+encodeURIComponent(id)+'/select',{});await loadSession();}
export async function readSavedAccount(){
 const account=selectedAccount(accountSession);
 if(!sessionVerified||!account||refreshRequest)return;
 const revision=sessionRevision,version=profileReadVersion;
 const path='/accounts/'+encodeURIComponent(account.id);
 const profile=await api<AccountProfile>(path);
 if(revision!==sessionRevision||version!==profileReadVersion)return;
 acceptProfile(profile);
 accountSession={...accountSession,accounts:accountSession.accounts.map(item=>item.id===account.id?profile.account:item)};
 accountError='';
 changed();
}
export async function refreshAccount(){
 if(refreshRequest)return refreshRequest;
 const account=selectedAccount(accountSession);
 if(!sessionVerified||!account)return;
 const revision=sessionRevision;
 ++profileReadVersion;
 profileRequest=undefined;
 const notify=(snapshot:ProfileSnapshot|null=null)=>document.dispatchEvent(new CustomEvent('mimir-account-profile-changed',{detail:snapshot}));
 const apply=(profile:AccountProfile)=>{
  if(revision!==sessionRevision)return;
  acceptProfile(profile);
  accountSession={...accountSession,accounts:accountSession.accounts.map(item=>item.id===account.id?profile.account:item)};
  accountError='';
  notify(currentProfileSnapshot());
 };
 const refresh=async()=>{
  let latestGrowth:AccountProfile|undefined;
  try{
   const profile=usesFirebase&&!isTestAccount()
    ?await (await import('./firebase-client')).refreshFirebaseProfile(account.id,growth=>{latestGrowth=growth;apply(growth);})
    :await api<AccountProfile>('/accounts/'+encodeURIComponent(account.id)+'/refresh',{});
   if(scoreCalculationPending(profile)){
    // A concurrent sync can still own the current score snapshot.
    profile.scoreError='스코어가 아직 계산 중이에요. 잠시 후 저장된 점수를 확인해 주세요.';
   }else if(profile.scoreStatus==='failed'){
    profile.scoreError='미미르 스코어를 계산하지 못했어요.';
   }
   apply(profile);
  }catch(error){
   if(latestGrowth)apply({...latestGrowth,scoreStatus:'error',scoreError:error instanceof Error?error.message:'스코어를 불러오지 못했어요.'});
   throw error;
  }finally{
   if(revision===sessionRevision){refreshRequest=undefined;notify();}
  }
 };
 refreshRequest=refresh();
 notify();
 return refreshRequest;
}
function clearSession(){
 ++sessionRevision;
 sessionVerified=false;
 profileRequest=undefined;
 refreshRequest=undefined;
 accountReady=Promise.resolve();
 accountSession={configured:usesFirebase||accountSession.configured,user:null,accounts:[]};
 accountProfile=null;
 accountError='';
 changed();
}
async function endSession(path:string,body:unknown){
 const uid=accountSession.user?.id;
 await api(path,body);
 clearSession();
 if(uid)await clearProfileCache(uid);
}
export const deleteAccount=()=>endSession('/account/delete',{confirmation:'탈퇴'});
export const logout=()=>endSession('/logout',{});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function showAccountDialog(){
 if(accountAuthPending)await waitForAccountAuth();
 if(accountSession.user){location.hash='/account';return;}
 if(document.querySelector('dialog.account-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.setAttribute('aria-labelledby','account-dialog-title');
 mountAccountContent(dialog,false);
 document.body.append(dialog);dialog.showModal();
}
export function mountAccountPage(root:HTMLElement){
 root.innerHTML='<div class="account-breadcrumb"><a href="#">커맨드 센터</a><span>/</span>내 정보</div><section class="account-dialog account-page-panel" aria-labelledby="account-dialog-title"></section>';
 mountAccountContent(root.querySelector<HTMLElement>('.account-page-panel')!,true);
}
function mountAccountContent(dialog:HTMLElement,page:boolean){
 const close=()=>{if(!page)(dialog as HTMLDialogElement).close();};
 let catalogRequest:Promise<import('./deck-model').Nikke[]>|undefined;
 const catalog=()=>catalogRequest??=(async()=>{const r=await fetch('/data/nikkes.json');if(!r.ok)throw Error('니케 정보를 불러오지 못했어요.');return await r.json();})().catch(e=>{catalogRequest=undefined;throw e;});
 const updateShowcase=async()=>{const target=dialog.querySelector<HTMLElement>('.account-badge-showcase'),userId=accountSession.user?.id;if(!target||!userId)return;try{const [journey,nikkes]=await Promise.all([import('./commander-journey'),catalog()]);if(target.isConnected&&accountSession.user?.id===userId)await journey.loadBadgeShowcase(target,nikkes);}catch{if(target.isConnected)target.textContent='뱃지를 불러오지 못했어요.';}};
 const controller=new AbortController();document.addEventListener('mimir-badges-changed',event=>{if(dialog.isConnected){void updateShowcase();const detail=(event as CustomEvent).detail;if(detail?.userId===accountSession.user?.id&&detail.message){notice=detail.message;const status=dialog.querySelector<HTMLElement>('.account-status');if(status)status.textContent=notice;}}},{signal:controller.signal});
 document.addEventListener('mimir-account-changed',()=>{if(dialog.isConnected)render();},{signal:controller.signal});
 const observer=new MutationObserver(()=>{if(!dialog.isConnected){controller.abort();observer.disconnect();}});queueMicrotask(()=>{if(dialog.isConnected)observer.observe(document.body,{childList:true,subtree:true});});

 let challenge='',profileUrl='',busy=false,pendingLabel='처리 중…',notice=accountError;const authResult=new URL(location.href).searchParams.get('auth');if(authResult){notice=authResult==='cancelled'?'로그인을 취소했어요.':'로그인하지 못했어요. 다시 시도해 주세요.';const clean=new URL(location.href);clean.searchParams.delete('auth');history.replaceState(null,'',clean);}
 const render=()=>{const addOpen=dialog.querySelector<HTMLDetailsElement>('.account-add-link')?.open??false;const session=accountSession;dialog.innerHTML=`<header><div><small>MIMIR / ACCOUNT</small><h2 id="account-dialog-title">${page||session.user?'내 정보':'로그인'}</h2></div>${page?'':'<button data-account="close" aria-label="계정 창 닫기">×</button>'}</header>${!session.user?`<p>Google 계정으로 로그인하고<br>BLABLALINK의 니케 육성 정보를 연결하세요.</p>${usesFirebase?`<button class="account-google" data-account="google-login" ${!session.configured||busy?'disabled':''}>Google로 계속하기</button>`:`<a class="account-google" ${session.configured?'href="/api/auth/google"':'aria-disabled="true"'}>Google로 계속하기</a>`}${import.meta.env.DEV?'<button class="account-google account-dev-login" data-account="dev-login">더미 계정으로 테스트</button>':''}${!session.configured?'<p class="account-hint">Google 로그인 설정을 확인한 뒤 다시 시도해 주세요.</p>':''}`:`${isTestAccount()?'<p class="account-test-notice">로컬 더미 계정 · 모든 육성 정보와 획득 기록은 테스트 데이터입니다.</p>':''}<div class="account-user"><div class="account-google-identity"><span class="account-profile-photo"><span aria-hidden="true">${esc(Array.from(session.user.nickname.trim())[0]??'M')}</span>${session.user.picture?`<img src="${esc(session.user.picture)}" alt="Google 프로필 사진" referrerpolicy="no-referrer"/>`:''}</span><div><strong>${esc(session.user.nickname)}</strong><span class="account-email">${esc(session.user.email??'이메일 정보 없음')}</span></div></div><button data-account="logout" ${busy?'disabled':''}>로그아웃</button></div><section class="account-badges-section"><div class="account-section-heading"><h3>나의 뱃지</h3><button data-account="badges" ${busy?'disabled':''}>뱃지 관리</button></div><div class="account-badge-showcase" aria-label="전시 중인 뱃지">${loadingMarkup("불러오는 중…")}</div></section><section class="linked-commanders"><div class="linked-commanders-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/></svg><h3>BLABLALINK 연동</h3></div><p>계정을 선택하면 내 니케 정보에 해당 지휘관이 표시됩니다.</p><div class="account-list">${session.accounts.map(a=>`<div class="linked-commander-row"><button class="linked-commander-card ${a.selected?'is-selected':''}" data-select-account="${esc(a.id)}" aria-pressed="${a.selected}" aria-label="${esc(a.nickname)} · ${esc(a.server)} 서버${a.selected?' · 선택된 지휘관':' 선택'}" ${busy||a.selected?'disabled':''}><span class="linked-server-symbol" aria-hidden="true">${a.server.includes('한국')?'<img src="/assets/icons/servers/kr.svg" alt=""/>':a.server.includes('일본')?'<img src="/assets/icons/servers/jp.svg" alt=""/>':a.server.includes('동남아')?'🌏':'🌐'}</span><span class="linked-commander-info"><span class="linked-commander-name"><strong>${esc(a.nickname)}</strong>${a.selected?'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12 3 3 6-6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</span><span class="linked-server-chip">${esc(a.server)} 서버</span></span></button>${usesFirebase&&!isTestAccount()?`<button type="button" class="linked-commander-unlink" data-unlink-account="${esc(a.id)}" aria-label="${esc(a.nickname)} 연동 해제" ${busy?'disabled':''}>연동 해제</button>`:''}</div>`).join('')||'<p>연동된 지휘관이 없습니다. BLABLALINK 계정을 추가해 주세요.</p>'}</div><details class="account-link account-add-link"><summary><span aria-hidden="true">＋</span> 계정 추가</summary><p>1. ${usesFirebase?"‘미미르만만세’를":"확인 코드를 발급하고"} BLABLALINK 소개글에 추가해 주세요.<br>2. 내 BLABLALINK 프로필 주소를 입력해 연결하세요.</p><button class="account-challenge" data-account="challenge" ${busy?'disabled':''}>${challenge?'확인 코드 새로 발급':'확인 코드 발급'}</button>${challenge?`<div class="account-proof"><code>${esc(challenge)}</code><button data-account="copy">복사</button></div><p class="account-hint">${usesFirebase?"기존 미미르와 같은 확인 문구입니다.":"10분 동안 유효해요."} 기존 소개글에 덧붙이면 됩니다.</p><form id="account-link-form"><label for="account-profile-url">BLABLALINK 프로필 URL</label><input id="account-profile-url" name="url" value="${esc(profileUrl)}" type="url" required maxlength="1024" placeholder="https://www.blablalink.com/user?openid=…" autocomplete="off"/><button class="account-submit" type="submit" ${busy?'disabled':''}>${busy?loadingMarkup('연결하는 중…'):'계정 동기화'}</button></form>`:''}</details></section><section class="account-withdraw"><details><summary>미미르 탈퇴</summary><p>미미르 계정과 연결된 니케 계정 정보, 저장 스코어, 획득·전시 뱃지 및 로그인 기록을 삭제합니다. 삭제 후 복구할 수 없습니다.</p><p>Google 계정과 게임 계정은 삭제되지 않습니다.</p><form id="account-delete-form"><label for="account-delete-confirm">탈퇴하려면 <strong>탈퇴</strong>를 입력해 주세요.</label><div class="account-withdraw-controls"><input id="account-delete-confirm" name="confirmation" autocomplete="off" placeholder="탈퇴" required/><button data-account="delete" type="submit" disabled>미미르 탈퇴</button></div></form></details></section>`}<p class="account-status" role="status">${esc(notice)}</p>`;const add=dialog.querySelector<HTMLDetailsElement>('.account-add-link');if(add)add.open=addOpen;dialog.querySelectorAll<HTMLImageElement>('.account-profile-photo img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));paintBusy();void updateShowcase();};
 function paintBusy(){
  dialog.setAttribute('aria-busy',String(busy));if(!busy)return;
  dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{if(b.dataset.account!=='close')b.disabled=true;});
  const spinner='<span class="loading-spinner" aria-hidden="true"></span>';
  const status=dialog.querySelector<HTMLElement>('.account-status');if(status){status.classList.add('is-loading');status.innerHTML=spinner+'<span>'+esc(pendingLabel)+'</span>';}
  if(pendingLabel==='로그인 중…'){
   const login=dialog.querySelector<HTMLButtonElement>('[data-account="google-login"]');
   if(login){login.setAttribute('aria-busy','true');login.innerHTML=spinner+'<span>로그인 중…</span>';}
  }
 }
 const run=async(work:()=>Promise<void>,label='처리 중…')=>{if(busy)return;busy=true;pendingLabel=label;paintBusy();try{await work();}catch(e){notice=e instanceof Error?e.message:'요청을 처리하지 못했어요.';}finally{busy=false;if(dialog.isConnected)render();}};
 dialog.addEventListener('click',async e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;switch(b.dataset.account){case 'close':close();return;case 'badges':{
  if(!accountSession.user)return;
  const feature=b.dataset.account,userId=accountSession.user.id;
  await run(async()=>{
   const [journey,response]=await Promise.all([import('./commander-journey'),fetch('/data/nikkes.json')]);
   if(!response.ok)throw Error('니케 정보를 불러오지 못했어요. 다시 시도해 주세요.');
   const catalog:import('./deck-model').Nikke[]=await response.json();
   if(!dialog.isConnected||accountSession.user?.id!==userId)return;
   if(feature==='badges')await journey.showBadges(catalog);

  });return;
 }case 'google-login':await run(async()=>{await (await import('./firebase-client')).firebaseLogin();await loadSession();if(accountSession.user){if(!page)close();location.hash='/account';}},'로그인 중…');return;case 'dev-login':if(import.meta.env.DEV)await run(async()=>{sessionStorage.setItem('mimir-dev-account','1');await loadSession();notice='더미 계정으로 테스트 중이에요.';if(!page&&accountSession.user){close();location.hash='/account';}});return;case 'logout':await run(async()=>{await logout();notice='로그아웃했어요.';});return;case 'challenge':await run(async()=>{const result=await api<{code:string}>('/accounts/challenge',{});challenge=result.code;notice='코드를 소개글에 추가한 뒤 계정을 연결해 주세요.';});return;case 'copy':try{await navigator.clipboard.writeText(challenge);notice='확인 코드를 복사했어요.';}catch{notice='코드를 직접 선택해서 복사해 주세요.';}render();return;}const unlinkId=b.dataset.unlinkAccount;
  if(unlinkId){
   if(busy||!window.confirm('연동해제 하겠습니까?'))return;
   await run(async()=>{
    const uid=accountSession.user?.id;
    await api('/accounts/'+encodeURIComponent(unlinkId)+'/unlink',{});
    if(uid)void clearProfileCache(uid);
    await loadSession();
    notice=accountError||'연동을 해제했어요.';
   },'연동 해제 중…');
   return;
  }
  if(b.dataset.selectAccount)await run(async()=>{await selectAccount(b.dataset.selectAccount!);if(!page){close();location.hash='/my-nikke';}});});
 dialog.addEventListener('input',e=>{if((e.target as HTMLInputElement).id==='account-delete-confirm'){const button=dialog.querySelector<HTMLButtonElement>('[data-account=delete]');if(button)button.disabled=busy||(e.target as HTMLInputElement).value!=='탈퇴';}if((e.target as HTMLInputElement).id==='account-profile-url')profileUrl=(e.target as HTMLInputElement).value;});
 dialog.addEventListener('submit',e=>{if((e.target as HTMLFormElement).id==='account-delete-form'){e.preventDefault();if(busy||dialog.querySelector<HTMLInputElement>('#account-delete-confirm')?.value!=='탈퇴')return;void run(async()=>{await deleteAccount();if(!page)close();location.hash='/account';});return;}if((e.target as HTMLFormElement).id!=='account-link-form')return;e.preventDefault();const url=dialog.querySelector<HTMLInputElement>('#account-profile-url')!.value;void run(async()=>{await api('/accounts/link',{url});await loadSession();if(!page){close();location.hash='/my-nikke';}});});
 if(!page)dialog.addEventListener('close',()=>dialog.remove(),{once:true});render();
}
