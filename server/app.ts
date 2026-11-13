import {validWorldcup} from '../src/nikke-worldcup-model.js';
import {readFile} from 'node:fs/promises';
import {registerDeckRoutes} from './decks.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {Config} from './config.js';
import {Store} from './store.js';
import {ApiError} from './errors.js';
import {authorizationUrl,googleOAuth,randomToken,sameToken} from './oauth.js';
import type {OAuthGateway} from './oauth.js';
import {blablaProvider,parseProfileUrl,hasIntroCode} from './blabla.js';
import type {ProfileProvider} from './blabla.js';
import type {FastifyRequest} from 'fastify';
const accountParams=z.object({id:z.string().uuid()});
export async function buildApp(config:Config,store:Store|null,dependencies:{oauth?:OAuthGateway;provider?:ProfileProvider}={}){
 const app=Fastify({bodyLimit:4096,requestTimeout:180000,trustProxy:(_address:string,hop:number)=>hop<1,logger:false});
 await app.register(cookie);await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
 const sessionName=config.cookieSecure?'__Host-mimir-mk2':'mimir-mk2-local';const stateName='mimir-mk2-oauth';
 const options={httpOnly:true,secure:config.cookieSecure,sameSite:'lax' as const,path:'/'};
 const oauth=dependencies.oauth??googleOAuth(config),provider=dependencies.provider??blablaProvider(config.BLABLA_COOKIE);
 const requireSetup=()=>{if(!store||!config.oauthConfigured)throw new ApiError(503,'로그인 서버 설정이 아직 완료되지 않았어요.');return store;};
 const requireUser=async(req:FastifyRequest)=>{const db=requireSetup();const user=await db.user(req.cookies[sessionName]);if(!user)throw new ApiError(401,'Google 로그인 후 이용해 주세요.');return user;};
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==config.APP_ORIGIN)throw new ApiError(403,'요청 출처를 확인할 수 없어요. 페이지를 새로고침해 주세요.');
 });
 app.setErrorHandler((error,req,reply)=>{if(error instanceof ApiError){if(error.retryAfter)reply.header('Retry-After',error.retryAfter);return reply.status(error.status).send({error:error.message,...(error.retryAfter?{retryAfterSeconds:error.retryAfter}:{})});}if(error instanceof z.ZodError||(error as {statusCode?:number}).statusCode===400)return reply.status(400).send({error:'입력 형식을 확인해 주세요.'});if((error as {statusCode?:number}).statusCode===429)return reply.status(429).send({error:'요청이 많아요. 잠시 후 다시 시도해 주세요.'});return reply.status(500).send({error:'서버에서 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'});});
 app.get('/api/health',async(req,reply)=>{try{if(store)await store.db.query('SELECT 1');return {ok:true,service:'mimir-mk2',database:!!store};}catch{return reply.status(503).send({ok:false,service:'mimir-mk2'});}});
 app.get('/api/session',async req=>{const user=store?await store.user(req.cookies[sessionName]):null;return {configured:!!store&&config.oauthConfigured,user,accounts:user?await store!.accounts(user.id):[],...(!store||!config.oauthConfigured?{reason:'OCI DB와 Google 로그인 설정이 필요해요.'}:{})};});
 app.get('/api/auth/google',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async(req,reply)=>{
  const db=requireSetup(),state=randomToken(),verifier=randomToken(),nonce=randomToken();await db.oauthStart(state,verifier,nonce);
  reply.setCookie(stateName,state,{...options,path:'/api/auth/google/callback',maxAge:600});return reply.redirect(authorizationUrl(config,state,verifier,nonce));
 });
 app.get('/api/auth/google/callback',async(req,reply)=>{
  const db=requireSetup();const query=req.query as Record<string,unknown>;const state=typeof query.state==='string'?query.state:'';const browserState=req.cookies[stateName]??'';
  reply.clearCookie(stateName,{...options,path:'/api/auth/google/callback'});
  if(!state||state.length>128||!sameToken(state,browserState))return reply.status(400).send({error:'로그인 요청을 확인할 수 없어요. 다시 시작해 주세요.'});
  const flow=await db.oauthConsume(state);if(!flow)return reply.status(400).send({error:'로그인 요청이 만료됐어요. 다시 시작해 주세요.'});
  if(query.error||typeof query.code!=='string'||query.code.length>4096)return reply.redirect(config.APP_ORIGIN+'/?auth=cancelled#/my-nikke');
  try{const identity=await oauth.exchange(query.code,flow.verifier,flow.nonce);const user=await db.googleUser(identity.sub,identity.email,identity.nickname,identity.picture??null);const token=randomToken();if(req.cookies[sessionName])await db.logout(req.cookies[sessionName]);await db.session(token,user.id);reply.setCookie(sessionName,token,{...options,maxAge:7*24*60*60});return reply.redirect(config.APP_ORIGIN+'/#/my-nikke');}catch{return reply.redirect(config.APP_ORIGIN+'/?auth=failed#/my-nikke');}
 });
 app.post('/api/logout',async(req,reply)=>{if(store&&req.cookies[sessionName])await store.logout(req.cookies[sessionName]);reply.clearCookie(sessionName,options);return {ok:true};});
 app.post('/api/accounts/challenge',async req=>{const user=await requireUser(req),code='MIMIR-'+randomBytes(6).toString('hex').toUpperCase();await store!.challenge(user.id,code);return {code,expiresIn:600};});
 app.post('/api/accounts/link',{config:{rateLimit:{max:10,timeWindow:'15 minutes'}}},async req=>{
  const user=await requireUser(req);const {url}=z.object({url:z.string().min(1).max(1024)}).parse(req.body);const openId=parseProfileUrl(url);const code=await store!.getChallenge(user.id);const lease=await store!.reserveSync(user.id);
  try{const profile=await provider.publicProfile(openId);if(!hasIntroCode(profile,code))throw new ApiError(422,'BLABLALINK 소개글에 표시된 확인 코드를 넣은 뒤 다시 시도해 주세요.');const data=await provider.collect(openId,profile);const id=await store!.saveProfile(user.id,openId,data,!!config.DILDORO_API_KEY);return store!.profile(user.id,id);}finally{await store!.releaseSync(user.id,lease);}
 });
 app.get('/api/accounts/:id',async req=>{const user=await requireUser(req);const {id}=accountParams.parse(req.params);return store!.profile(user.id,id);});
 app.post('/api/accounts/:id/select',async req=>{const user=await requireUser(req);const {id}=accountParams.parse(req.params);await store!.select(user.id,id);return {ok:true};});
 app.post('/api/accounts/:id/refresh',async req=>{
  const user=await requireUser(req);const {id}=accountParams.parse(req.params);const account=await store!.account(user.id,id);const lease=await store!.reserveSync(user.id);
  try{const publicProfile=await provider.publicProfile(account.open_id);const data=await provider.collect(account.open_id,publicProfile);await store!.saveProfile(user.id,account.open_id,data,!!config.DILDORO_API_KEY,true);return store!.profile(user.id,id);}finally{await store!.releaseSync(user.id,lease);}
 });
 let worldcupCatalog:Promise<Set<string>>|undefined;
 app.post('/api/worldcup/badge',{bodyLimit:32768},async req=>{
  const user=await requireUser(req);
  const ids=await(worldcupCatalog??=readFile(new URL('../public/data/nikkes.json',import.meta.url),'utf8').then(s=>new Set((JSON.parse(s) as {id:string}[]).map(n=>n.id))));
  if(!validWorldcup(req.body,ids))throw new ApiError(400,'월드컵 결과를 확인할 수 없어요.');const result=req.body;
  if(result.pool.length!==1||result.total!==ids.size)throw new ApiError(400,'전체 니케 월드컵을 끝까지 완료해 주세요.');
  const badgeId='worldcup_'+result.pool[0];await store!.db.transaction(async sql=>{
   await sql.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user.id]);
   const existing=await sql.query("SELECT badge_id FROM badge_unlocks WHERE user_id=$1 AND badge_id LIKE 'worldcup_%'",[user.id]);
   if(existing.rows.length===1&&existing.rows[0].badge_id===badgeId)return;
   await sql.query("UPDATE badge_showcases SET badge_ids=ARRAY(SELECT item FROM unnest(badge_ids) AS item WHERE item NOT LIKE 'worldcup_%') WHERE user_id=$1",[user.id]);
   await sql.query("DELETE FROM badge_unlocks WHERE user_id=$1 AND badge_id LIKE 'worldcup_%'",[user.id]);
   await sql.query('INSERT INTO badge_unlocks(user_id,badge_id) VALUES($1,$2)',[user.id,badgeId]);
  });return {badgeId};
 });
 app.get('/api/badges',async req=>{const user=await requireUser(req);return store!.badges(user.id);});
 app.post('/api/badges/display',async req=>{const user=await requireUser(req);const {badgeIds}=z.object({badgeIds:z.array(z.string().min(1).max(100)).max(10)}).parse(req.body);await store!.displayBadges(user.id,badgeIds);return {displayedBadgeIds:badgeIds};});
 app.post('/api/account/delete',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async(req,reply)=>{
  const user=await requireUser(req);z.object({confirmation:z.literal('탈퇴')}).parse(req.body);
  await store!.deleteUser(user.id);reply.clearCookie(sessionName,options);return {ok:true};
 });
 registerDeckRoutes(app,store,requireUser,sessionName);
 return app;
}
