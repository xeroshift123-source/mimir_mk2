// Explicit read-only production connectivity check; excluded from the normal test glob.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deleteApp,getApps} from 'firebase/app';
import {getFirestore,doc,getDoc} from 'firebase/firestore/lite';
import {firebaseApi} from '../src/firebase-client';
import {firebaseFunctionsBase,firebaseDatabaseId} from '../src/firebase-config';
try{
 const start=performance.now();
 const session=await firebaseApi('/session');assert.equal(session.configured,true);assert.equal(session.user,null);
 const latest=await firebaseApi('/decks?sort=latest&offset=0');assert.ok(Array.isArray(latest.items));
 const catalog=JSON.parse(await readFile(new URL('../public/data/nikkes.json',import.meta.url),'utf8'));
 const known=new Set(catalog.map((n:any)=>n.id));
 const missing=[...new Set(latest.items.flatMap((d:any)=>d.deck.squads.flat()).filter((id:any)=>id&&!known.has(id)))];
 assert.deepEqual(missing,[],'Existing public decks must resolve to catalog characters');
 const ranked=await firebaseApi('/decks?sort=score&offset=0');
 for(let i=1;i<ranked.items.length;i++)assert.ok(ranked.items[i-1].upvotes-ranked.items[i-1].downvotes>=ranked.items[i].upvotes-ranked.items[i].downvotes);
 if(latest.items[0]){const d=latest.items[0];const filtered=await firebaseApi('/decks?'+new URLSearchParams({sort:'latest',season:d.season,type:d.deck.type,offset:'0'}));assert.ok(filtered.items.every((r:any)=>r.season===d.season&&r.deck.type===d.deck.type));}
 await assert.rejects(()=>firebaseApi('/accounts/not-linked'),/연동된/);
 await assert.rejects(()=>getDoc(doc(getFirestore(getApps()[0],firebaseDatabaseId),'users','mimir-mk2-access-check-nonexistent')),(error:any)=>error.code==='permission-denied');
 const denied=await fetch(firebaseFunctionsBase+'getNikkeScores',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5173'},body:JSON.stringify({openId:'mimir-mk2-access-check-nonexistent'})});assert.equal(denied.status,401);
 console.log(JSON.stringify({backend:'Firebase mimirdb',publicDecks:latest.items.length,unresolvedNikkes:missing.length,ranking:true,seasonFilter:true,privateReadDenied:true,functionsRejectUnauthenticated:true,elapsedMs:Math.round(performance.now()-start)}));
}finally{await Promise.all(getApps().map(deleteApp));}
