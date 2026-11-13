import {buildApp} from '../app.js';
import {readConfig} from '../config.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Store} from '../store.js';
import type {Database,Sql} from '../store.js';
import {earnedBadges,ultimate} from '../../shared/achievements.js';
import type {RawProfile,RawCharacter} from '../../shared/account.js';
const char:RawCharacter={name_code:1013,level:400,combat:100,grade:3,core:7,bondLevel:40,skills:{skill1:10,skill2:10,burst:10},favoriteItem:null,harmonyCube:{tid:1,level:15},equipment:['head','torso','arm','leg'].map(slot=>({slot,tid:1,tier:10,level:5,corporationType:1,overloadOptions:[7000511,7000611,7000711]})),growthDataQuality:{schemaVersion:1,complete:true,missingFields:[]}};
const profile:RawProfile={nickname:'test',server:'한국',union:'',synchroLevel:1000,commanderLevel:1,ownedNikkesCount:1,combatPower:100,recycleRoom:[{tid:1101,lv:100},{tid:1102,lv:90}],recycleRoomComplete:true,characters:[char],stateEffects:[]};
test('badge boundaries use complete character evidence and four distinct equipment slots',()=>{
 const earned=earnedBadges(profile);assert(earned.includes('level_400'));assert(!earned.includes('level_500'));assert(earned.includes('extreme_firepower'));assert(earned.includes('reliable_companion'));assert(earned.includes('no_distinction'));assert(earned.includes('ultimate_1013'));
 assert(ultimate(char));assert(!ultimate({...char,equipment:char.equipment.map(e=>({...e,slot:'head'}))}));assert(!ultimate({...char,equipment:char.equipment.map(e=>({...e,overloadOptions:[7000510,7000610,7000710]}))}));
 assert(!earnedBadges({...profile,characters:[{...char,growthDataQuality:undefined}]}).includes('level_400'));
 assert(!earnedBadges({...profile,recycleRoomComplete:false}).includes('extreme_firepower'));
 assert(!earned.some(id=>id.startsWith('first_class_')));
});
test('badge records persist across revisions, combine owned accounts and reject unearned showcases',async t=>{
 const pg=new PGlite();const wrap=(db:Pick<PGlite,'query'>):Sql=>({async query<T extends Record<string,unknown>>(sql:string,values?:unknown[]){return {rows:(await db.query<T>(sql,values)).rows};}});const db:Database={...wrap(pg),transaction:fn=>pg.transaction(tx=>fn(wrap(tx as Pick<PGlite,'query'>))),close:()=>pg.close()};t.after(()=>db.close());
 const store=new Store(db);await store.migrate();const a=await store.googleUser('a','a@example.com','a','https://example.com/avatar.png'),b=await store.googleUser('b',null,'b');assert.equal(a.picture,'https://example.com/avatar.png');await store.session('picture-test',a.id);assert.equal((await store.user('picture-test'))?.picture,a.picture);await store.saveProfile(a.id,'account-a',profile,false);
 const first=await store.badges(a.id);assert(first.unlocks.some(u=>u.id==='level_400'));await store.displayBadges(a.id,['level_400']);
 await assert.rejects(store.displayBadges(b.id,['level_400']));await assert.rejects(store.displayBadges(a.id,['level_400','level_400']));
 await store.saveProfile(a.id,'account-a',{...profile,characters:[]},false);const second=await store.badges(a.id);assert.deepEqual(second,await store.badges(a.id));assert.equal(second.unlocks.find(u=>u.id==='level_400')!.acquiredAt,first.unlocks.find(u=>u.id==='level_400')!.acquiredAt);assert.deepEqual(second.displayedBadgeIds,['level_400']);assert.deepEqual((await store.badges(b.id)).unlocks,[]);
 await store.saveProfile(a.id,'account-a2',{...profile,characters:[{...char,level:500}]},false);assert((await store.badges(a.id)).unlocks.some(u=>u.id==='level_500'));
 await store.displayBadges(a.id,[]);assert.deepEqual((await store.badges(a.id)).displayedBadgeIds,[]);
 const origin='http://localhost:5173';const app=await buildApp(readConfig({APP_ORIGIN:origin,DATABASE_URL:'postgres://test',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'}),store);t.after(()=>app.close());
 const request=(confirmation:string,cookie='mimir-mk2-local=picture-test',requestOrigin=origin)=>app.inject({method:'POST',url:'/api/account/delete',headers:{origin:requestOrigin,cookie},payload:{confirmation}});
 assert.equal((await request('탈퇴','')).statusCode,401);
 assert.equal((await request('탈퇴',undefined,'https://example.com')).statusCode,403);
 assert.equal((await request('삭제')).statusCode,400);assert(await store.user('picture-test'));
 await store.challenge(a.id,'test');
 assert.equal((await request('탈퇴')).statusCode,200);assert.equal(await store.user('picture-test'),null);assert.deepEqual(await store.accounts(a.id),[]);
 for(const table of ['badge_unlocks','badge_showcases','link_challenges']){const {rows}=await store.db.query('SELECT count(*)::int AS count FROM '+table+' WHERE user_id=$1',[a.id]);assert.equal(rows[0].count,0);}
 assert.equal((await store.db.query('SELECT id FROM users WHERE id=$1',[b.id])).rows.length,1);

});
