import {earnedBadges} from '../shared/achievements.js';
import type {BadgeState} from '../shared/achievements.js';
import {elementTotals} from './element-scores.js';
import {Pool} from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {AccountUser,LinkedAccount,RawProfile,AccountProfile,SavedScore} from '../shared/account.js';
import {ApiError} from './errors.js';
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export interface Sql{query<T extends Record<string,unknown>=Record<string,unknown>>(sql:string,values?:unknown[]):Promise<{rows:T[]}>}
export interface Database extends Sql{transaction<T>(work:(sql:Sql)=>Promise<T>):Promise<T>;close():Promise<void>}
export function postgres(url:string):Database{const pool=new Pool({connectionString:url,max:8,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});return {query:(sql,values)=>pool.query(sql,values),async transaction(work){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}},close:()=>pool.end()};}
type AccountRow={id:string;owner_id:string;profile:RawProfile;revision:string;scores:Record<string,SavedScore>;score_status:string;updated_at:Date|string;open_id:string};
const summary=(row:AccountRow,selected:string|null):LinkedAccount=>({id:row.id,nickname:row.profile.nickname,server:row.profile.server,updatedAt:new Date(row.updated_at).toISOString(),selected:row.id===selected});
export class Store{
 constructor(readonly db:Database){}
 async migrate(){
  for(const sql of (await readFile(new URL('../server/schema.sql',import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await this.db.query(sql);
  // Backfill pre-existing snapshots once; use revision checks to avoid stale writes.
  const {rows}=await this.db.query("SELECT a.id,a.revision,a.scores,a.score_status FROM commander_accounts a WHERE a.score_status IN ('complete','partial') AND NOT EXISTS(SELECT 1 FROM account_element_scores e WHERE e.account_id=a.id)");
  for(const row of rows)await this.saveScores(String(row.id),String(row.revision),row.scores as Record<string,SavedScore>,String(row.score_status));
 }
 async clean(){await this.db.query('DELETE FROM sessions WHERE expires_at<=now()');await this.db.query('DELETE FROM oauth_flows WHERE expires_at<=now()');await this.db.query('DELETE FROM link_challenges WHERE expires_at<=now()');}
 async user(token?:string):Promise<AccountUser|null>{if(!token||token.length>128)return null;const {rows}=await this.db.query('SELECT u.id,u.nickname,u.email,u.picture FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)]);return rows[0] as unknown as AccountUser??null;}
 async session(token:string,userId:string){await this.db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hash(token),userId]);}
 async deleteUser(userId:string){await this.db.transaction(async sql=>{const affected=await sql.query('SELECT d.id FROM shared_decks d JOIN shared_deck_votes v ON v.deck_id=d.id WHERE v.user_id=$1 ORDER BY d.id FOR UPDATE OF d',[userId]);await sql.query('DELETE FROM users WHERE id=$1',[userId]);for(const row of affected.rows)await sql.query('UPDATE shared_decks SET upvotes=(SELECT count(*) FROM shared_deck_votes WHERE deck_id=$1 AND value=1),downvotes=(SELECT count(*) FROM shared_deck_votes WHERE deck_id=$1 AND value=-1),score=(SELECT COALESCE(sum(value),0) FROM shared_deck_votes WHERE deck_id=$1) WHERE id=$1',[row.id]);});}
 async logout(token:string){await this.db.query('DELETE FROM sessions WHERE token_hash=$1',[hash(token)]);}
 async oauthStart(state:string,verifier:string,nonce:string){await this.db.query("INSERT INTO oauth_flows(state_hash,verifier,nonce,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')",[hash(state),verifier,nonce]);}
 async oauthConsume(state:string){const {rows}=await this.db.query('DELETE FROM oauth_flows WHERE state_hash=$1 AND expires_at>now() RETURNING verifier,nonce',[hash(state)]);return rows[0] as {verifier:string;nonce:string}|undefined;}
 async googleUser(sub:string,email:string|null,nickname:string,picture:string|null=null):Promise<AccountUser>{const {rows}=await this.db.query('INSERT INTO users(id,google_sub,email,nickname,picture) VALUES($1,$2,$3,$4,$5) ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email,picture=EXCLUDED.picture RETURNING id,nickname,email,picture',[randomUUID(),sub,email,nickname,picture]);return rows[0] as unknown as AccountUser;}
 async accounts(userId:string){const {rows}=await this.db.query('SELECT a.*,u.selected_account FROM commander_accounts a JOIN users u ON u.id=a.owner_id WHERE a.owner_id=$1 ORDER BY a.updated_at DESC',[userId]);return rows.map(row=>summary(row as unknown as AccountRow,row.selected_account as string|null));}
 async selected(userId:string){const {rows}=await this.db.query('SELECT selected_account FROM users WHERE id=$1',[userId]);return rows[0]?.selected_account as string|null;}
 async select(userId:string,accountId:string){const {rows}=await this.db.query('UPDATE users SET selected_account=$2 WHERE id=$1 AND EXISTS(SELECT 1 FROM commander_accounts WHERE id=$2 AND owner_id=$1) RETURNING id',[userId,accountId]);if(!rows.length)throw new ApiError(404,'연결된 계정을 찾을 수 없어요.');}
 async account(userId:string,id:string){const {rows}=await this.db.query('SELECT * FROM commander_accounts WHERE id=$1 AND owner_id=$2',[id,userId]);if(!rows.length)throw new ApiError(404,'연결된 계정을 찾을 수 없어요.');return rows[0] as unknown as AccountRow;}
 async profile(userId:string,id:string):Promise<AccountProfile>{
  const row=await this.account(userId,id),scores=structuredClone(row.scores);
  const elementScores:NonNullable<AccountProfile['elementScores']>={};
  const comparison=await this.db.query(`SELECT own.weakness,own.score,count(*)::int AS samples,avg(pop.score) AS average,
   (100.0*sum(CASE WHEN pop.damage>own.damage THEN 1 WHEN pop.damage=own.damage THEN 0.5 ELSE 0 END)/count(*))::double precision AS top_percent
   FROM account_element_scores own JOIN account_element_scores pop ON pop.weakness=own.weakness AND pop.policy_hash=own.policy_hash AND pop.calc_version=own.calc_version
   WHERE own.account_id=$1 GROUP BY own.weakness,own.score,own.damage`,[id]);
  for(const r of comparison.rows){const count=Number(r.samples);elementScores[String(r.weakness)]={score:Number(r.score),sampleCount:count,average:count>=20?Number(r.average):null,topPercent:count>=20?Number(r.top_percent):null};}
  const nikkeComparisons:NonNullable<AccountProfile['nikkeComparisons']>={};
  const cohort=Object.values(scores).find(s=>s.status==='complete'&&s.policyHash&&s.calcVersion);
  if(cohort){
   const {rows}=await this.db.query(`SELECT e.key,count(*)::int AS sample_count,
    avg((e.value->>'score')::double precision) AS average,
    CASE WHEN own.value->>'status'='complete' AND own.value->>'policyHash'=$2 AND own.value->>'calcVersion'=$3
     THEN (100.0*sum(CASE WHEN (e.value->>'damage')::numeric>(own.value->>'damage')::numeric THEN 1
      WHEN (e.value->>'damage')::numeric=(own.value->>'damage')::numeric THEN 0.5 ELSE 0 END)/count(*))::double precision ELSE NULL END AS top_percent
    FROM commander_accounts a CROSS JOIN LATERAL jsonb_each(a.scores) e
    LEFT JOIN jsonb_each($1::jsonb) own ON own.key=e.key
    WHERE e.value->>'status'='complete' AND e.value->>'policyHash'=$2 AND e.value->>'calcVersion'=$3
    GROUP BY e.key,own.value`,[JSON.stringify(scores),cohort.policyHash,cohort.calcVersion]);
   for(const item of rows){
    const key=String(item.key),score=scores[key],count=Number(item.sample_count);
    const average=count>=20?Number(item.average):null,topPercent=count>=20&&item.top_percent!==null?Number(item.top_percent):null;
    const [name,weakness]=key.split(':');
    nikkeComparisons[key]={nameCode:Number(name),weakness,score:score?.status==='complete'&&score.policyHash===cohort.policyHash&&score.calcVersion===cohort.calcVersion?score.score??null:null,average,topPercent,sampleCount:count};
    if(score){score.sampleCount=count;score.average=average;score.topPercent=topPercent;}
   }
  }

  return {account:summary(row,await this.selected(userId)),profile:row.profile,scores,elementScores,nikkeComparisons,scoreStatus:row.score_status};
 }
 async badges(userId:string):Promise<BadgeState>{
  return this.db.transaction(async sql=>{
   await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   const {rows}=await sql.query('SELECT a.id,a.profile,a.revision FROM commander_accounts a LEFT JOIN badge_revisions r ON r.account_id=a.id WHERE a.owner_id=$1 AND (r.revision IS NULL OR r.revision<>a.revision)',[userId]);
   for(const row of rows){
    for(const id of earnedBadges(row.profile as RawProfile))await sql.query('INSERT INTO badge_unlocks(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,id]);
    await sql.query('INSERT INTO badge_revisions(account_id,revision) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET revision=EXCLUDED.revision',[row.id,row.revision]);
   }
   const unlocked=await sql.query('SELECT badge_id,acquired_at FROM badge_unlocks WHERE user_id=$1 ORDER BY acquired_at,badge_id',[userId]);
   const selected=await sql.query('SELECT badge_ids FROM badge_showcases WHERE user_id=$1',[userId]);
   return {unlocks:unlocked.rows.map(r=>({id:String(r.badge_id),acquiredAt:new Date(r.acquired_at as string).toISOString()})),displayedBadgeIds:(selected.rows[0]?.badge_ids??[]) as string[]};
  });
 }
 async displayBadges(userId:string,ids:string[]){
  await this.db.transaction(async sql=>{
   await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   const {rows}=await sql.query('SELECT badge_id FROM badge_unlocks WHERE user_id=$1 AND badge_id=ANY($2::text[])',[userId,ids]);
   if(new Set(ids).size!==ids.length||ids.length>10||rows.length!==ids.length)throw new ApiError(403,'획득한 뱃지를 최대 10개까지 선택해 주세요.');
   await sql.query('INSERT INTO badge_showcases(user_id,badge_ids) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET badge_ids=EXCLUDED.badge_ids',[userId,ids]);
  });
 }
 async challenge(userId:string,code:string){await this.db.query("INSERT INTO link_challenges(user_id,code,expires_at) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET code=EXCLUDED.code,expires_at=EXCLUDED.expires_at",[userId,code]);}
 async getChallenge(userId:string){const {rows}=await this.db.query('SELECT code FROM link_challenges WHERE user_id=$1 AND expires_at>now()',[userId]);if(!rows.length)throw new ApiError(409,'확인 코드가 만료됐어요. 새 코드를 발급해 주세요.');return rows[0].code as string;}
 async reserveSync(userId:string){const owner=randomUUID();const {rows}=await this.db.query("INSERT INTO sync_leases(user_id,owner,expires_at,last_attempt_at) VALUES($1,$2,now()+interval '5 minutes',now()) ON CONFLICT(user_id) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at,last_attempt_at=now() WHERE sync_leases.expires_at<now() AND sync_leases.last_attempt_at<now()-interval '30 seconds' RETURNING owner",[userId,owner]);if(!rows.length)throw new ApiError(429,'동기화 중이거나 대기 시간이에요. 잠시 후 다시 시도해 주세요.',30);return owner;}
 async releaseSync(userId:string,owner:string){await this.db.query('UPDATE sync_leases SET expires_at=now() WHERE user_id=$1 AND owner=$2',[userId,owner]);}
 async saveProfile(userId:string,openId:string,profile:RawProfile,scoreEnabled:boolean,isRefresh=false){return this.db.transaction(async sql=>{
  await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const id=randomUUID(),revision=randomUUID();
  const {rows}=await sql.query("INSERT INTO commander_accounts(id,owner_id,open_id,profile,revision,score_status) VALUES($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT(open_id) DO UPDATE SET profile=EXCLUDED.profile,revision=EXCLUDED.revision,scores='{}'::jsonb,score_status=EXCLUDED.score_status,updated_at=now(),score_started_at=NULL WHERE commander_accounts.owner_id=EXCLUDED.owner_id RETURNING id",[id,userId,openId,JSON.stringify(profile),revision,scoreEnabled?'pending':'not_configured']);
  if(!rows.length)throw new ApiError(409,'이미 다른 미미르 계정에 연결된 지휘관이에요.');
  const accountId=rows[0].id as string;
  for(const badge of earnedBadges(profile))await sql.query('INSERT INTO badge_unlocks(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,badge]);
  await sql.query('INSERT INTO badge_revisions(account_id,revision) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET revision=EXCLUDED.revision',[accountId,revision]);await sql.query('DELETE FROM account_element_scores WHERE account_id=$1',[accountId]);await sql.query('UPDATE users SET selected_account=$2 WHERE id=$1',[userId,accountId]);if(!isRefresh)await sql.query('DELETE FROM link_challenges WHERE user_id=$1',[userId]);return accountId;
 });}
 async acquireScoreLease(owner:string){const {rows}=await this.db.query("INSERT INTO service_leases(name,owner,expires_at) VALUES('scores',$1,now()+interval '15 minutes') ON CONFLICT(name) DO UPDATE SET owner=EXCLUDED.owner,expires_at=EXCLUDED.expires_at WHERE service_leases.expires_at<now() RETURNING owner",[owner]);return rows.length>0;}
 async releaseScoreLease(owner:string){await this.db.query("DELETE FROM service_leases WHERE name='scores' AND owner=$1",[owner]);}
 async claimScoreJob(){const {rows}=await this.db.query("UPDATE commander_accounts SET score_status='running',score_started_at=now() WHERE id=(SELECT id FROM commander_accounts WHERE score_status='pending' OR (score_status='running' AND score_started_at<now()-interval '15 minutes') ORDER BY updated_at LIMIT 1) RETURNING *");return rows[0] as unknown as AccountRow|undefined;}
 async saveScores(id:string,revision:string,scores:Record<string,SavedScore>,status:string){await this.db.transaction(async sql=>{
  const {rows}=await sql.query('UPDATE commander_accounts SET scores=$3::jsonb,score_status=$4 WHERE id=$1 AND revision=$2 RETURNING profile',[id,revision,JSON.stringify(scores),status]);
  if(!rows.length)return;
  await sql.query('DELETE FROM account_element_scores WHERE account_id=$1',[id]);
  for(const total of elementTotals(rows[0].profile as RawProfile,scores))await sql.query('INSERT INTO account_element_scores(account_id,weakness,policy_hash,calc_version,damage,score) VALUES($1,$2,$3,$4,$5,$6)',[id,total.weakness,total.policyHash,total.calcVersion,total.damage,total.score]);
 });}
}
