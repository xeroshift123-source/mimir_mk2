import {raidHistory} from './data/raids';
import type {Mode} from './deck-model';
const lastKey='mimir-mk2-last-builder-raid';
export function lastBuilderRaid(mode?:Mode){try{const id=localStorage.getItem(lastKey);const saved=raidHistory.find(r=>r.id===id&&(!mode||r.type===mode));if(saved)return saved;}catch{}return [...raidHistory].reverse().find(r=>!mode||r.type===mode);}
export function builderEntry(){const raid=lastBuilderRaid();return raid?`/builder/${raid.type}?raid=${encodeURIComponent(raid.id)}`:'/builder/solo';}
export function rememberBuilderRaid(id:string){try{localStorage.setItem(lastKey,id);}catch{}}
