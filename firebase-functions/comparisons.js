'use strict';
const {saveDisplay,publicShowcase}=require('./badge-display');
const {POLICY_HASH,TARGETS}=require('./nikkeScoreAdapter');
function comparison(target,distribution,item,now=Date.now()){
 const valid=distribution?.policyHash===POLICY_HASH&&Number.isFinite(distribution.generatedAtMs)&&distribution.generatedAtMs<=now&&now-distribution.generatedAtMs<86400000;
 const values=valid&&Array.isArray(distribution.damages)?distribution.damages.filter(n=>Number.isSafeInteger(n)&&n>=0):[];
 const own=item?.status==='complete'&&item.policyHash===POLICY_HASH&&item.calcVersion===distribution?.calcVersion&&Number.isFinite(item.damage)&&item.damage>=0;
 const sufficient=values.length>=20;
 return {nameCode:target.nameCode,weakness:target.weakness,score:own?item.score:null,sampleCount:values.length,
  average:sufficient?values.reduce((mean,n,i)=>mean+(n-mean)/(i+1),0)*5/1e8:null,
  topPercent:own&&sufficient?(values.filter(n=>n>item.damage).length+values.filter(n=>n===item.damage).length*.5)/values.length*100:null};
}
function createHandler({db,verifyIdToken}){return async(req,res)=>{
 res.set('Access-Control-Allow-Origin',req.headers.origin||'*');res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type, Authorization');res.set('Access-Control-Allow-Methods','POST, OPTIONS');res.set('Cache-Control','no-store');
 if(req.method==='OPTIONS')return res.status(204).send('');if(req.method!=='POST')return res.status(405).json({success:false,error:'Method Not Allowed'});
 if(req.path==='/badges/showcase'){try{return res.status(200).json({success:true,...await publicShowcase(db,req.body?.uid)});}catch(error){return res.status(error.status||500).json({success:false,error:error.status?error.message:'전시 뱃지를 불러오지 못했어요.'});}}
 let uid;try{const h=req.headers.authorization||'';if(h.startsWith('Bearer '))uid=(await verifyIdToken(h.slice(7))).uid;}catch(error){return res.status(401).json({success:false,error:'인증 확인 실패: '+(error.code||'unknown')});}
 if(!uid)return res.status(401).json({success:false,error:'로그인이 필요합니다.'});
 if(req.path==='/badges/display'){try{return res.status(200).json({success:true,displayedBadgeIds:await saveDisplay(db,uid,req.body?.badgeIds)});}catch(error){return res.status(error.status||500).json({success:false,error:error.status?error.message:'전시 뱃지를 저장하지 못했어요.'});}}
 if(req.path==='/decks/votes'){const ids=req.body?.deckIds;if(!Array.isArray(ids)||ids.length>20||ids.some(id=>typeof id!=='string'||!id||id.includes('/')))return res.status(400).json({success:false,error:'덱 목록을 확인해 주세요.'});try{const snapshots=ids.length?await db.getAll(...ids.map(id=>db.collection('shared_decks').doc(id).collection('votes').doc(uid))):[];return res.status(200).json({success:true,votes:Object.fromEntries(ids.map((id,i)=>[id,[-1,1].includes(snapshots[i].data()?.value)?snapshots[i].data().value:0]))});}catch{return res.status(500).json({success:false,error:'추천 상태를 불러오지 못했어요.'});}}
 const openId=req.body?.openId;if(typeof openId!=='string'||!openId||openId.length>256||openId.includes('/'))return res.status(400).json({success:false,error:'지휘관을 확인해 주세요.'});
 try{
  const [binding,user]=await db.getAll(db.collection('open_id_bindings').doc(openId),db.collection('users').doc(uid));
  const bound=binding.data()?.uid,u=user.data()||{};if(bound?bound!==uid:!(u.openId===openId||u.linkedOpenIds?.includes(openId)))return res.status(403).json({success:false,error:'연동된 지휘관만 조회할 수 있어요.'});
  const targets=[...TARGETS.entries()];const [saved,...distributions]=await db.getAll(db.collection('nikke_score_results').doc(openId),...targets.map(([key])=>db.collection('nikke_score_distributions').doc(key)));
  const results=saved.data()?.results||{};
  return res.status(200).json({success:true,data:Object.fromEntries(targets.map(([key,target],i)=>[key,comparison(target,distributions[i].data(),results[key])]))});
 }catch(error){console.error('Score comparison read failed:',error.code||'internal');return res.status(500).json({success:false,error:'평균 스코어를 불러오지 못했어요.'});}
};}
module.exports={comparison,createHandler};
