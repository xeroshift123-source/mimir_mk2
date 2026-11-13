import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import type {SavedScore} from '../shared/account.js';
import type {Store} from './store.js';
const require=createRequire(import.meta.url);
// Pure original scoring policy/adapter only. No Firebase runtime or MK1 writes.
const {TARGETS,POLICY_HASH,buildScoreItem,requestBody,inputHash}=require('../server/legacy/nikkeScoreAdapter.js');
interface Target{key:string;nameCode:number;weakness:string;teamNames:string[]}
interface ScoreItem{id:string;[key:string]:unknown}
interface DamageItem{id:string;damage?:number;error?:{code?:string}}
interface DamageResponse{calc_version:string;items:DamageItem[]}
async function calculate(key:string,items:ScoreItem[],apiKey:string):Promise<DamageResponse>{
 const scenarios:DamageResponse[]=[];
 for(const size of [0,100]){
  const response=await fetch('https://dildoro.com/api/partner/v1/damage',{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','X-Api-Key':apiKey,'User-Agent':'MIMIR-MK2/1.0'},body:JSON.stringify(requestBody(key,items,size))});
  if(!response.ok)throw Error('스코어 계산 서버에 연결하지 못했어요. 다음 동기화에서 다시 계산합니다.');
  const result=await response.json() as DamageResponse;
  if(typeof result.calc_version!=='string'||!result.calc_version||!Array.isArray(result.items)||result.items.length!==items.length)throw Error('스코어 계산 응답 형식이 올바르지 않아요.');
  const expected=new Set(items.map(i=>i.id)),seen=new Set();for(const item of result.items){if(!expected.has(item.id)||seen.has(item.id)||(!item.error&&(!Number.isSafeInteger(item.damage)||item.damage!<0)))throw Error('스코어 계산 결과가 요청과 일치하지 않아요.');seen.add(item.id);}scenarios.push(result);
 }
 if(scenarios[0].calc_version!==scenarios[1].calc_version)throw Error('계산 도중 버전이 변경됐어요. 다음 동기화에서 다시 계산합니다.');
 const cores=new Map(scenarios[1].items.map(i=>[i.id,i]));return {calc_version:scenarios[0].calc_version,items:scenarios[0].items.map(item=>{const core=cores.get(item.id)!;return item.error?item:core.error?core:{id:item.id,damage:Math.round(item.damage!/2+core.damage!/2)};})};
}
export async function scoreOnce(store:Store,apiKey:string,transport=calculate){
 const owner=randomUUID();if(!await store.acquireScoreLease(owner))return false;
 try{
  const job=await store.claimScoreJob();if(!job)return false;
  const results:Record<string,SavedScore>={},groups=new Map<string,{key:string;target:Target;item:ScoreItem}[]>(),owned=new Set(job.profile.characters.map(c=>c.name_code));
  for(const [key,target] of TARGETS as Map<string,Target>){if(!owned.has(target.nameCode))continue;try{const row={key,target,item:buildScoreItem(job.profile,key,randomUUID())};groups.set(target.weakness,[...(groups.get(target.weakness)??[]),row]);}catch{results[key]={status:'error',nameCode:target.nameCode,weakness:target.weakness,error:'스코어 계산에 필요한 육성 정보가 부족해요.'};}}
  for(const group of groups.values())for(let start=0;start<group.length;start+=100){const rows=group.slice(start,start+100);try{const response=await transport(rows[0].key,rows.map(r=>r.item),apiKey);const returned=new Map(response.items.map(item=>[item.id,item]));for(const {key,item,target} of rows){const result=returned.get(item.id);results[key]=result&&!result.error&&Number.isSafeInteger(result.damage)&&result.damage!>=0?{status:'complete',nameCode:target.nameCode,weakness:target.weakness,damage:result.damage,score:result.damage!*5/100000000,policyHash:POLICY_HASH,calcVersion:response.calc_version,team:target.teamNames,sampleCount:0,average:null,topPercent:null}:{status:'error',nameCode:target.nameCode,weakness:target.weakness,error:'이 조합의 스코어를 계산하지 못했어요.'};void inputHash(item,key);}}catch{for(const {key,target} of rows)results[key]={status:'error',nameCode:target.nameCode,weakness:target.weakness,error:'스코어 계산이 지연됐어요. 다음 동기화에서 다시 계산합니다.'};}}
  await store.saveScores(job.id,job.revision,results,Object.values(results).some(r=>r.status==='error')?'partial':'complete');return true;
 }finally{await store.releaseScoreLease(owner);}
}
export function startScoreWorker(store:Store,apiKey:string){let stopped=false,timer:NodeJS.Timeout|undefined;const tick=async()=>{try{await scoreOnce(store,apiKey);}catch{/* Failures never log API keys, request bodies or account records. */}finally{if(!stopped){timer=setTimeout(()=>void tick(),5000);timer.unref();}}};void tick();return ()=>{stopped=true;if(timer)clearTimeout(timer);};}
