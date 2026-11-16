import test from 'node:test';
import assert from 'node:assert/strict';
import {startWorldcup,chooseNikke,validWorldcup} from '../src/nikke-worldcup-model';
test('even and odd brackets keep every chosen winner and finish after N-1 decisions',()=>{
 for(const n of [2,3,4,5,7,16,103,206])for(let target=0;target<n;target++){
  const ids=Array.from({length:n},(_,i)=>String(i)),wanted=String(target);let state=startWorldcup(ids,()=>.37);assert.equal(state.pool.length,n);
  while(state.pool.length>1){assert(validWorldcup(JSON.parse(JSON.stringify(state)),new Set(ids)));const pair=state.pool.slice(state.index,state.index+2);assert.equal(pair.length,2);state=chooseNikke(state,pair.includes(wanted)?wanted:pair[0],()=>.63);assert(state.picks<n);}
  assert.equal(state.pool[0],wanted);assert.equal(state.picks,n-1);assert(validWorldcup(state,new Set(ids)));
 }
});
test('invalid choices, duplicate entrants and corrupted saved states',()=>{
 const state=startWorldcup(['a','b','a','c'],()=>.5);assert.equal(state.total,3);assert.equal(chooseNikke(state,'other'),state);assert(!validWorldcup({...state,pool:['a','a']},new Set(['a','b','c'])));assert(!validWorldcup({...state,index:1},new Set(['a','b','c'])));assert(!validWorldcup(state,new Set(['a','b'])));assert.throws(()=>startWorldcup(['a','a']));
});

test('participant scope independently excludes R and Abnormal and preserves SR',async()=>{
 const {worldcupParticipants}=await import('../src/nikke-worldcup-model');
 const {readFileSync}=await import('node:fs');
 const catalog=JSON.parse(readFileSync('public/data/nikkes.json','utf8'));
 for(const includeMassProduced of [false,true])for(const includeCollaboration of [false,true]){
  const selected=worldcupParticipants(catalog,{includeMassProduced,includeCollaboration});
  assert.deepEqual(selected,catalog.filter((n:any)=>(includeMassProduced||n.rank!=='R')&&(includeCollaboration||n.company!=='Abnormal')));
  assert(selected.some((n:any)=>n.rank==='SR'));const state=startWorldcup(selected.map((n:any)=>n.id));assert.equal(state.total,selected.length);assert(validWorldcup(state,new Set(catalog.map((n:any)=>n.id))));
 }
});

test('NPC scope is independent, off by default, and saved NPC brackets remain valid',async()=>{
 const {worldcupParticipants}=await import('../src/nikke-worldcup-model');const {readFileSync}=await import('node:fs');
 const nikkes=JSON.parse(readFileSync('public/data/nikkes.json','utf8')),npcs=JSON.parse(readFileSync('src/data/worldcup-npcs.json','utf8')),catalog=[...nikkes,...npcs];
 assert.equal(new Set(catalog.map(n=>n.id)).size,catalog.length);
 for(const includeMassProduced of [false,true])for(const includeCollaboration of [false,true])for(const includeNpc of [false,true]){
 const selected=worldcupParticipants(catalog,{includeMassProduced,includeCollaboration,includeNpc});assert.equal(selected.filter(n=>n.isNpc).length,includeNpc?npcs.length:0);
 assert(selected.filter(n=>!n.isNpc).every(n=>(includeMassProduced||n.rank!=='R')&&(includeCollaboration||n.company!=='Abnormal')));
 let state=startWorldcup(selected.map(n=>n.id));while(state.pool.length>1)state=chooseNikke(state,state.pool[state.index]);assert(validWorldcup(JSON.parse(JSON.stringify(state)),new Set(catalog.map(n=>n.id))));
 }
 for(const n of npcs)assert(readFileSync('public/'+decodeURIComponent(n.imageUrl)).length>0);
});
