const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
// Load the small pure TS modules without bundling the browser app.
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);if(file.endsWith('.json'))module.exports=JSON.parse(fs.readFileSync(file,'utf8'));else{const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',output)(name=>load(path.resolve(path.dirname(file),name+(path.extname(name)?'':'.ts'))),module,module.exports);}return module.exports;}
const {emptyProfileFilters,filterAndSortRoster,level40Cp,overloadTotal,pyRound}=load('src/profile-controls.ts');
const {demoGrowth}=load('src/profile-data.ts');
const catalog=JSON.parse(fs.readFileSync('public/data/nikkes.json','utf8'));
const roster=demoGrowth(catalog);
assert.equal(roster.length,24);
const filters=emptyProfileFilters();filters.burst.add('1');
assert(filterAndSortRoster(roster,'',filters,'cp').some(g=>g.nikke.id==='red_hood'),'all-burst characters match any burst filter');
filters.burst.add('3');filters.element.add('Fire');filters.element.add('Iron');filters.company.add('Pilgrim');filters.weaponType.add('MG');
const found=filterAndSortRoster(roster,'',filters,'cp');assert(found.length);assert(found.every(g=>g.nikke.company==='Pilgrim'&&g.nikke.weaponType==='MG'));
const dual=emptyProfileFilters();dual.element.add('Iron');assert(filterAndSortRoster(roster,'라피',dual,'cp').some(g=>g.nikke.id==='rapi_red_hood'));
assert.equal(filterAndSortRoster(roster,'없는니케',emptyProfileFilters(),'cp').length,0);
for(const sort of ['uko','atk','ukoAtk']){const list=filterAndSortRoster(roster,'',emptyProfileFilters(),sort);assert(list.every((g,i)=>!i||overloadTotal(list[i-1],sort)>=overloadTotal(g,sort)));assert.equal(list[0].nikke.id,'rapi_red_hood','ties use combat power');}
assert.equal(level40Cp({...roster[0],equipment:[]}),null);
assert.equal(level40Cp({...roster[0],equipment:roster[0].equipment.map(e=>({...e,options:e.options.map(o=>({...o,tier:undefined}))}))}),null);
const fixture={...roster[0],nikke:{...roster[0].nikke,type:'ATK',weaponType:'AR'},grade:0,core:0,bond:1,research:{common:0,role:0,company:0},skills:[1,1,1],cube:null,collection:null,equipment:['머리','몸통','팔','다리'].map(name=>({name,level:0,options:[{name:'공격력',value:4.77,tier:1}]}))};
// Independent sums from the original level-40/base and equipment tables.
const expected=8701; // survival 357198 + attack 259328, coefficient 1.411277.
for(const [input,output] of [[2.5,2],[3.5,4],[4.499999,4],[4.500001,5],[-2.5,-2]])assert.equal(pyRound(input),output);
assert.equal(level40Cp(fixture,false),expected);
// Independent integer arithmetic covers all limit-break/core/equipment combinations.
const halfEven=(n,d)=>{const q=n/d,r=n%d;return Number(q+(r*2n>d||(r*2n===d&&q%2n===1n)?1n:0n));};
for(let grade=0;grade<=3;grade++)for(let core=0;core<=7;core++)for(let level=0;level<=5;level++){
 const sample={...fixture,grade,core,equipment:fixture.equipment.map(e=>({...e,level,options:[{name:'우월 코드',value:9.54,tier:1}]}))};
 const stat=(base,fixed,equip)=>{const lb=(BigInt(base)*BigInt(100+2*grade)+BigInt(fixed*grade*100))/100n;return (lb*BigInt(100+2*core)+BigInt(equip*(10+level)*10))/100n;};
 const hp=stat(41175,3000,245908)+19400n,atk=stat(1830,20,10934)+638n,def=stat(275,100,1635)+128n;
 const raw=7n*(hp+100n*def)/10n+atk*387n/20n;
 assert.equal(level40Cp(sample,false),halfEven(raw*1416877n,100000000n),'integer reference '+[grade,core,level]);
}
assert.equal(level40Cp({...roster[0],cube:null}),level40Cp({...roster[0],cube:{name:'재장전',level:1}}),'original assumes a level-15 cube');
assert(roster.every(g=>Number.isFinite(level40Cp(g))));
const cp40=filterAndSortRoster(roster,'',emptyProfileFilters(),'cp40');assert(cp40.every((g,i)=>!i||level40Cp(cp40[i-1])>=level40Cp(g)));
console.log('Passed: multi-select filters, dual elements, all bursts, search, overload sorts/ties, level-40 formula, missing data.');

const {licenseClass}=load('src/nikke-license.ts');
for(const [cp,label] of [[39999,'자전거 면허'],[40000,'1종 소형'],[49999,'1종 소형'],[50000,'1종 보통'],[59999,'1종 보통'],[60000,'1종 대형'],[69999,'1종 대형'],[70000,'1종 특수'],[79999,'1종 특수'],[80000,'AZX운용'],[89999,'AZX운용'],[90000,'어드마이어호 운용'],[99999,'어드마이어호 운용'],[100000,'승리의 날개호 운용'],[120000,'승리의 날개호 운용']])assert.equal(licenseClass(cp),label);
console.log('Passed: original license class boundaries.');

const {licenseScore}=load('src/nikke-license.ts');
assert.equal(licenseScore({score:null}),null);assert.equal(licenseScore({score:NaN}),null);assert.equal(licenseScore({score:0}),0);assert.equal(licenseScore({score:248.62}),248.62);
console.log('Passed: license score visibility, including zero and missing scores.');

const {overloadColorClass,sumOptions}=load('src/profile-data.ts');
assert.equal(overloadColorClass(11),'overload-normal');assert.equal(overloadColorClass(12),'overload-high');assert.equal(overloadColorClass(14),'overload-high');assert.equal(overloadColorClass(15),'overload-max');assert.equal(overloadColorClass(undefined),'overload-unknown');
const mixed={...roster[0],equipment:[{name:'머리',level:5,options:[{name:'공격력',value:4.77,tier:1},{name:'공격력',value:14.63,tier:15}]}]};
const total=sumOptions(mixed)[0];assert.equal(total.maxTier,15);assert.equal(total.count,2);assert.equal(overloadColorClass(total.maxTier),'overload-max');
console.log('Passed: in-game overload colors at tier boundaries and max-tier aggregation.');

const {OverloadSimulation,rollCost}=load('src/overload-simulator-model.ts');
let seed=271828;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const sim=new OverloadSimulation(roster[0],rng);const sourceSnapshot=JSON.stringify(roster[0]);
assert.equal(sim.cp,level40Cp(roster[0]));
sim.setLock(0,0,'module');assert.equal(sim.modulesUsed,2);sim.setLock(0,1,'key');assert.deepEqual(rollCost(sim.equipment[0]),{modules:3,keys:30});
const before=structuredClone(sim.equipment[0].slots);sim.roll(0,'value');assert.deepEqual(sim.equipment[0].slots.slice(0,2),before.slice(0,2));assert.notEqual(sim.equipment[0].slots[2].tier,before[2].tier);assert.equal(sim.modulesUsed,5);assert.equal(sim.keysUsed,30);
assert(sim.undo(0));assert.deepEqual(sim.equipment[0].slots,before);assert.equal(sim.modulesUsed,5);assert.equal(sim.keysUsed,30);assert(!sim.undo(0));
sim.reset();assert.equal(sim.modulesUsed,0);assert.equal(sim.keysUsed,0);assert.deepEqual(sim.growth().equipment[0].options,roster[0].equipment[0].options);
sim.setLock(0,0,'initial');assert.equal(sim.modulesUsed,0);sim.setLock(0,1,'module');assert.equal(sim.modulesUsed,3);sim.setLock(0,2,'key');assert.deepEqual(rollCost(sim.equipment[0]),{modules:4,keys:40});const spent=sim.modulesUsed;assert(!sim.roll(0,'effect'));assert.equal(sim.modulesUsed,spent);
sim.reset();sim.setLock(0,0,'module');sim.setLock(0,1,'module');sim.setLock(0,2,'module');assert.equal(sim.modulesUsed,9);sim.setLock(0,0,'none');assert.equal(sim.modulesUsed,9);
sim.reset();const counts=[0,0,0],present=[0,0,0];const runs=6000;
for(let i=0;i<runs;i++){sim.equipment[0].slots=Array.from({length:3},()=>({type:null,tier:null,lock:'none'}));sim.roll(0,'effect');const slots=sim.equipment[0].slots;const types=slots.filter(s=>s.type).map(s=>s.type);assert.equal(new Set(types).size,types.length);slots.forEach((s,j)=>{if(s.type)present[j]++;});const tier=slots[0].tier;counts[tier<=5?0:tier<=10?1:2]++;}
assert.equal(present[0],runs);assert(Math.abs(present[1]/runs-.5)<.03);assert(Math.abs(present[2]/runs-.3)<.03);[.6,.35,.05].forEach((prob,i)=>assert(Math.abs(counts[i]/runs-prob)<.03));
assert.equal(JSON.stringify(roster[0]),sourceSnapshot);assert(sim.cp!==null);assert(sim.growth().equipment.every(e=>e.tier===10));
console.log('Passed: simulation isolation, locked slots, module/key costs, paid undo, reset, non-duplicate effects and seeded probability bands.');

const {profileGrowth}=load('src/account-profile.ts');const known=roster[0];
const apiProfile={account:{id:'test',nickname:'실제 데이터 형식',server:'한국',updatedAt:new Date().toISOString(),selected:true},scoreStatus:'complete',scores:{saved:{status:'complete',nameCode:known.nikke.blablaNameCode,weakness:known.nikke.element.toLowerCase(),score:123.45,calcVersion:'test'}},profile:{nickname:'데이터 지휘관',server:'한국',union:'길드',synchroLevel:321,ownedNikkesCount:1,recycleRoomComplete:true,recycleRoom:[1001,1101,1102,1103,1201,1202,1203,1204,1205].map(tid=>({tid,lv:77})),characters:[{name_code:known.nikke.blablaNameCode,level:321,combat:98765,grade:3,core:2,bondLevel:30,skills:{skill1:8,skill2:9,burst:10},favoriteItem:{tid:100002,level:7},harmonyCube:{tid:1000303,level:12},growthDataQuality:{schemaVersion:1,complete:true,missingFields:[]},equipment:[{slot:'head',tid:3111001,tier:10,level:5,overloadOptions:[0,7000801,0]}]}]}};
const imported=profileGrowth(apiProfile,catalog);assert.equal(imported.skipped,0);assert.equal(imported.roster[0].isDemo,false);assert.equal(imported.roster[0].cp,98765);assert.equal(imported.roster[0].score,123.45);assert.equal(imported.roster[0].research.common,77);assert.equal(imported.roster[0].cube.name,'재장전');assert.equal(imported.roster[0].equipment[0].options[0].slotIndex,1);
const sparse=new OverloadSimulation(imported.roster[0]);assert.equal(sparse.equipment[0].slots[0].type,null);assert.equal(sparse.equipment[0].slots[1].type,'공격력');
const incomplete=structuredClone(apiProfile);incomplete.profile.characters[0].growthDataQuality.complete=false;assert.equal(profileGrowth(incomplete,catalog).skipped,1);
const noResearch=structuredClone(apiProfile);noResearch.profile.recycleRoom=[];assert.equal(level40Cp(profileGrowth(noResearch,catalog).roster[0]),null);
console.log('Passed: live account mapping, saved score, research, cube labels, sparse overload slots and missing growth.');

const favoriteProfile=structuredClone(apiProfile);favoriteProfile.profile.characters[0].favoriteItem={tid:200001,level:2};assert.equal(profileGrowth(favoriteProfile,catalog).roster[0].collection.level,3);

const {buildRecap,skillInvestment}=load('src/recap-data.ts');
assert.deepEqual(buildRecap([],'empty'),[]);
const cost=skillInvestment([{...roster[0],skills:[10,10,10]}]);
assert.deepEqual(cost.skill,[2188,1550,630]);assert.deepEqual(cost.burst,[1094,775,315]);assert.equal(cost.attribute,1440);assert.equal(cost.total,7992);
assert.equal(skillInvestment([{...roster[0],skills:[1,1,1]}]).total,0);
const recap=buildRecap(roster,'stable');assert.equal(recap.at(-1).title,buildRecap([...roster].reverse(),'stable').at(-1).title);
assert(recap.every(c=>!c.title.includes('NaN')));assert(!recap.some(c=>c.title.includes('코스튬')||c.title.includes('모든 이야기')));
console.log('Passed: recap chip costs, empty data, stable soulmate, unsupported data omission.');

assert.equal(recap[0].detail,'');assert.deepEqual(recap[0].colors,['#20C6AD','#087D82']);
assert.equal(recap[1].title,'그중 3명의 니케의\n잠재력을 끝까지 폭발시켰어요');
assert.equal(recap.at(-2).eyebrow,'ONE LAST STORY');assert.equal(recap.at(-1).eyebrow,'DESTINED PARTNER');
assert.equal(recap.at(-1).detail,'');assert(recap.at(-1).title.startsWith('당신의 천생연분 니케는...\n'));
assert.equal(recap.find(c=>c.eyebrow==='SKILL INVESTMENT').textColor,'#201D18');
console.log('Passed: original recap copy, intro sequence, per-card colors and detail omissions.');

// Restored recap cards use saved metadata; missing values never become invented counts.
const {recapDate,recapStoryComplete}=load('src/recap-data.ts');
const context={profile:{joinedAt:'20241115',normalCampaign:6048044,costumeCount:0},now:new Date('2026-11-16T03:00:00Z'),elementScores:{fire:{score:500,sampleCount:100,average:200,topPercent:8},water:{score:900,sampleCount:100,average:100,topPercent:20},iron:{score:1000,sampleCount:19,average:200,topPercent:1}}};
const restored=buildRecap(roster,'stable',context);
const first=restored.find(c=>c.eyebrow==='OUR FIRST ENCOUNTER');assert(first.title.startsWith('마리안과 처음 만난 지'));assert(first.title.includes('731일'));assert.equal(first.image,'/assets/nikke/marian.webp');
assert.equal(restored.find(c=>c.eyebrow==='STORY COMPLETE').image,'/assets/nikke/marian_queen.webp');
assert(restored.find(c=>c.eyebrow==='MIMIR SCORE').title.includes('작열 속성 미미르 스코어'));assert(restored.find(c=>c.eyebrow==='FASHION COLLECTION').title.includes('0개'));assert.equal(restored.find(c=>c.eyebrow==='FASHION COLLECTION').image,'/assets/nikke/rupee.webp');
for(const value of [6048044,'NORMAL 48-36',{chapter:48,stage:36},{id:6048044}])assert(recapStoryComplete(value));
for(const value of [null,0,'48-35',{}])assert(!recapStoryComplete(value));
for(const value of ['20241115','2024-11-15T00:00:00Z',1731628800,1731628800000,{seconds:1731628800},{_seconds:1731628800},{toDate:()=>new Date('2024-11-15T00:00:00Z')}])assert.equal(recapDate(value).toISOString().slice(0,10),'2024-11-15');
for(const value of [null,'','bad','20240230'])assert.equal(recapDate(value),null);
const missing=buildRecap(roster,'stable',{profile:{costumeCount:null},elementScores:{fire:{score:12,sampleCount:100,average:1,topPercent:null}}});assert(!missing.some(c=>['OUR FIRST ENCOUNTER','STORY COMPLETE','FASHION COLLECTION','MIMIR SCORE'].includes(c.eyebrow)));
assert(buildRecap(roster,'stable',{profile:{joinedAt:'2099-01-01'},now:context.now})[0].title.includes('0일'));
console.log('Passed: restored recap metadata, legacy dates, campaign formats, valid score rankings and missing-data handling.');
