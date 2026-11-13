import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {Store} from '../store.js';
import type {Database,Sql} from '../store.js';
import {buildApp} from '../app.js';
import {readConfig} from '../config.js';
import {raidHistory} from '../../src/data/raids.js';
test('shared decks enforce ownership, complete squads, filters, pagination and transactional votes',async t=>{
 const pg=new PGlite();const wrap=(db:Pick<PGlite,'query'>):Sql=>({async query<T extends Record<string,unknown>>(sql:string,values?:unknown[]){return {rows:(await db.query<T>(sql,values)).rows};}});const db:Database={...wrap(pg),transaction:fn=>pg.transaction(tx=>fn(wrap(tx as Pick<PGlite,'query'>))),close:()=>pg.close()};t.after(()=>db.close());const store=new Store(db);await store.migrate();
 const a=await store.googleUser('deck-a',null,'작성자'),b=await store.googleUser('deck-b',null,'독자');await store.session('a',a.id);await store.session('b',b.id);
 const origin='http://localhost:5173',app=await buildApp(readConfig({APP_ORIGIN:origin,DATABASE_URL:'postgres://test',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'}),store);t.after(()=>app.close());
 const ids=(JSON.parse(await readFile(new URL('../../public/data/nikkes.json',import.meta.url),'utf8')) as {id:string}[]).slice(0,26).map(n=>n.id);
 const payload={title:'공략',description:'설명',season:raidHistory.find(r=>r.type==='solo')!.seasonName,squadDescriptions:Array(5).fill('스쿼드 설명'),deck:{type:'solo',squads:Array.from({length:5},(_,i)=>ids.slice(i*5,i*5+5)),names:Array.from({length:5},(_,i)=>'스쿼드 '+i),elements:Array(5).fill('전격'),weakness:'Water',candidates:[]}};
 const post=(url:string,body:unknown,token='a',from=origin)=>app.inject({method:'POST',url,headers:{origin:from,cookie:'mimir-mk2-local='+token},payload:body as object});
 assert.equal((await post('/api/decks',payload,'')).statusCode,401);assert.equal((await post('/api/decks',payload,'a','https://evil.example')).statusCode,403);
 const broken=structuredClone(payload);broken.deck.squads[0][0]=broken.deck.squads[0][1];assert.equal((await post('/api/decks',broken)).statusCode,400);broken.deck.squads[0][0]='unknown';assert.equal((await post('/api/decks',broken)).statusCode,400);
 const created=await post('/api/decks',payload);assert.equal(created.statusCode,200,created.body);const id=created.json().id;
 assert((await store.badges(a.id)).unlocks.some(u=>u.id==='battle_data'));
 const list=await app.inject('/api/decks?include='+ids[0]);assert.equal(list.json().items.length,1);assert.equal((await app.inject('/api/decks?exclude='+ids[0])).json().items.length,0);assert.equal((await app.inject('/api/decks?include='+ids[25])).json().items.length,0);
 assert.equal((await post('/api/decks/'+id+'/edit',payload,'b')).statusCode,404);assert.equal((await post('/api/decks/'+id+'/delete',{},'b')).statusCode,404);
 for(const [value,vote,up,down] of [[1,1,1,0],[1,0,0,0],[-1,-1,0,1],[1,1,1,0]]){const res=await post('/api/decks/'+id+'/vote',{value},'b');assert.equal(res.statusCode,200,res.body);assert.deepEqual(res.json(),{myVote:vote,upvotes:up,downvotes:down});}
 const changed=structuredClone(payload);changed.title='수정';assert.equal((await post('/api/decks/'+id+'/edit',changed)).statusCode,200);const own=(await app.inject({url:'/api/decks?sort=score',headers:{cookie:'mimir-mk2-local=b'}})).json().items[0];assert.equal(own.title,'수정');assert.equal(own.myVote,1);assert.equal(own.upvotes,1);
 await store.deleteUser(b.id);assert.equal((await app.inject('/api/decks')).json().items[0].upvotes,0);
 for(let i=0;i<21;i++)await db.query('INSERT INTO shared_decks(id,author_id,title,description,season,raid_type,data,nikke_ids) SELECT $1,author_id,title,description,season,raid_type,data,nikke_ids FROM shared_decks WHERE id=$2',[crypto.randomUUID(),id]);
 const first=(await app.inject('/api/decks')).json();assert.equal(first.items.length,20);assert(first.hasMore);assert.equal((await app.inject('/api/decks?offset=20')).json().items.length,2);
 assert.equal((await post('/api/decks/'+id+'/delete',{})).statusCode,200);assert.equal((await db.query('SELECT * FROM shared_deck_votes WHERE deck_id=$1',[id])).rows.length,0);
});
