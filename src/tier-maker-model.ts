export const tierColors=['#eeb18e','#e9c68c','#ded18a','#b7c995','#9cbfc0','#b2afcb'] as const;
export interface TierRow {id:string;name:string;nikkes:string[]}
export function restoreTierRows(value:unknown,known:ReadonlySet<string>):TierRow[]{
 if(!Array.isArray(value))return [];
 const used=new Set<string>(),rowIds=new Set<string>();
 return value.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&Array.isArray(r.nikkes)).map(r=>{
  const id=rowIds.has(r.id)?crypto.randomUUID():r.id;rowIds.add(id);
  return {id,name:r.name.slice(0,40),nikkes:r.nikkes.filter((n:unknown):n is string=>{if(typeof n!=='string'||!known.has(n)||used.has(n))return false;used.add(n);return true;})};
 });
}
export function placeTierNikke(rows:TierRow[],id:string,rowId:string,beforeId?:string){
 const row=rows.find(r=>r.id===rowId);if(!row||beforeId===id)return false;
 rows.forEach(r=>{r.nikkes=r.nikkes.filter(n=>n!==id);});
 const index=beforeId?row.nikkes.indexOf(beforeId):-1;
 row.nikkes.splice(index<0?row.nikkes.length:index,0,id);return true;
}
