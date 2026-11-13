export type Mode = 'solo' | 'union';
export interface Nikke { id: string; name: string; imageUrl: string; burst: string; element: string; weaponType: string; company: string; ability: string[]; coolTime: number; rank: string; type: string; blablaNameCode?: number; isTemporary?: boolean }
export interface Deck { type: Mode; squads: (string | null)[][]; names: string[]; elements: string[]; weakness: string; candidates: string[]; hasCandidate?: boolean }
export const elements: Record<string,string> = {Electric:'전격',Iron:'철갑',Fire:'작열',Water:'수냉',Wind:'풍압'};
export function emptyDeck(type: Mode): Deck { const count=type==='solo'?5:3; return {type,squads:Array.from({length:count},()=>Array(5).fill(null)),names:Array.from({length:count},(_,i)=>`스쿼드 ${i+1}`),elements:Array(count).fill('전격'),weakness:'Water',candidates:[],hasCandidate:false}; }
export function encodeDeck(deck: Deck, nikkes: Nikke[]): string {
 const byId=new Map(nikkes.map(n=>[n.id,n]));
 const squads=deck.squads.map(row=>row.map(id=>{ if(!id) return null; const n=byId.get(id); if(!n?.blablaNameCode) throw Error('외부 코드가 없는 니케는 덱 코드로 내보낼 수 없어요.'); return n.blablaNameCode; }));
 return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({type:deck.type,squads,...(deck.type==='union'?{elements:deck.elements}:{})})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeDeck(code: string, nikkes: Nikke[]): Deck {
 if(code.length>20000) throw Error('덱 코드가 너무 길어요.');
 let raw: unknown;
 try { const clean=code.trim().replace(/-/g,'+').replace(/_/g,'/'); raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(clean),c=>c.charCodeAt(0)))); } catch {throw Error('올바른 미미르 덱 코드를 입력해 주세요.');}
 const object=Array.isArray(raw)?{type:'solo',squads:raw}:raw;
 if(!object || typeof object!=='object' || !('squads' in object)) throw Error('스쿼드 정보가 없는 코드예요.');
 const data=object as {type?: unknown;squads:unknown;elements?:unknown};
 if(data.type!==undefined && data.type!=='solo' && data.type!=='union') throw Error('지원하지 않는 덱 유형이에요.');
 const deck=emptyDeck(data.type==='union'?'union':'solo');
 if(!Array.isArray(data.squads)||data.squads.length!==deck.squads.length) throw Error(`이 덱은 ${deck.squads.length}개 스쿼드가 필요해요.`);
 const byId=new Map(nikkes.map(n=>[n.id,n.id])); const byCode=new Map(nikkes.filter(n=>n.blablaNameCode).map(n=>[String(n.blablaNameCode),n.id])); const used=new Set<string>();
 deck.squads=data.squads.map(row=>{if(!Array.isArray(row)||row.length!==5) throw Error('스쿼드는 5개 슬롯이어야 해요.'); return row.map(value=>{if(value===null)return null; if(typeof value!=='string'&&typeof value!=='number')throw Error('잘못된 니케 식별자예요.'); const id=byId.get(String(value))??byCode.get(String(value)); if(!id)throw Error(`현재 데이터에서 찾을 수 없는 니케예요: ${String(value).slice(0,50)}`); if(used.has(id))throw Error('같은 니케가 중복 배치된 코드예요.'); used.add(id); return id;});});
 if(deck.type==='union' && data.elements!==undefined){if(!Array.isArray(data.elements)||data.elements.length!==3||data.elements.some(e=>!Object.values(elements).includes(e)))throw Error('유니온 스쿼드 속성 정보가 올바르지 않아요.'); deck.elements=data.elements;}
 return deck;
}
/** Candidate slots follow the regular squads and compact after every change. */
export function deckSlot(deck:Deck,[s,i]:[number,number]):string|null{return s===deck.squads.length?deck.candidates[i]??null:deck.squads[s]?.[i]??null;}
function setDeckSlot(deck:Deck,[s,i]:[number,number],id:string|null){if(s===deck.squads.length){const slots:(string|null)[]=deck.candidates;slots[i]=id;}else deck.squads[s][i]=id;}
export function compactCandidates(deck:Deck){deck.candidates=deck.candidates.filter((id):id is string=>!!id).slice(0,10);}
export function placeDeckNikke(deck:Deck,id:string,to:[number,number]){
 if(to[0]===deck.squads.length&&(!deck.hasCandidate||to[1]>Math.min(deck.candidates.length,9)))return;
 deck.squads.forEach(row=>row.forEach((value,i)=>{if(value===id)row[i]=null;}));
 const candidateSlots:(string|null)[]=deck.candidates;candidateSlots.forEach((value,i)=>{if(value===id)candidateSlots[i]=null;});
 setDeckSlot(deck,to,id);compactCandidates(deck);
}
export function moveSlot(deck:Deck,from:[number,number],to:[number,number]){const id=deckSlot(deck,from);if(!id)return;const other=deckSlot(deck,to);setDeckSlot(deck,from,other);setDeckSlot(deck,to,id);compactCandidates(deck);}
export function matchesNikke(n: Nikke, query: string, filters: Record<string,Set<string>>) {
 const text=`${n.name} ${n.id} ${n.ability.join(' ')}`.normalize('NFKC').toLowerCase().replace(/\s/g,'');
 if(!text.includes(query.normalize('NFKC').toLowerCase().replace(/\s/g,'')))return false;
 return Object.entries(filters).every(([key,values])=>{if(!values.size)return true; if(key==='element'){const available=[n.element,...(n.id==='rapi_red_hood'?['Iron']:[]),...(n.id==='sugar'?['Water']:[])];return available.some(e=>values.has(e));}return values.has(String(n[key as keyof Nikke]));});
}

