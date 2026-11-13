import type {RaidInfo} from './data/raids';
import type {Deck,Nikke} from './deck-model';
import {elements} from './deck-model';
import {elementIcon,burstIcon,squadTraits} from './card-design';

export async function captureDeck(deck:Deck,catalog:Nikke[],raid?:RaidInfo):Promise<Blob>{
 const byId=new Map(catalog.map(n=>[n.id,n]));
 const rows=deck.squads.map((slots,index)=>({slots,index})).filter(r=>r.slots.some(Boolean));
 if(!rows.length&&!deck.candidates.length)throw Error('먼저 니케를 편성하거나 후보에 추가해 주세요.');
 const ids=[...new Set([...rows.flatMap(r=>r.slots),...deck.candidates].filter((id):id is string=>!!id))];
 const sources=new Set<string>();
 for(const id of ids){const n=byId.get(id);if(!n)throw Error('니케 정보를 찾지 못했어요.');sources.add(`/${n.imageUrl}`);sources.add(elementIcon(n));sources.add(burstIcon(n));}
 if(deck.type==='union')for(const row of rows){const code=Object.entries(elements).find(([,label])=>label===deck.elements[row.index])?.[0]??'Electric';sources.add('/assets/icons/elements/icon-elements-'+code+'.webp');}
 const images=new Map<string,HTMLImageElement>();
 await Promise.all([...sources].map(async src=>{const img=new Image();img.src=src;try{await img.decode();}catch{throw Error('카드 이미지 또는 아이콘을 불러오지 못했어요. 다시 시도해 주세요.');}images.set(src,img);}));
 await document.fonts.ready;
 // Original 600px composition at 2x, with a narrow information rail and five 3:4 cards.
 const width=1200,outer=20,gap=16,rowHeight=258,cardW=147,cardH=203,cardGap=32,cardX=280;
 const candidateRows=Math.ceil(deck.candidates.length/5),candidateHeight=candidateRows?56+candidateRows*cardH+(candidateRows-1)*12:0;
 const raidKeywords=(index:number)=>raid?.type===deck.type?(deck.type==='solo'?(raid.weakness===elements[deck.weakness]?raid.keyword??[]:[]):raid.unionBosses?.find(b=>b.element===deck.elements[index])?.keyword??[]):[];
 const railTraits=(slots:(string|null)[],index:number)=>squadTraits(slots.filter((id):id is string=>!!id).map(id=>byId.get(id)!),deck.type==='solo'?deck.weakness:Object.entries(elements).find(([,v])=>v===deck.elements[index])?.[0]??'Electric',raidKeywords(index));
 const rowHeights=rows.map(r=>Math.max(rowHeight,159+Math.ceil(railTraits(r.slots,r.index).tags.length/2)*48-8));
 const height=outer*2+rowHeights.reduce((a,b)=>a+b,0)+(rows.length&&candidateRows?gap:0)+Math.max(0,rows.length-1)*gap+candidateHeight+50;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('이 브라우저에서 이미지 생성을 지원하지 않아요.');
 const font='"Malgun Gothic","Noto Sans KR",sans-serif';
 function text(value:string,x:number,y:number,size:number,color='#ffffff',weight=700){ctx!.font=`${weight} ${size}px ${font}`;ctx!.fillStyle=color;ctx!.fillText(value,x,y);}
 function fit(value:string,x:number,y:number,w:number,size:number,color='#ffffff',outlined=false){ctx!.font=`700 ${size}px ${font}`;let label=value;while(ctx!.measureText(label).width>w&&label.length>1)label=label.slice(0,-1);if(label!==value)label=label.slice(0,-1)+'…';if(outlined){ctx!.strokeStyle='#000000cc';ctx!.lineWidth=2;ctx!.lineJoin='round';ctx!.strokeText(label,x,y);}text(label,x,y,size,color);}
 function box(x:number,y:number,w:number,h:number,fill:string,stroke?:string,r=8){ctx!.beginPath();ctx!.roundRect(x,y,w,h,r);ctx!.fillStyle=fill;ctx!.fill();if(stroke){ctx!.strokeStyle=stroke;ctx!.lineWidth=2;ctx!.stroke();}}
 function card(id:string|null,x:number,y:number,index:number){
  if(!id){box(x,y,cardW,cardH,'#ffffff05','#ffffff1f');ctx!.textAlign='center';text(String(index),x+cardW/2,y+cardH/2+8,26,'#ffffff40');ctx!.textAlign='left';return;}
  const n=byId.get(id)!,image=images.get(`/${n.imageUrl}`)!;
  ctx!.save();ctx!.beginPath();ctx!.roundRect(x,y,cardW,cardH,5);ctx!.clip();ctx!.fillStyle='#fff';ctx!.fillRect(x,y,cardW,cardH);
  const ratio=Math.max(cardW/image.naturalWidth,cardH/image.naturalHeight),sw=cardW/ratio,sh=cardH/ratio;
  ctx!.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,cardW,cardH);
  const top=ctx!.createLinearGradient(0,y,0,y+48);top.addColorStop(0,'#0000008a');top.addColorStop(1,'#00000000');ctx!.fillStyle=top;ctx!.fillRect(x,y,cardW,48);
  const bottom=ctx!.createLinearGradient(0,y+cardH-44,0,y+cardH);bottom.addColorStop(0,'#00000000');bottom.addColorStop(1,'#0000008a');ctx!.fillStyle=bottom;ctx!.fillRect(x,y+cardH-44,cardW,44);
  box(x+7,y+7,31,31,'#00000053',undefined,16);ctx!.drawImage(images.get(elementIcon(n))!,x+10,y+10,25,25);
  box(x+cardW-38,y+7,31,31,'#00000088',undefined,5);ctx!.drawImage(images.get(burstIcon(n))!,x+cardW-35,y+10,25,25);
  ctx!.shadowColor='#000';ctx!.shadowBlur=2;ctx!.shadowOffsetY=1;fit(n.name,x+6,y+cardH-10,cardW-12,18.5,'#ffffff',true);ctx!.restore();
 }
 function panel(title:string,slots:(string|null)[],y:number,index:number,candidate=false,panelHeight=rowHeight){
  const h=candidate?candidateHeight:panelHeight;box(outer,y,width-outer*2,h,'#11141b','#1e2330',12);
  if(deck.type==='union'&&!candidate){
   const code=Object.entries(elements).find(([,label])=>label===deck.elements[index])?.[0]??'Electric';
   ctx!.drawImage(images.get('/assets/icons/elements/icon-elements-'+code+'.webp')!,outer+22,y+27,36,36);
   fit(elements[code],outer+69,y+54,133,28);
  }else{box(outer+22,y+31,7,24,'#19aff4',undefined,3);fit(title,outer+38,y+54,150,28);}
  if(!candidate){
   const weakness=deck.type==='solo'?deck.weakness:Object.entries(elements).find(([,v])=>v===deck.elements[index])?.[0]??'Electric';
   const ns=slots.filter((id):id is string=>!!id).map(id=>byId.get(id)!);const traits=squadTraits(ns,weakness,raidKeywords(index));
   const badge=(label:string,x:number,on:boolean,blue=false)=>{const color=blue?'#2196f3':'#4caf50';box(x,y+77,84,40,on?(blue?'#2196f31f':'#4caf501f'):'#ffffff03',on?color+'cc':'#ffffff29',12);ctx!.save();ctx!.textAlign='center';ctx!.textBaseline='middle';text(label,x+42,y+97,18,on?'#fff':'#ffffffb3');ctx!.restore();};
   badge('속성저지',outer+22,traits.weakness);badge(traits.cooldownLabel,outer+118,traits.cooldown,traits.cooldownLabel==='풀버연장');
   ctx!.strokeStyle='#ffffff1f';ctx!.beginPath();ctx!.moveTo(outer+22,y+128);ctx!.lineTo(outer+202,y+128);ctx!.stroke();
   let tx=outer+22,ty=y+139;
   for(const tag of traits.tags){ctx!.font=`700 18px ${font}`;const w=ctx!.measureText(tag).width+20;if(tx+w>outer+202){tx=outer+22;ty+=48;}if(traits.specialTags.includes(tag)){
    const gradient=ctx!.createLinearGradient(tx,ty,tx+w,ty+40);['#d4a5ff','#80ffea','#b185db','#ff9cee','#8a2be2'].forEach((color,i)=>gradient.addColorStop(i/4,color));
    box(tx,ty,w,40,'#11141b',undefined,12);ctx!.strokeStyle=gradient;ctx!.lineWidth=2.4;ctx!.stroke();text(tag,tx+10,ty+28,18,'#ffffff');
   }else{box(tx,ty,w,40,'#ffa0001f','#ffa000cc',12);text(tag,tx+10,ty+28,18,'#ffc107');}tx+=w+8;}
   ctx!.save();ctx!.setLineDash([6,6]);ctx!.strokeStyle='#ffffff2e';ctx!.beginPath();ctx!.moveTo(outer+219,y+18);ctx!.lineTo(outer+219,y+h-18);ctx!.stroke();ctx!.restore();
  }
  const drawSlots=candidate?slots:Array.from({length:5},(_,i)=>slots[i]??null);
  drawSlots.forEach((id,i)=>card(id,cardX+(i%5)*(cardW+cardGap),y+28+Math.floor(i/5)*(cardH+12),i+1));
 }
 ctx.fillStyle='#090a0f';ctx.fillRect(0,0,width,height);
 let y=outer;rows.forEach((row,i)=>{panel(deck.names[row.index],row.slots,y,row.index,false,rowHeights[i]);y+=rowHeights[i]+gap;});
 if(candidateRows){if(!rows.length)y=outer;panel('후보 덱',deck.candidates,y,0,true);}
 ctx.textAlign='right';text('Made with MIMIR',width-outer,height-outer,22,'#ffffff61',500);ctx.textAlign='left';
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG 생성에 실패했어요.')),'image/png'));
}


