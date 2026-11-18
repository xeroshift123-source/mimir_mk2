import {initializeApp} from 'firebase/app';
import {firebaseConfig,firebaseDatabaseId,firebaseFunctionsBase} from './firebase-config';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,reauthenticateWithPopup,onAuthStateChanged} from 'firebase/auth';
import {getFirestore,doc,getDoc,setDoc,updateDoc,collection,getDocs,query,orderBy,limit,startAfter,serverTimestamp,type QueryDocumentSnapshot} from 'firebase/firestore/lite';
import type {AccountSession,AccountProfile,AccountUser,RawCharacter} from '../shared/account';
import type {SharedDeckInput} from '../shared/decks';
import {linkedIds,linkedAccount,savedProfile,savedBadges,savedDeck,legacyDeck,type LegacyRecord} from './firebase-mapping';

// Public web-app configuration from the existing Flutter app; not an Admin credential.
const app=initializeApp(firebaseConfig);
const auth=getAuth(app),db=getFirestore(app,firebaseDatabaseId);
const functionBase=firebaseFunctionsBase;
const provider=()=>{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return p;};
let userData:LegacyRecord={},commanders=new Map<string,LegacyRecord>();
const profiles=new Map<string,AccountProfile>(),votes=new Map<string,number>();
let scope='';
function resetScope(){const uid=auth.currentUser?.uid??'';if(uid!==scope){scope=uid;userData={};commanders.clear();profiles.clear();votes.clear();}}
export async function firebaseLogin(){try{const {user}=await signInWithPopup(auth,provider());const ref=doc(db,'users',user.uid);const existing=await getDoc(ref);if(!existing.exists())await setDoc(ref,{uid:user.uid,email:user.email,photoUrl:user.photoURL,provider:'google',displayName:user.displayName,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}catch(e){throw friendly(e);}}
export function watchFirebaseAuth(listener:(user:AccountUser|null)=>void){
 return onAuthStateChanged(auth,user=>{
  resetScope();
  listener(user?{id:user.uid,nickname:user.displayName||'지휘관',email:user.email,picture:user.photoURL}:null);
 });
}
function requireUser(){resetScope();const user=auth.currentUser;if(!user)throw Error('Google 계정으로 로그인해 주세요.');return user;}
function friendly(error:unknown):Error{
 const code=(error as {code?:string})?.code;
 const messages:Record<string,string>={'auth/unauthorized-domain':'현재 주소가 Firebase 로그인 허용 도메인에 등록되어 있지 않아요. Firebase 인증 설정에 이 주소를 추가해 주세요.','auth/popup-blocked':'로그인 팝업이 차단됐어요. 팝업을 허용한 뒤 다시 눌러 주세요.','auth/popup-closed-by-user':'로그인 창을 닫았어요.','permission-denied':'이 계정으로 읽거나 수정할 권한이 없어요. 기존 미미르 연동 계정을 확인해 주세요.','unavailable':'Firebase 연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'};
 return Error(messages[code??'']??(error instanceof Error?error.message:'Firebase 요청을 처리하지 못했어요.'));
}
async function callFunction(name:string,body:unknown={},authenticated=true):Promise<LegacyRecord>{
 const started=performance.now();
 const token=authenticated?await requireUser().getIdToken():null;
 let response:Response;
 try{response=await fetch(functionBase+name,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(name==='scrapeNikkeProfile'?540000:60000)});}catch{throw Error('Firebase 서버 연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');}
 let data:LegacyRecord;try{data=await response.json();}catch{throw Error('Firebase 서버 응답을 읽지 못했어요.');}
 if(name.includes('DisplayedBadges')||name.includes('/badges/'))console.info('뱃지 저장 API',name,Math.round(performance.now()-started)+'ms');
 if(!response.ok||data.success!==true)throw Error(data.error??'요청을 처리하지 못했어요.');return data;
}
async function session():Promise<AccountSession>{
 await auth.authStateReady();resetScope();const user=auth.currentUser;
 if(!user)return {configured:true,user:null,accounts:[]};
 const snapshot=await getDoc(doc(db,'users',user.uid));if(auth.currentUser?.uid!==user.uid)throw Error('로그인 계정이 변경되었어요. 다시 조회해 주세요.');userData=snapshot.data()??{};
 const ids=linkedIds(userData),selected=ids.includes(userData.selectedOpenId)?userData.selectedOpenId:ids.includes(userData.openId)?userData.openId:ids[0];
 // Reuse snapshots within the session; only explicit refresh collects game data.
 await Promise.all(ids.filter(id=>!commanders.has(id)).map(async id=>{const snapshot=await getDoc(doc(db,'commanders',id));if(auth.currentUser?.uid!==user.uid)throw Error('로그인 계정이 변경되었어요.');commanders.set(id,snapshot.data()??{});}));
 const accounts=ids.map(id=>linkedAccount(id,commanders.get(id)!,selected));
 const commander=commanders.get(selected);
 const commanderSummary=commander&&{nickname:commander.nickname||'지휘관 정보 없음',server:commander.server||'알 수 없음',commanderLevel:commander.commanderLevel,ownedNikkesCount:commander.ownedNikkesCount,synchroLevel:commander.synchroLevel};
 return {configured:true,user:{id:user.uid,nickname:String(userData.nickname||userData.displayName||user.displayName||'지휘관'),email:user.email,picture:user.photoURL},accounts,commanderSummary};
}
async function syncCommander(id:string,uid:string,initial:LegacyRecord,showGrowth?:(commander:LegacyRecord)=>void){
 let stop:(()=>void)|undefined,finished=false,observed:LegacyRecord|undefined;
 const publish=(commander:LegacyRecord)=>{
  if(auth.currentUser?.uid!==uid||commander.scoreSyncId===initial.scoreSyncId||commander.scoreSyncId===observed?.scoreSyncId)return;
  observed=commander;
  showGrowth?.(commander);
 };
 // Watch the document committed by the existing sync function while it finishes scoring.
 if(showGrowth)void import('firebase/firestore').then(({getFirestore,doc,onSnapshot})=>{
  if(finished||auth.currentUser?.uid!==uid)return;
  const ref=doc(getFirestore(app,firebaseDatabaseId),'commanders',id);
  stop=onSnapshot(ref,{includeMetadataChanges:true},snapshot=>{
   const commander=snapshot.data();
   if(!finished&&!snapshot.metadata.fromCache&&typeof commander?.scoreSyncId==='string')publish(commander);
  },()=>{/* The completed request falls back to a one-time read. */});
 }).catch(()=>{});
 try{
  const response=await callFunction('scrapeNikkeProfile',{openId:id,refresh:true});
  if(auth.currentUser?.uid!==uid)throw Error('로그인 계정이 변경되었어요.');
  if(observed&&observed.scoreSyncId===response.data?.scoreSyncId)return observed;
  const snapshot=await getDoc(doc(db,'commanders',id)),commander=snapshot.data();
  if(!commander||auth.currentUser?.uid!==uid)throw Error('갱신된 지휘관 정보를 읽지 못했어요.');
  publish(commander);
  return commander;
 }finally{
  finished=true;
  stop?.();
 }
}
async function profile(id:string,refresh=false,onGrowth?:(profile:AccountProfile)=>void):Promise<AccountProfile>{
 const user=requireUser();
 if(!commanders.has(id))await session();
 const ids=linkedIds(userData);
 if(auth.currentUser?.uid!==user.uid||!ids.includes(id)||!commanders.has(id))throw Error('연동된 지휘관만 조회할 수 있어요.');
 const selected=ids.includes(userData.selectedOpenId)?userData.selectedOpenId:ids.includes(userData.openId)?userData.openId:ids[0];
 let commander=commanders.get(id)!;
 if(refresh){
  const showGrowth=onGrowth&&((data:LegacyRecord)=>{
   commanders.set(id,data);
   onGrowth(savedProfile(linkedAccount(id,data,selected),data,{status:'running'}));
  });
  commander=await syncCommander(id,user.uid,commander,showGrowth);
  commanders.set(id,commander);
 }
 const comparisonRequest=callFunction('getMimirScoreComparisons',{openId:id}).catch(error=>{console.warn('평균 스코어 조회:',error.message);return null;});
 let result:LegacyRecord;try{result=await callFunction('getNikkeScores',{openId:id});}catch(error){result={data:{status:'error',results:{}},scoreError:(error as Error).message};}
 const comparisons=await comparisonRequest;if(comparisons)result.data.comparisons=comparisons.data;
 if(auth.currentUser?.uid!==user.uid)throw Error('로그인 계정이 변경되었어요.');
 if(refresh&&commander.scoreSyncId&&result.data?.syncId&&commander.scoreSyncId!==result.data.syncId){
  const snapshot=await getDoc(doc(db,'commanders',id)),latest=snapshot.data();
  if(auth.currentUser?.uid!==user.uid)throw Error('로그인 계정이 변경되었어요.');
  if(!latest||latest.scoreSyncId!==result.data.syncId)throw Error('지휘관 정보가 다시 갱신됐어요. 저장된 정보를 다시 확인해 주세요.');
  commander=latest;
  commanders.set(id,commander);
 }
 const value=savedProfile(linkedAccount(id,commander,selected),commander,result.data??{});
 if(result.scoreError)value.scoreError=result.scoreError;
 if(!comparisons)value.comparisonUnavailable=true;
 profiles.set(id,value);return value;
}
export async function refreshFirebaseProfile(id:string,onGrowth:(profile:AccountProfile)=>void){
 try{await auth.authStateReady();return await profile(id,true,onGrowth);}
 catch(error){throw friendly(error);}
}
export function firebaseCommanderCharacters(id:string):RawCharacter[]{
 requireUser();
 if(!linkedIds(userData).includes(id))return [];
 const characters=commanders.get(id)?.characters;
 return Array.isArray(characters)?characters:[];
}

// One ordered, cursor-paginated source shared by filters. No repeated whole-collection reads.
type DeckCache={rows:ReturnType<typeof savedDeck>[];cursor?:QueryDocumentSnapshot;done:boolean;loadedAt:number;inFlight?:Promise<void>};
const deckCaches=new Map<string,DeckCache>();
function invalidateDecks(){deckCaches.clear();}
async function listDecks(params:URLSearchParams){
 const ranking=params.get('sort')==='score',key=ranking?'score':'latest';
 let cache=deckCaches.get(key);if(!cache||Date.now()-cache.loadedAt>60000){cache={rows:[],done:false,loadedAt:Date.now()};deckCaches.set(key,cache);}const current=cache;
 const offset=Math.max(0,Number(params.get('offset'))||0),include=(params.get('include')??'').split(',').filter(Boolean),exclude=(params.get('exclude')??'').split(',').filter(Boolean);
 const matches=()=>{const rows=current.rows.filter(row=>{const ids=new Set(row.deck.squads.flat());return (!params.get('season')||row.season===params.get('season'))&&(!params.get('type')||row.deck.type===params.get('type'))&&include.every(id=>ids.has(id))&&!exclude.some(id=>ids.has(id));});return ranking?rows.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes)||b.createdAt.localeCompare(a.createdAt)):rows;};
 let rows=matches();
 while(!current.done){
  // Unseen net votes cannot exceed their upvotes. Stop as soon as the requested
  // ranking page is provably complete, rather than fetching the entire library.
  const cutoff=rows[offset+20],last=current.rows.at(-1);
  if(rows.length>offset+20&&(!ranking||(last&&cutoff&&last.upvotes<cutoff.upvotes-cutoff.downvotes)))break;
  if(!current.inFlight){current.inFlight=(async()=>{const page=await getDocs(query(collection(db,'shared_decks'),orderBy(ranking?'upvotes':'createdAt','desc'),...(current.cursor?[startAfter(current.cursor)]:[]),limit(40)));current.rows.push(...page.docs.map(d=>savedDeck(d.id,d.data())));current.cursor=page.docs.at(-1)??current.cursor;current.done=page.size<40;})().finally(()=>{current.inFlight=undefined;});}
  await current.inFlight;rows=matches();
 }
 const items=rows.slice(offset,offset+20);const uid=auth.currentUser?.uid;const unknown=items.filter(row=>!votes.has(row.id));if(uid&&unknown.length){const state=await callFunction('getMimirScoreComparisons/decks/votes',{deckIds:unknown.map(row=>row.id)});if(auth.currentUser?.uid===uid)for(const [id,value] of Object.entries(state.votes??{}))votes.set(id,Number(value));}
 return {items:items.map(row=>({...row,myVote:votes.get(row.id)??0})),hasMore:rows.length>offset+20||!current.done};
}
async function publish(input:SharedDeckInput,id?:string){
 const user=requireUser(),data=legacyDeck(input,user.uid,String(userData.nickname||userData.displayName||user.displayName||'지휘관'));
 const ref=id?doc(db,'shared_decks',id):doc(collection(db,'shared_decks'));
 if(id){const old=await getDoc(ref);if(old.data()?.authorUid!==user.uid)throw Error('내가 작성한 덱만 수정할 수 있어요.');await updateDoc(ref,{...data,updatedAt:serverTimestamp()});}
 else await setDoc(ref,{...data,upvotes:0,downvotes:0,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 invalidateDecks();return {id:ref.id};
}
export async function firebaseApi(path:string,body?:any):Promise<any>{
 try{
 await auth.authStateReady();resetScope();
 if(path==='/session')return await session();
 if(path==='/logout'){await signOut(auth);resetScope();return {};}
 if(path==='/accounts/challenge'){requireUser();return {code:'미미르만만세'};}
 if(path==='/accounts/link'){
  const url=new URL(body?.url??'');if(url.protocol!=='https:'||!['www.blablalink.com','blablalink.com'].includes(url.hostname)||url.pathname!=='/user'||url.username||url.password||url.port||!url.searchParams.get('openid'))throw Error('BLABLALINK의 HTTPS 프로필 주소를 입력해 주세요.');
  await callFunction('scrapeNikkeProfile',{url:url.href});commanders.clear();profiles.clear();return await session();
 }
 const account=path.match(/^\/accounts\/([^/]+)(?:\/(select|refresh))?$/);
 if(account){const id=decodeURIComponent(account[1]);if(account[2]==='select'){const user=requireUser();await session();if(!linkedIds(userData).includes(id))throw Error('연동된 지휘관만 선택할 수 있어요.');await updateDoc(doc(db,'users',user.uid),{selectedOpenId:id,selectedOpenIdUpdatedAt:serverTimestamp()});return {};}
  return await profile(id,account[2]==='refresh');}
 if(path==='/account/delete'){if(body?.confirmation!=='탈퇴')throw Error('탈퇴 확인 문구를 입력해 주세요.');await reauthenticateWithPopup(requireUser(),provider());await callFunction('deleteMimirAccount');await signOut(auth);resetScope();return {};}
 if(path==='/badges'){requireUser();const snapshot=await getDoc(doc(db,'users',auth.currentUser!.uid));return savedBadges(snapshot.data()??{});}
 if(path==='/badges/display')return await callFunction('getMimirScoreComparisons/badges/display',body);
 const statistics=path.match(/^\/statistics\/([^/]+)\/(\d+)$/);if(statistics)return (await callFunction('getNikkeStatistics',{openId:decodeURIComponent(statistics[1]),nameCode:Number(statistics[2])})).data;
 const showcase=path.match(/^\/users\/([^/]+)\/badges$/);if(showcase)return await callFunction('getMimirScoreComparisons/badges/showcase',{uid:decodeURIComponent(showcase[1])},false);
 if(path==='/worldcup/badge')throw Error('월드컵 뱃지 저장은 기존 Firebase 서버 기능 연결을 준비 중이에요. 결과 이미지는 저장할 수 있어요.');
 if(path.startsWith('/decks?'))return await listDecks(new URLSearchParams(path.split('?')[1]));
 if(path==='/decks'&&body)return await publish(body);
 const deck=path.match(/^\/decks\/([^/]+)\/(edit|delete|vote)$/);
 if(deck){const id=decodeURIComponent(deck[1]);if(deck[2]==='edit')return await publish(body,id);if(deck[2]==='delete'){await callFunction('deleteSharedDeck',{deckId:id});invalidateDecks();return {};}
  const result=await callFunction('voteSharedDeck',{deckId:id,value:body.value});votes.set(id,result.vote);invalidateDecks();return {...result,myVote:result.vote};}
 throw Error('이 기능의 Firebase 연결을 확인할 수 없어요.');
 }catch(error){throw friendly(error);}
}
