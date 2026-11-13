import test from 'node:test';
import {createRequire} from 'node:module';
import {scoreOnce} from '../scores.js';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readConfig} from '../config.js';
import {Store} from '../store.js';
import type {Database,Sql} from '../store.js';
import {buildApp} from '../app.js';
import {parseProfileUrl,hasIntroCode} from '../blabla.js';
import {authorizationUrl,sameToken} from '../oauth.js';
import type {RawProfile,AccountSession,AccountProfile} from '../../shared/account.js';
const origin='http://localhost:5173';
async function database(){const pg=new PGlite();const wrap=(db:Pick<PGlite,'query'>):Sql=>({async query<T extends Record<string,unknown>>(sql:string,values?:unknown[]){return {rows:(await db.query<T>(sql,values)).rows};}});const db:Database={...wrap(pg),transaction:work=>pg.transaction(tx=>work(wrap(tx as Pick<PGlite,'query'>))),close:()=>pg.close()};const store=new Store(db);await store.migrate();return store;}
const raw:RawProfile={nickname:'테스트 지휘관',server:'한국',union:'테스트 유니온',synchroLevel:400,commanderLevel:200,ownedNikkesCount:0,combatPower:123456,recycleRoom:[],recycleRoomComplete:false,characters:[],stateEffects:[]};
test('profile URLs are allowlisted and verification checks only introduction fields',()=>{
 assert.equal(parseProfileUrl('https://www.blablalink.com/user?openid='+Buffer.from('test-commander').toString('base64')),'test-commander');
 for(const url of ['http://blablalink.com/user?openid=x','https://blablalink.com.evil.test/user?openid=x','https://evil@blablalink.com/user?openid=x','https://blablalink.com:444/user?openid=x','https://blablalink.com/user?openid=x&openid=y','https://blablalink.com/user?openid=../x'])assert.throws(()=>parseProfileUrl(url));
 assert(hasIntroCode({info:{description:'미미르만만세 MIMIR-MK2-XYZ'}},'MIMIR-MK2-XYZ'));
 assert(!hasIntroCode({info:{username:'MIMIR-MK2-XYZ'}},'MIMIR-MK2-XYZ'));
 assert(!sameToken('a'.repeat(43),'한'.repeat(43)));
 const config=readConfig({APP_ORIGIN:origin,DATABASE_URL:'postgres://test',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'});
 const url=new URL(authorizationUrl(config,'state','verifier','nonce'));assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/auth/google/callback');assert.equal(url.searchParams.get('nonce'),'nonce');
});
test('isolated accounts: OAuth state, sessions, ownership, sync cooldown and logout',async t=>{
 const store=await database();t.after(()=>store.db.close());let publicCalls=0,collected=0,intro='';
 const config=readConfig({APP_ORIGIN:origin,DATABASE_URL:'postgres://test',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret'});
 const app=await buildApp(config,store,{oauth:{async exchange(code){return {sub:code,email:code+'@example.test',nickname:code};}},provider:{async publicProfile(){publicCalls++;return {info:{description:intro}};},async collect(){collected++;return raw;}}});t.after(()=>app.close());
 const post=(path:string,session:string,payload:Record<string,unknown>={})=>app.inject({method:'POST',url:path,headers:{origin,cookie:session},payload});
 assert.equal((await app.inject('/api/session')).json<AccountSession>().user,null);
 assert.equal((await post('/api/accounts/challenge','')).statusCode,401);
 const badOrigin=await app.inject({method:'POST',url:'/api/logout',headers:{origin:'https://attacker.test'},payload:{}});assert.equal(badOrigin.statusCode,403);
 async function login(code:string){const start=await app.inject('/api/auth/google');assert.equal(start.statusCode,302);const url=new URL(start.headers.location!);const state=url.searchParams.get('state')!;const stateCookie=start.cookies.find(c=>c.name==='mimir-mk2-oauth')!.value;
  assert.equal((await app.inject({url:'/api/auth/google/callback?state='+state+'&code='+code,headers:{cookie:'mimir-mk2-oauth=wrong'}})).statusCode,400);
  const callback=await app.inject({url:'/api/auth/google/callback?state='+state+'&code='+code,headers:{cookie:'mimir-mk2-oauth='+stateCookie}});assert.equal(callback.statusCode,302);const session=callback.cookies.find(c=>c.name==='mimir-mk2-local')!;assert(session.httpOnly);assert.equal(session.sameSite,'Lax');
  assert.equal((await app.inject({url:'/api/auth/google/callback?state='+state+'&code='+code,headers:{cookie:'mimir-mk2-oauth='+stateCookie}})).statusCode,400);
  return 'mimir-mk2-local='+session.value;
 }
 const alice=await login('alice'),bob=await login('bob');const a=(await app.inject({url:'/api/session',headers:{cookie:alice}})).json<AccountSession>();const b=(await app.inject({url:'/api/session',headers:{cookie:bob}})).json<AccountSession>();assert.notEqual(a.user!.id,b.user!.id);
 const proof=(await post('/api/accounts/challenge',alice)).json<{code:string}>();intro='';assert.equal((await post('/api/accounts/link',alice,{url:'https://www.blablalink.com/user?openid=commander_123'})).statusCode,422);assert.equal(collected,0);assert.deepEqual(await store.accounts(a.user!.id),[]);await store.db.query("UPDATE sync_leases SET last_attempt_at=now()-interval '31 seconds',expires_at=now()-interval '1 second' WHERE user_id=$1",[a.user!.id]);intro='기존 소개글 · '+proof.code;
 const linked=await post('/api/accounts/link',alice,{url:'https://www.blablalink.com/user?openid=commander_123'});assert.equal(linked.statusCode,200,linked.body);const profile=linked.json<AccountProfile>();assert.equal(profile.account.nickname,raw.nickname);assert.equal(profile.scoreStatus,'not_configured');assert.equal(collected,1);
 assert.equal((await app.inject({url:'/api/accounts/'+profile.account.id,headers:{cookie:bob}})).statusCode,404);
 assert.equal((await post('/api/accounts/'+profile.account.id+'/select',bob)).statusCode,404);
 const calls=publicCalls;assert.equal((await post('/api/accounts/'+profile.account.id+'/refresh',bob)).statusCode,404);assert.equal(publicCalls,calls);
 assert.equal((await post('/api/accounts/'+profile.account.id+'/refresh',alice)).statusCode,429);
 await store.db.query("UPDATE sync_leases SET last_attempt_at=now()-interval '31 seconds',expires_at=now()-interval '1 second' WHERE user_id=$1",[a.user!.id]);
 assert.equal((await post('/api/accounts/'+profile.account.id+'/refresh',alice)).statusCode,200);
 await assert.rejects(()=>store.saveProfile(b.user!.id,'commander_123',raw,false),/다른 미미르/);
 assert.equal((await post('/api/logout',alice)).statusCode,200);assert.equal((await app.inject({url:'/api/session',headers:{cookie:alice}})).json<AccountSession>().user,null);
});
test('unconfigured installation offers no fake login',async t=>{const app=await buildApp(readConfig(),null);t.after(()=>app.close());const session=(await app.inject('/api/session')).json<AccountSession>();assert.equal(session.configured,false);assert.equal(session.user,null);assert.equal((await app.inject('/api/auth/google')).statusCode,503);});
export {database};

test('score jobs use PostgreSQL leases and never overwrite a newer sync',async t=>{
 const store=await database();t.after(()=>store.db.close());
 const require=createRequire(import.meta.url);const standards=require('../legacy/nikkeScoreStandards.json');const fixed=structuredClone(standards['5129:fire']);
 const profile:RawProfile={...raw,characters:fixed.characters.filter((c:{name_code:number})=>c.name_code===5129),stateEffects:fixed.stateEffects,recycleRoom:[1001,1101,1102,1103,1201,1202,1203,1204,1205].map(tid=>({tid,lv:120})),recycleRoomComplete:true};
 const user=await store.googleUser('score-owner',null,'테스트');const id=await store.saveProfile(user.id,'score-commander',profile,true);
 let calls=0;const transport=async(key:string,items:{id:string}[])=>{calls++;return {calc_version:'test-v1',items:items.map(item=>({id:item.id,damage:2030000000}))};};
 assert(await scoreOnce(store,'test-key',transport));const saved=await store.profile(user.id,id);assert.equal(saved.scores['5129:fire'].score,101.5);assert.equal(saved.scores['5129:iron'].score,101.5);assert.equal(saved.scoreStatus,'complete');assert.equal(calls,2);assert.equal(await scoreOnce(store,'test-key',transport),false);
 assert.equal(saved.scores['5129:fire'].sampleCount,1);assert.equal(saved.scores['5129:fire'].average,null);assert.equal(saved.scores['5129:fire'].topPercent,null);
 for(let i=0;i<19;i++){const sampleId=await store.saveProfile(user.id,'sample-'+i,raw,false);const sample=await store.account(user.id,sampleId);const damage=1000000000+i*1000000;await store.saveScores(sampleId,sample.revision,{'5129:fire':{...saved.scores['5129:fire'],damage,score:damage*5/100000000}},'complete');}
 const compared=await store.profile(user.id,id);assert.equal(compared.scores['5129:fire'].sampleCount,20);assert.equal(compared.scores['5129:fire'].topPercent,2.5);assert(compared.scores['5129:fire'].average!>0);
 assert.equal(compared.nikkeComparisons!['5129:fire'].sampleCount,20);
 assert.equal(compared.nikkeComparisons!['5129:fire'].average,compared.scores['5129:fire'].average);
 const sampleAccount=(await store.accounts(user.id)).find(a=>a.id!==id)!;
 const sampleView=await store.profile(user.id,sampleAccount.id);
 assert.equal(sampleView.nikkeComparisons!['5129:iron'].sampleCount,1);
 assert.equal(sampleView.nikkeComparisons!['5129:iron'].score,null);
 assert.equal(sampleView.nikkeComparisons!['5129:iron'].topPercent,null);

 await store.saveProfile(user.id,'score-commander',profile,true);const stale=await store.account(user.id,id);await store.saveProfile(user.id,'score-commander',{...profile,nickname:'새 동기화'},true);await store.saveScores(id,stale.revision,{'stale':{status:'complete',score:999}},'complete');const current=await store.profile(user.id,id);assert.equal(current.profile.nickname,'새 동기화');assert.equal(current.scoreStatus,'pending');assert.deepEqual(current.scores,{});
 assert(await store.acquireScoreLease('00000000-0000-4000-8000-000000000001'));assert.equal(await store.acquireScoreLease('00000000-0000-4000-8000-000000000002'),false);
});


test('element percentile compares account totals with matching versions and excludes failed owned results',async t=>{
 const store=await database();t.after(()=>store.db.close());
 const require=createRequire(import.meta.url);
 const {TARGETS,POLICY_HASH}=require('../legacy/nikkeScoreAdapter.js');
 const {elementTotals}=await import('../element-scores.js');
 const profile={...raw,characters:[{name_code:5129}] as RawProfile['characters']};
 const makeScores=(damage:number,version='v1')=>Object.fromEntries([...TARGETS].filter(([,target]:any)=>target.nameCode===5129).map(([key,target]:any)=>[key,{status:'complete',weakness:target.weakness,policyHash:POLICY_HASH,calcVersion:version,damage,score:damage*5/1e8}]));
 let owner='',accountId='';
 for(let i=0;i<20;i++){
  const user=await store.googleUser('rank-user-'+i,null,'표본');
  const id=await store.saveProfile(user.id,'rank-commander-'+i,profile,true),row=await store.account(user.id,id);
  await store.saveScores(id,row.revision,makeScores(1000000000+i*100000000),'complete');
  if(i===19){owner=user.id;accountId=id;}
 }
 let result=(await store.profile(owner,accountId)).elementScores!.fire;
 assert.equal(result.sampleCount,20);assert.equal(result.topPercent,2.5);assert.equal(result.score,145);
 const foreign=await store.googleUser('rank-foreign',null,'다른 버전');
 const foreignId=await store.saveProfile(foreign.id,'rank-foreign',profile,true),foreignRow=await store.account(foreign.id,foreignId);
 await store.saveScores(foreignId,foreignRow.revision,makeScores(99900000000,'v2'),'complete');
 result=(await store.profile(owner,accountId)).elementScores!.fire;assert.equal(result.sampleCount,20);
 const bad=makeScores(1000000000);bad['5129:fire'].status='error';
 assert(!elementTotals(profile,bad).some((r:any)=>r.weakness==='fire'));
 assert(elementTotals({...raw,characters:[]},makeScores(1000000000)).every((r:any)=>r.score===0));
 const same=await store.account(owner,accountId);await store.saveScores(accountId,same.revision,makeScores(1000000000),'complete');
 result=(await store.profile(owner,accountId)).elementScores!.fire;assert.equal(result.topPercent,95);
 await store.saveProfile(foreign.id,'rank-foreign',profile,true);
 await store.saveProfile(owner,'rank-commander-19',profile,true);
 assert.deepEqual((await store.profile(owner,accountId)).elementScores,{});
 const remaining=await store.db.query("SELECT count(*)::int AS n FROM account_element_scores WHERE weakness='fire' AND calc_version='v1'");assert.equal(remaining.rows[0].n,19);
});
