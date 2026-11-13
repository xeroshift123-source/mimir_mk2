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
