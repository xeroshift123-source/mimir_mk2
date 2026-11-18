import {loadingMarkup} from './loading';
import {accountReady,accountError,accountSession,accountProfile,ensureAccountProfile,isTestAccount,showAccountDialog} from './account-client';
export async function mountEntertainment(root:HTMLElement,isCurrent:()=>boolean){
 if(!isCurrent())return;
 root.innerHTML='<div class="builder-breadcrumb"><a href="#">커맨드 센터</a><span>/</span>엔터테인먼트!</div><div class="builder-heading"><div><h1>엔터테인먼트!</h1><p>잠깐 쉬어가는 미미르 놀이터.</p></div></div><section class="entertainment-grid" aria-label="놀거리"><button type="button" class="entertainment-recap" data-open-recap aria-label="나의 리캡 열기"><span class="entertainment-recap-heading"><strong>나의 리캡</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/><path d="M12 7v5l3 2"/></svg></span><span class="entertainment-recap-description">내 니케의 육성 기록을 돌아보세요.</span><span class="entertainment-status" role="status"></span></button><button type="button" class="entertainment-recap" data-open-worldcup aria-label="니케 이상형 월드컵 열기"><span class="entertainment-recap-heading"><strong>니케 이상형 월드컵</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20S3 14 3 8.5a4.5 4.5 0 0 1 9-1 4.5 4.5 0 0 1 9 1C21 14 12 20 12 20Z"/></svg></span><span class="entertainment-recap-description">나의 정실은?</span><span class="entertainment-status worldcup-launch-status" role="status"></span></button><button type="button" class="entertainment-recap" data-open-all-black aria-label="올블랙 챌린지"><span class="entertainment-recap-heading"><strong>올블랙 챌린지</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor"/></svg></span><span class="entertainment-recap-description">당신의 실력을 측정하세요</span><span class="entertainment-status all-black-status" role="status"></span></button><button type="button" class="entertainment-recap" data-open-tier-maker aria-label="티어 메이커"><span class="entertainment-recap-heading"><strong>티어 메이커</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M13 6h4M13 12h2M13 18h5"/></svg></span><span class="entertainment-recap-description">니케를 나만의 기준으로.</span><span class="entertainment-status tier-maker-status" role="status"></span></button></section>';
 root.querySelector<HTMLButtonElement>('[data-open-tier-maker]')!.addEventListener('click',()=>{location.hash='/tier-maker';});
 const blackButton=root.querySelector<HTMLButtonElement>('[data-open-all-black]')!;
 blackButton.addEventListener('click',async()=>{blackButton.disabled=true;const status=root.querySelector<HTMLElement>('.all-black-status')!;status.innerHTML=loadingMarkup('준비 중…');try{const [sim,model,response]=await Promise.all([import('./overload-simulator'),import('./all-black-model'),fetch('/data/nikkes.json')]);if(!response.ok)throw Error('니케 정보를 불러오지 못했어요.');const catalog=await response.json() as import('./deck-model').Nikke[];const neon=catalog.find(n=>n.id==='neon_vision_eye');if(!neon)throw Error('네온 : 비전아이 정보를 찾을 수 없어요.');if(isCurrent())sim.showSimulator(model.neonChallengeGrowth(neon),isCurrent,true);}catch(error){if(isCurrent())status.textContent=(error as Error).message;}finally{if(isCurrent()){blackButton.disabled=false;if(status.querySelector('.loading-message'))status.textContent='';}}});
 const worldcupButton=root.querySelector<HTMLButtonElement>('[data-open-worldcup]')!;
 worldcupButton.addEventListener('click',async()=>{worldcupButton.disabled=true;worldcupButton.dataset.loading='true';try{const {showNikkeWorldcup}=await import('./nikke-worldcup');if(isCurrent())await showNikkeWorldcup(isCurrent);}catch{if(isCurrent())root.querySelector('.worldcup-launch-status')!.textContent='월드컵을 열지 못했어요. 다시 시도해 주세요.';}finally{if(isCurrent()){worldcupButton.disabled=false;delete worldcupButton.dataset.loading;}}});
 const button=root.querySelector<HTMLButtonElement>('[data-open-recap]')!,status=root.querySelector<HTMLElement>('[role=status]')!;
 button.addEventListener('click',async()=>{
  button.disabled=true;status.innerHTML=loadingMarkup("리캡을 준비하는 중…");
  try{
   await accountReady;if(!isCurrent())return;
   const userId=accountSession.user?.id;
   const profile=await ensureAccountProfile();
   if(!isCurrent()||accountSession.user?.id!==userId)return;
   if(!userId||!profile){
    if(accountError)throw Error(accountError);
    status.textContent='';
    void showAccountDialog();return;
   }
   const [journey,mapping,response]=await Promise.all([import('./commander-journey'),import('./account-profile'),fetch('/data/nikkes.json')]);if(!response.ok)throw Error('니케 정보를 불러오지 못했어요. 다시 시도해 주세요.');const catalog=await response.json();if(!isCurrent()||accountSession.user?.id!==userId||accountProfile?.account.id!==profile.account.id)return;const {roster,skipped}=mapping.profileGrowth(profile,catalog);journey.showRecap(roster,profile.account.id,profile.profile.nickname,isTestAccount(),skipped,{profile:profile.profile,elementScores:profile.elementScores});status.textContent='';
  }catch(error){if(isCurrent())status.textContent=(error as Error).message;}finally{if(isCurrent())button.disabled=false;}
 });
 void accountReady.then(()=>{
  if(!isCurrent()||button.disabled)return;
  if(!accountSession.user)status.textContent='로그인하고 니케 계정을 연결해 주세요.';
  else if(!accountSession.accounts.length)status.textContent=accountError||'니케 계정을 연결하면 리캡을 볼 수 있어요.';
 });
}
