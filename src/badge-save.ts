import type {BadgeState} from '../shared/achievements';
export async function saveBadgeDisplay(previous:BadgeState,ids:string[],hooks:{persist:(ids:string[])=>Promise<unknown>;isCurrent:()=>boolean;apply:(state:BadgeState,phase:'pending'|'saved'|'failed',error?:string)=>void}){
 const before=structuredClone(previous),next={...structuredClone(previous),displayedBadgeIds:[...ids]};
 if(hooks.isCurrent())hooks.apply(next,'pending');
 try{await hooks.persist([...ids]);if(hooks.isCurrent())hooks.apply(next,'saved');}
 catch(error){if(hooks.isCurrent())hooks.apply(before,'failed',(error as Error).message);throw error;}
}
