import npcCatalog from './data/worldcup-npcs.json';
import {loadingMarkup} from './loading';
import {mountWorldcupResult} from './worldcup-result';
import type {Nikke} from './deck-model';
import {startWorldcup,chooseNikke,validWorldcup,worldcupParticipants} from './nikke-worldcup-model';
import type {WorldcupState,WorldcupEntrant} from './nikke-worldcup-model';
import './nikke-worldcup.css';
const storageKey='mimir-nikke-worldcup-v1';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function showNikkeWorldcup(isCurrent:()=>boolean){
 if(!isCurrent()||document.querySelector('.worldcup-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='worldcup-dialog';dialog.setAttribute('aria-labelledby','worldcup-title');
 dialog.innerHTML=`<header class="worldcup-header"><div><h2 id="worldcup-title">니케 이상형 월드컵</h2><p>나의 정실은?</p></div><button type="button" data-close aria-label="월드컵 닫기">×</button></header><div class="worldcup-body"><p role="status">${loadingMarkup("니케를 불러오는 중…")}</p></div>`;
 let disposeResult:(()=>void)|undefined;
 const body=dialog.querySelector<HTMLElement>('.worldcup-body')!;const close=()=>dialog.close();const pageChanged=()=>close();window.addEventListener('hashchange',pageChanged);
 dialog.querySelector('[data-close]')!.addEventListener('click',close);dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',pageChanged);disposeResult?.();dialog.remove();},{once:true});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect(),m=e as MouseEvent;if(m.clientX<r.left||m.clientX>r.right||m.clientY<r.top||m.clientY>r.bottom)close();}});
 document.body.append(dialog);dialog.showModal();
 let nikkeCatalog:Nikke[]=[];let catalog:WorldcupEntrant[]=[],state:WorldcupState|null=null,playing=false,notice='',confirmRestart=false;const undo:WorldcupState[]=[];const scope={includeMassProduced:false,includeCollaboration:false,includeNpc:false};
 try{const response=await fetch('/data/nikkes.json');if(!response.ok)throw Error();nikkeCatalog=await response.json();catalog=[...nikkeCatalog,...npcCatalog];if(!dialog.isConnected||!isCurrent())return;}catch{if(dialog.isConnected)body.innerHTML='<p role="alert">니케 목록을 불러오지 못했어요.</p><button class="primary" data-retry>다시 시도</button>';body.querySelector('[data-retry]')?.addEventListener('click',()=>{close();void showNikkeWorldcup(isCurrent);});return;}
 const byId=new Map(catalog.map(n=>[n.id,n]));catalog=[...byId.values()];
 try{const saved:unknown=JSON.parse(localStorage.getItem(storageKey)??'null');if(validWorldcup(saved,new Set(byId.keys())))state=saved;}catch{}
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));notice='';}catch{notice='진행 상황을 저장하지 못했어요. 이 창을 닫지 말고 계속 진행해 주세요.';}};
 const participants=()=>worldcupParticipants(catalog,scope);
 const scopeMarkup=()=>`<fieldset class="worldcup-scope"><legend>참가 니케</legend><label><input type="checkbox" data-scope="includeMassProduced" ${scope.includeMassProduced?'checked':''}/>양산형 포함하기</label><label><input type="checkbox" data-scope="includeCollaboration" ${scope.includeCollaboration?'checked':''}/>콜라보 포함하기</label><label><input type="checkbox" data-scope="includeNpc" ${scope.includeNpc?'checked':''}/>NPC 포함하기</label><p>새 월드컵 참가 <strong data-participant-count>${participants().length}</strong>명</p></fieldset>`;
 body.addEventListener('change',event=>{const input=event.target as HTMLInputElement;const key=input.dataset.scope;if(key!=='includeMassProduced'&&key!=='includeCollaboration'&&key!=='includeNpc')return;scope[key]=input.checked;const count=body.querySelector('[data-participant-count]');if(count)count.textContent=String(participants().length);body.querySelectorAll<HTMLButtonElement>('[data-new]').forEach(b=>b.disabled=participants().length<2);});
 function portrait(id:string){const n=byId.get(id)!;return `<img ${n.isNpc?'class="worldcup-npc-portrait"':''} src="/${esc(n.imageUrl)}" alt="" decoding="async" draggable="false"/><strong>${esc(n.name)}</strong>`;}
 function render(){
 if(!dialog.isConnected)return;
 disposeResult?.();disposeResult=undefined;
 dialog.classList.toggle('worldcup-setup',!playing||confirmRestart);
 if(confirmRestart){body.innerHTML=`<div class="worldcup-intro"><h3>처음부터 다시 할까요?</h3><p>지금까지의 선택이 새 대진으로 바뀝니다.</p>${scopeMarkup()}<div class="worldcup-actions"><button class="primary" data-new>새로 시작</button><button data-cancel>계속하기</button></div></div>`;return;}
 if(!playing){body.innerHTML=`<div class="worldcup-intro"><span class="worldcup-heart" aria-hidden="true">♡</span><h3>나의 정실은?</h3><p>마지막까지 함께할 한 명을 골라보세요.</p>${scopeMarkup()}<small>매 대결에서 한 명 선택 · 홀수 라운드는 한 명 부전승</small><div class="worldcup-actions">${state?`<button class="primary" data-resume>${state.pool.length===1?'결과 보기':'이어서 하기'}</button><button data-restart>새로 시작</button>`:'<button class="primary" data-new>월드컵 시작</button>'}</div>${state?`<p class="worldcup-saved">${state.picks} / ${state.total-1}번 선택 · 이 브라우저에 저장됨<br>이어서 하기는 기존 참가 범위를 유지합니다.</p>`:''}</div>`;return;}
 if(!state)return;
 if(state.pool.length===1){disposeResult=mountWorldcupResult(body,byId.get(state.pool[0])!,structuredClone(state),nikkeCatalog);}else{
 const pair=state.pool.slice(state.index,state.index+2),matches=Math.floor(state.pool.length/2),match=state.index/2+1;
 const round=state.pool.length===2?'결승':state.pool.length===4?'준결승':state.pool.length+'강';
 body.innerHTML=`<div class="worldcup-progress"><div><strong>${round}</strong><span>${match} / ${matches} 대결${state.pool.length%2?' · 1명 부전승':''}</span></div><progress max="${state.total-1}" value="${state.picks}" aria-label="전체 진행률"></progress><small>${state.picks} / ${state.total-1}번 선택</small></div><div class="worldcup-match" role="group" aria-label="${round} ${match}번째 대결">${pair.map((id,i)=>`${i===1?'<span class="worldcup-vs" aria-hidden="true">VS</span>':''}<button type="button" class="worldcup-choice" data-choice="${esc(id)}" aria-label="${esc(byId.get(id)!.name)} 선택">${portrait(id)}</button>`).join('')}</div><div class="worldcup-footer"><button data-undo ${undo.length?'':'disabled'}>이전 선택</button><span>더 마음에 드는 니케를 선택하세요.</span><button data-restart>처음부터</button></div>`;
 }
 if(notice){const p=document.createElement('p');p.className='worldcup-notice';p.setAttribute('role','status');p.textContent=notice;body.append(p);}
 body.querySelectorAll<HTMLImageElement>('img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
 // Preload only the next pair; avoid downloading the entire catalog at launch.
 if(state.pool.length>1)state.pool.slice(state.index+2,state.index+4).forEach(id=>{const img=new Image();img.src='/'+byId.get(id)!.imageUrl;});
 }
 body.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
 if(button.hasAttribute('data-restart')){confirmRestart=true;render();return;}if(button.hasAttribute('data-cancel')){confirmRestart=false;render();return;}
 if(button.hasAttribute('data-new')){const selected=participants();if(selected.length<2)return;state=startWorldcup(selected.map(n=>n.id));undo.length=0;playing=true;confirmRestart=false;save();render();return;}
 if(button.hasAttribute('data-resume')){playing=true;render();return;}
 if(button.hasAttribute('data-close-result')){close();return;}
 if(button.hasAttribute('data-undo')&&undo.length){state=undo.pop()!;save();render();return;}
 if(button.dataset.choice&&state&&state.pool.length>1){if(!state.pool.slice(state.index,state.index+2).includes(button.dataset.choice))return;undo.push(structuredClone(state));if(undo.length>50)undo.shift();state=chooseNikke(state,button.dataset.choice);save();render();body.querySelector<HTMLButtonElement>('[data-choice]')?.focus({preventScroll:true});}
 });render();
}
