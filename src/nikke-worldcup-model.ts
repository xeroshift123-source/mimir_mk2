export interface WorldcupState{pool:string[];next:string[];index:number;picks:number;round:number;total:number}
export function shuffled<T>(items:T[],random= Math.random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function startWorldcup(ids:string[],random=Math.random):WorldcupState{const pool=shuffled([...new Set(ids)],random);if(pool.length<2)throw Error('대결할 니케가 부족해요.');return {pool,next:[],index:0,picks:0,round:1,total:pool.length};}
export function chooseNikke(state:WorldcupState,id:string,random=Math.random):WorldcupState{
 if(state.pool.length<2||!state.pool.slice(state.index,state.index+2).includes(id))return state;
 const next=[...state.next,id];let index=state.index+2;const result={...state,next,index,picks:state.picks+1};
 if(index>=state.pool.length-1){if(index===state.pool.length-1)next.push(state.pool[index]);return {...result,pool:shuffled(next,random),next:[],index:0,round:state.round+1};}
 return result;
}
export function validWorldcup(value:unknown,ids:Set<string>):value is WorldcupState{
 if(!value||typeof value!=='object')return false;const s=value as WorldcupState;
 if(!Array.isArray(s.pool)||!s.pool.length||!Array.isArray(s.next)||![s.index,s.picks,s.round,s.total].every(Number.isInteger))return false;
 if(!s.pool.every(id=>typeof id==='string'&&ids.has(id))||new Set(s.pool).size!==s.pool.length||!s.next.every(id=>s.pool.slice(0,s.index).includes(id))||new Set(s.next).size!==s.next.length)return false;
 return s.total>=s.pool.length&&s.total<=ids.size&&s.index>=0&&s.index%2===0&&s.index<s.pool.length&&s.next.length===s.index/2&&s.picks>=0&&s.picks<s.total&&s.round>=1&&(s.pool.length===1?s.picks===s.total-1:s.index+1<s.pool.length);
}
