import {test} from 'node:test';
import assert from 'node:assert/strict';
import {linkedIds,savedBadges,savedDeck,legacyDeck,savedProfile,linkedAccount} from '../src/firebase-mapping';

test('old single-openId and multi-account documents remain compatible',()=>{
 assert.deepEqual(linkedIds({linkedOpenIds:['kr-a','kr-b','kr-a'],openId:'kr-a'}),['kr-a','kr-b']);
 assert.deepEqual(linkedIds({openId:'legacy-account'}),['legacy-account']);
 assert.equal(linkedAccount('kr-a',{nickname:'기존 지휘관',lastUpdatedAt:{toDate:()=>new Date('2026-11-01')}},'kr-a').updatedAt,'2026-11-01T00:00:00.000Z');
});
test('stored scores preserve policy, status, quality, equipment and costume metadata',()=>{
 const character={name_code:5185,costumeId:123,growthDataQuality:{complete:false,missingFields:['skill1_lv']},equipment:[{slot:'head',overloadOptions:[7000515]}]};
 const result=savedProfile(linkedAccount('kr-a',{},'kr-a'),{characters:[character],recycleRoom:[],recycleRoomComplete:false},{status:'partial',results:{'5185:fire':{status:'error',error:'수집 정보 부족'},'5169:electric':{status:'complete',score:123.45,policyHash:'original',calcVersion:'v1',topPercent:null}},elements:[{key:'fire',score:null},{key:'electric',score:120,sampleCount:2,topPercent:null}]});
 assert.deepEqual(result.profile.characters[0],character);
 assert.equal(result.scores['5185:fire'].nameCode,5185);
 assert.equal(result.scores['5169:electric'].policyHash,'original');
 assert.equal(result.scores['5169:electric'].topPercent,null);
 assert.equal(result.nikkeComparisons?.['5169:electric'].nameCode,5169);
 assert.equal(result.nikkeComparisons?.['5169:electric'].score,123.45);
 assert.equal(result.nikkeComparisons?.['5169:electric'].average,null);
 assert.equal(result.nikkeComparisons?.['5185:fire'],undefined);
 assert.equal(result.elementScores?.fire,undefined);
 assert.equal(result.elementScores?.electric.topPercent,null);
});
test('Firestore squad maps and legacy arrays map without changing IDs or names',()=>{
 const old={title:'기존 덱',authorUid:'uid',raidType:'union',season:'26년 11월',squadNames:['작열','수냉','철갑'],squadsNikkeIds:[{nikkeIds:['a','b','c','d','e']},['f','g','h','i','j'],{nikkeIds:['k','l','m','n','o']}],squadWeaknessElements:['Fire','Water','Iron'],createdAt:{toDate:()=>new Date('2026-11-01')},upvotes:4,downvotes:1};
 const post=savedDeck('original-id',old);
 assert.equal(post.id,'original-id');assert.equal(post.authorId,'uid');assert.deepEqual(post.deck.squads[1],old.squadsNikkeIds[1]);
 const output=legacyDeck(post,'uid','지휘관');assert.deepEqual(output.squadsNikkeIds[0],old.squadsNikkeIds[0]);assert.deepEqual(output.squadNames,old.squadNames);
});
test('Firebase rules compatibility rejects oversized descriptions and incomplete squads',()=>{
 const post=savedDeck('id',{title:'테스트',raidType:'union',squadsNikkeIds:[]});
 assert.throws(()=>legacyDeck(post,'uid','지휘관'),/5명/);
 assert.throws(()=>legacyDeck({...post,description:'a'.repeat(1201)},'uid','지휘관'),/1,200/);
});
test('badges retain acquired timestamps and only display earned IDs up to server limit',()=>{
 const badgeUnlocks=Object.fromEntries(['a','b','c','d','e'].map(id=>[id,{acquiredAt:'2026-11-01'}]));
 const result=savedBadges({badgeUnlocks,displayedBadgeIds:['unearned','a','b','c','d','e']});
 assert.equal(result.unlocks[0].acquiredAt,'2026-11-01T00:00:00.000Z');assert.deepEqual(result.displayedBadgeIds,['a','b','c','d','e']);
});

test('server population averages include unowned targets without inventing personal scores',()=>{const result=savedProfile(linkedAccount('id',{},'id'),{}, {comparisons:{'1:fire':{nameCode:1,weakness:'fire',score:null,average:123.4,topPercent:null,sampleCount:100}}});assert.equal(result.nikkeComparisons?.['1:fire'].average,123.4);assert.equal(result.nikkeComparisons?.['1:fire'].score,null);});
