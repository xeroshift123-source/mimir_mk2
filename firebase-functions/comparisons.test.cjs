const {test}=require('node:test');const assert=require('node:assert/strict');const {comparison,createHandler}=require('./comparisons');const {POLICY_HASH}=require('./nikkeScoreAdapter');
test('element and Nikke ranks share the valid population and give ties the same place',async()=>{
 const {TARGETS}=require('./nikkeScoreAdapter');
 const [key,target]=[...TARGETS].find(([,entry])=>entry.weakness==='fire');
 const item={status:'complete',policyHash:POLICY_HASH,calcVersion:'previous',damage:100,score:0.000005};
 const distribution={policyHash:POLICY_HASH,calcVersion:'v',generatedAtMs:Date.now(),damages:[101,102,100,100,...Array(296).fill(99)]};
 const documents={
  'open_id_bindings/a':{uid:'u'},
  'commanders/a':{scoreSyncId:'s',lastUpdatedAt:{toMillis:()=>Date.now()},characters:[{name_code:target.nameCode}]},
  'nikke_score_results/a':{status:'complete',syncId:'s',results:{[key]:item}},
  ['nikke_score_distributions/'+key]:distribution,
  'nikke_score_distributions/element-fire':distribution,
 };
 const db={collection:name=>({doc:id=>name+'/'+id}),getAll:async(...keys)=>keys.map(id=>({data:()=>documents[id]}))};
 const handler=createHandler({db,verifyIdToken:async()=>({uid:'u'})});
 const res={set(){},status(code){this.code=code;return this;},json(body){this.body=body;}};
 const req={method:'POST',headers:{authorization:'Bearer test'},body:{openId:'a'}};
 await handler(req,res);
 assert.equal(res.code,200);
 assert.equal(res.body.syncId,'s');
 assert.equal(res.body.data[key].rank,3);
 assert.deepEqual(res.body.elementRanks.fire,{rank:3,sampleCount:300,topPercent:1});
 documents['commanders/a'].lastUpdatedAt=Date.now()-31*86400000;
 await handler(req,res);
 assert.equal(res.body.data[key].rank,null);
 assert.equal(res.body.data[key].average!==null,true);
 documents['commanders/a'].lastUpdatedAt=Date.now();
 documents['commanders/a'].scoreSyncId='new-sync';
 await handler(req,res);
 assert.equal(res.body.elementRanks.fire.rank,null);
 assert.equal(res.body.data[key].rank,null);
});
test('means use the same score conversion and accept scores across calculation versions',()=>{const now=Date.now(),d={policyHash:POLICY_HASH,calcVersion:'v',generatedAtMs:now,damages:Array(20).fill(1e8)};const item={status:'complete',policyHash:POLICY_HASH,calcVersion:'v',score:5,damage:1e8};assert.equal(comparison({nameCode:1,weakness:'fire'},d,item,now).average,5);assert.equal(comparison({},d,item,now).topPercent,50);assert.equal(comparison({},d,{...item,calcVersion:'old'},now).topPercent,50);assert.equal(comparison({},{...d,damages:[1e8]},item,now).average,null);assert.equal(comparison({},{...d,generatedAtMs:now-86400001},item,now).average,null);});
test('anonymous readers never query private data',async()=>{let reads=0;const h=createHandler({db:{getAll(){reads++;}},verifyIdToken:async()=>{throw Error();}});const res={set(){},status(n){this.code=n;return this;},json(){}};await h({method:'POST',headers:{},body:{openId:'a'}},res);assert.equal(res.code,401);assert.equal(reads,0);});
