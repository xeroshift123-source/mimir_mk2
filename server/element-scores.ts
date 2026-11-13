import {createRequire} from 'node:module';
import type {RawProfile,SavedScore} from '../shared/account.js';
const require=createRequire(import.meta.url);
const {TARGETS,POLICY_HASH}=require('./legacy/nikkeScoreAdapter.js') as {TARGETS:Map<string,{nameCode:number;weakness:string}>;POLICY_HASH:string};
export function elementTotals(profile:RawProfile,scores:Record<string,SavedScore>){
 const versions=new Set(Object.values(scores).filter(s=>s.status==='complete'&&s.policyHash===POLICY_HASH&&s.calcVersion).map(s=>s.calcVersion!));
 if(versions.size!==1)return [];
 const calcVersion=[...versions][0],owned=new Set(profile.characters.map(c=>c.name_code));
 return ['fire','water','wind','electric','iron'].flatMap(weakness=>{
  let damage=0;
  for(const [key,target] of TARGETS){
   if(target.weakness!==weakness||!owned.has(target.nameCode))continue;
   const result=scores[key];
   if(result?.status!=='complete'||result.policyHash!==POLICY_HASH||result.calcVersion!==calcVersion||!Number.isSafeInteger(result.damage)||result.damage!<0)return [];
   damage+=result.damage!;
  }
  return Number.isSafeInteger(damage)?[{weakness,damage,score:damage*5/1e8,policyHash:POLICY_HASH,calcVersion}]:[];
 });
}
