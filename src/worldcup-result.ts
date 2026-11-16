import {loadingMarkup} from './loading';
import type {Nikke} from './deck-model';
import type {WorldcupState,WorldcupEntrant} from './nikke-worldcup-model';
import {worldcupResultImage} from './worldcup-result-image';
import {api,accountSession,isTestAccount,showAccountDialog} from './account-client';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountWorldcupResult(body:HTMLElement,nikke:WorldcupEntrant,state:WorldcupState,catalog:Nikke[]){
 const controller=new AbortController();let url='',imageRequest:Promise<Blob>|null=null,busy=false,awarding=false,awardedUser='';
 const active=()=>!controller.signal.aborted&&body.isConnected;
 const getImage=()=>imageRequest??=worldcupResultImage(nikke,state.total).catch(error=>{imageRequest=null;throw error;});
 body.innerHTML=`<section class="worldcup-result" aria-label="월드컵 우승 결과"><div class="worldcup-result-heading"><span>선택 완료</span><h3>나의 단 한 명</h3><p>${state.total}명 중 마지막까지 남은 ${esc(nikke.name)}</p></div><div class="worldcup-result-card"><img class="worldcup-share-preview" alt="나의 정실 · ${esc(nikke.name)} 공유 카드" hidden/><div class="worldcup-winner"><img ${nikke.isNpc?'class="worldcup-npc-portrait"':''} src="/${esc(nikke.imageUrl)}" alt=""/><strong>${esc(nikke.name)}</strong></div></div><div class="worldcup-share-actions"><button class="primary" data-result-save>이미지 저장</button><button data-result-copy>이미지 복사</button>${typeof navigator.share==='function'?'<button data-result-share>공유</button>':''}</div><p class="worldcup-export-status" role="status"></p><div class="worldcup-badge-award" ${nikke.isNpc?'style="display:none"':''}><span class="worldcup-badge-mini"><img src="/${esc(nikke.imageUrl)}" alt=""/></span><div><strong>최애의 아이</strong><span>내 아내임.</span><small class="worldcup-badge-status" role="status"></small></div><button data-result-badge>${accountSession.user?'뱃지 확인':'로그인'}</button></div><div class="worldcup-actions"><button data-restart>다시 하기</button><button data-close-result>닫기</button></div></section>`;
 const status=body.querySelector<HTMLElement>('.worldcup-export-status')!,badgeStatus=body.querySelector<HTMLElement>('.worldcup-badge-status')!;
 void getImage().then(blob=>{if(!active())return;url=URL.createObjectURL(blob);const preview=body.querySelector<HTMLImageElement>('.worldcup-share-preview')!;preview.src=url;preview.hidden=false;body.querySelector<HTMLElement>('.worldcup-winner')!.hidden=true;}).catch(error=>{if(active())status.textContent=error.message;});
 async function award(){
  if(nikke.isNpc){badgeStatus.textContent='NPC 우승 결과는 이미지로 저장할 수 있어요.';const button=body.querySelector<HTMLButtonElement>('[data-result-badge]');if(button)button.hidden=true;return;}
  const user=accountSession.user;if(!user){badgeStatus.textContent='로그인하면 최애의 아이 뱃지를 받을 수 있어요.';return;}
  if(awardedUser===user.id||awarding)return;awarding=true;badgeStatus.innerHTML=loadingMarkup("뱃지를 저장하는 중…");
  try{await api('/worldcup/badge',state);if(!active()||accountSession.user?.id!==user.id)return;awardedUser=user.id;document.dispatchEvent(new CustomEvent('mimir-badges-changed'));badgeStatus.textContent=(isTestAccount()?'테스트 뱃지 · ':'')+'최애의 아이 획득 · 계정당 하나만 유지됩니다.';}catch(error){if(active())badgeStatus.textContent=(error as Error).message;}finally{awarding=false;}
 }
 void award();
 body.addEventListener('click',async e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
  if(button.hasAttribute('data-result-badge')){if(!accountSession.user){showAccountDialog();return;}await award();if(active()&&awardedUser===accountSession.user?.id){const {showBadges}=await import('./commander-journey');if(active())await showBadges(catalog);}return;}
  if(!button.hasAttribute('data-result-save')&&!button.hasAttribute('data-result-copy')&&!button.hasAttribute('data-result-share'))return;if(busy)return;busy=true;
  const controls=body.querySelectorAll<HTMLButtonElement>('.worldcup-share-actions button');controls.forEach(b=>b.disabled=true);status.innerHTML=loadingMarkup("이미지를 준비하는 중…");
  try{const result=getImage();if(button.hasAttribute('data-result-copy')){if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('이미지 복사를 지원하지 않아요. 이미지 저장을 이용해 주세요.');await navigator.clipboard.write([new ClipboardItem({'image/png':result})]);if(active())status.textContent='이미지를 복사했어요. 원하는 곳에 붙여넣으세요.';}else{const blob=await result;if(!active())return;if(button.hasAttribute('data-result-share')){const file=new File([blob],'MIMIR-나의-정실.png',{type:'image/png'});if(!navigator.canShare?.({files:[file]}))throw Error('이미지 공유를 지원하지 않아요. 이미지 저장이나 복사를 이용해 주세요.');await navigator.share({files:[file],title:'나의 정실은?'});if(active())status.textContent='공유 창을 열었어요.';}else{const downloadUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=downloadUrl;link.download='MIMIR-나의-정실.png';link.click();setTimeout(()=>URL.revokeObjectURL(downloadUrl),10000);status.textContent='이미지를 저장했어요.';}}}catch(error){if(active())status.textContent=error instanceof Error&&error.name==='AbortError'?'공유를 취소했어요.':(error as Error).message;}finally{busy=false;if(active())controls.forEach(b=>b.disabled=false);}
 },{signal:controller.signal});
 return ()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
}
