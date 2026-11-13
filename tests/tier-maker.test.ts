import test from 'node:test';
import assert from 'node:assert/strict';
import {placeTierNikke,restoreTierRows} from '../src/tier-maker-model';
import type {TierRow} from '../src/tier-maker-model';
test('tier placement appends, moves without duplicates, and supports insertion',()=>{
 const rows:TierRow[]=[{id:'s',name:'S',nikkes:[]},{id:'a',name:'A',nikkes:[]}];
 placeTierNikke(rows,'neon','s');placeTierNikke(rows,'rapi','s');assert.deepEqual(rows[0].nikkes,['neon','rapi']);
 placeTierNikke(rows,'neon','a');assert.deepEqual(rows.map(r=>r.nikkes),[['rapi'],['neon']]);
 placeTierNikke(rows,'anis','s','rapi');assert.deepEqual(rows[0].nikkes,['anis','rapi']);
 placeTierNikke(rows,'rapi','s','anis');assert.deepEqual(rows[0].nikkes,['rapi','anis']);
 assert.equal(placeTierNikke(rows,'rapi','s','rapi'),false);assert.equal(placeTierNikke(rows,'neon','missing'),false);assert.deepEqual(rows[1].nikkes,['neon']);
});
test('saved tier rows preserve names and order while removing unknown and duplicate nikkes',()=>{
 const rows=restoreTierRows([{id:'s',name:'최애',nikkes:['neon','unknown','rapi','neon']},{id:'s',name:'다음',nikkes:['rapi','anis']},null,{}],new Set(['neon','rapi','anis']));
 assert.equal(rows.length,2);assert.equal(rows[0].name,'최애');assert.deepEqual(rows.map(r=>r.nikkes),[['neon','rapi'],['anis']]);assert.notEqual(rows[0].id,rows[1].id);
 assert.deepEqual(restoreTierRows({},new Set()),[]);
});
