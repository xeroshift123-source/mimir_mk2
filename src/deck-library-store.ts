import type {Deck} from './deck-model';
export interface LibraryDeck {id:string;title:string;deck:Deck;createdAt:number}
const key='mimir-mk2-deck-library';
export function readLibraryDecks():LibraryDeck[]{const raw=JSON.parse(localStorage.getItem(key)??'[]');if(!Array.isArray(raw))throw Error('저장된 덱 목록을 읽지 못했어요.');return raw.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.createdAt==='number'&&['solo','union'].includes(x.deck?.type)&&Array.isArray(x.deck.squads));}
export function saveLibraryDeck(title:string,deck:Deck){if(!title.trim())throw Error('덱 이름을 입력해 주세요.');const rows=readLibraryDecks();rows.unshift({id:crypto.randomUUID(),title:title.trim().slice(0,60),deck:structuredClone(deck),createdAt:Date.now()});localStorage.setItem(key,JSON.stringify(rows));}
