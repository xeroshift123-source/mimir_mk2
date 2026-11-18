import type {AccountProfile} from '../shared/account';

export interface ProfileSnapshot {
 profile:AccountProfile;
 checkedAt:number;
}

const storeName='profiles';
let database:Promise<IDBDatabase|null>|undefined;
function openDatabase(){
 return database??=new Promise(resolve=>{
  try{
   const request=indexedDB.open('mimir-account-profile-cache',1);
   request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
   request.onsuccess=()=>{
    const db=request.result;
    db.onversionchange=()=>{db.close();database=undefined;};
    resolve(db);
   };
   request.onerror=request.onblocked=()=>resolve(null);
  }catch{resolve(null);}
 });
}

async function access<T>(mode:IDBTransactionMode,operate:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T|undefined>{
 const db=await openDatabase();
 if(!db)return;
 return new Promise(resolve=>{
  try{
   const transaction=db.transaction(storeName,mode),request=operate(transaction.objectStore(storeName));
   transaction.oncomplete=()=>resolve(request.result);
   transaction.onabort=()=>resolve(undefined);
  }catch{resolve(undefined);}
 });
}

export async function readProfileCache(userId:string):Promise<ProfileSnapshot|null>{
 const snapshot=await access('readonly',store=>store.get(userId));
 const profile=snapshot?.profile;
 if(typeof profile?.account?.id!=='string'||!Array.isArray(profile.profile?.characters)||
    !Array.isArray(profile.profile?.recycleRoom)||!profile.scores||!Number.isFinite(snapshot.checkedAt))return null;
 return snapshot;
}

export function writeProfileCache(userId:string,{profile,checkedAt}:ProfileSnapshot){
 const {nickname,server,union,synchroLevel,commanderLevel,ownedNikkesCount,combatPower,recycleRoom,recycleRoomComplete,characters}=profile.profile;
 const saved:AccountProfile={
  account:profile.account,
  profile:{nickname,server,union,synchroLevel,commanderLevel,ownedNikkesCount,combatPower,recycleRoom,recycleRoomComplete,characters,stateEffects:[]},
  scores:profile.scores,elementScores:profile.elementScores,nikkeComparisons:profile.nikkeComparisons,scoreStatus:profile.scoreStatus,
  scoreError:profile.scoreError,comparisonUnavailable:profile.comparisonUnavailable,
 };
 const snapshot={profile:saved,checkedAt};
 if(!saved.scoreError&&!saved.comparisonUnavailable)return access('readwrite',store=>store.put(snapshot,userId));
 // A partial server response can seed a new cache without replacing the last complete result.
 return access('readwrite',store=>{
  const current=store.get(userId);
  current.onsuccess=()=>{
   const previous=current.result?.profile;
   if(previous?.account?.id!==saved.account.id||previous.scoreError||previous.comparisonUnavailable)store.put(snapshot,userId);
  };
  return current;
 });
}

export function clearProfileCache(userId:string){
 return access('readwrite',store=>store.delete(userId));
}

export function pruneProfileCache(userId:string,commanderId:string|null){
 return access('readwrite',store=>{
  const current=store.get(userId);
  current.onsuccess=()=>{
   if(current.result&&current.result.profile?.account?.id!==commanderId)store.delete(userId);
  };
  return current;
 });
}
