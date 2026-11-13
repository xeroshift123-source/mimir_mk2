import type {Nikke} from './deck-model';
import type {TierRow} from './tier-maker-model';
import {tierColors} from './tier-maker-model';

// The deck export is also 1200px wide. Keep the tier export in its light palette.
export async function captureTierMaker(rows:TierRow[],catalog:Nikke[],title='나의 티어표'):Promise<Blob>{
 if(!rows.length)throw Error('먼저 티어 행을 추가해 주세요.');
 const byId=new Map(catalog.map(n=>[n.id,n])),images=new Map<string,HTMLImageElement>();
 await Promise.all([...new Set(rows.flatMap(r=>r.nikkes))].map(async id=>{
  const n=byId.get(id);if(!n)throw Error('니케 정보를 찾지 못했어요.');
  const img=new Image();img.src='/'+n.imageUrl;try{await img.decode();}catch{throw Error('니케 이미지를 불러오지 못했어요. 다시 시도해 주세요.');}images.set(id,img);
 }));
 await document.fonts.ready;
 const width=1200,outer=24,labelW=132,pad=16,cardW=100,cardH=134,gap=10;
 const columns=Math.floor((width-outer*2-labelW-pad*2+gap)/(cardW+gap));
 const font='"Malgun Gothic","Noto Sans KR",sans-serif';
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d');if(!c)throw Error('이미지를 만들 수 없어요.');
 function labelLines(value:string){c!.font=`700 24px ${font}`;const lines:string[]=[];let line='';for(const ch of value){if(line&&(ch==='\n'||c!.measureText(line+ch).width>labelW-24)){lines.push(line);line='';}if(ch!=='\n')line+=ch;}if(line)lines.push(line);return lines.length?lines:[''];}
 const layout=rows.map(r=>({row:r,lines:labelLines(r.name),height:Math.max(pad*2+Math.max(1,Math.ceil(r.nikkes.length/columns))*(cardH+gap)-gap,labelLines(r.name).length*32+32)}));
 const height=88+layout.reduce((sum,r)=>sum+r.height,0)+Math.max(0,rows.length-1)*14+56;
 if(height>30000)throw Error('티어표가 너무 길어요. 행을 줄인 뒤 다시 캡처해 주세요.');
 canvas.width=width;canvas.height=height;
 c.fillStyle='#f8f8f8';c.fillRect(0,0,width,height);
 c.fillStyle='#30332d';let titleSize=30;const heading=title.trim()||'나의 티어표';c.font=`700 ${titleSize}px ${font}`;while(c.measureText(heading).width>width-outer*2&&titleSize>16)c.font=`700 ${--titleSize}px ${font}`;c.fillText(heading,outer,52);
 let y=88;
 for(const [i,item] of layout.entries()){
  const {row,lines,height:h}=item;
  c.save();c.beginPath();c.roundRect(outer,y,width-outer*2,h,18);c.clip();
  c.fillStyle='#e9eae7';c.fillRect(outer,y,width-outer*2,h);
  c.fillStyle=tierColors[i%tierColors.length];c.fillRect(outer,y,labelW,h);
  c.fillStyle='#343427';c.font=`700 24px ${font}`;c.textAlign='center';c.textBaseline='middle';lines.forEach((line,j)=>c.fillText(line,outer+labelW/2,y+h/2+(j-(lines.length-1)/2)*32));c.textAlign='left';c.textBaseline='alphabetic';
  row.nikkes.forEach((id,index)=>{
   const n=byId.get(id)!,img=images.get(id)!,x=outer+labelW+pad+(index%columns)*(cardW+gap),cy=y+pad+Math.floor(index/columns)*(cardH+gap);
   c.save();c.beginPath();c.roundRect(x,cy,cardW,cardH,7);c.clip();c.fillStyle='#fff';c.fillRect(x,cy,cardW,cardH);
   const scale=Math.max(cardW/img.naturalWidth,cardH/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;c.drawImage(img,x+(cardW-w)/2,cy+(cardH-h)/2,w,h);
   const shade=c.createLinearGradient(0,cy+cardH-42,0,cy+cardH);shade.addColorStop(0,'#10141000');shade.addColorStop(1,'#101410ee');c.fillStyle=shade;c.fillRect(x,cy+cardH-42,cardW,42);
   c.font=`700 15px ${font}`;let name=n.name;while(c.measureText(name).width>cardW-8&&name.length>1)name=name.slice(0,-1);if(name!==n.name){name=name.slice(0,-1)+'…';}c.fillStyle='#fff';c.textAlign='center';c.fillText(name,x+cardW/2,cy+cardH-9);c.restore();
  });c.restore();y+=h+14;
 }
 c.fillStyle='#747b70';c.font=`500 18px ${font}`;c.textAlign='right';c.fillText('Made with MIMIR',width-outer,height-20);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지 생성에 실패했어요.')),'image/png'));
}

export function showTierCapture(blob:Blob){
 const dialog=document.createElement('dialog');dialog.className='tier-capture-dialog';dialog.setAttribute('aria-labelledby','tier-capture-title');
 const url=URL.createObjectURL(blob);
 dialog.innerHTML='<header><h2 id="tier-capture-title">티어표 캡처</h2><button data-tier-export="close" aria-label="캡처 창 닫기">×</button></header><img class="tier-capture-preview" alt="라이트 모드 색상의 티어표 캡처"/><div class="tier-capture-actions"><button data-tier-export="copy">이미지 복사</button><button data-tier-export="save">이미지 저장</button></div><p role="status"></p>';
 dialog.querySelector<HTMLImageElement>('img')!.src=url;
 const close=()=>dialog.close();window.addEventListener('hashchange',close);
 dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',close);URL.revokeObjectURL(url);dialog.remove();},{once:true});
 dialog.addEventListener('click',async event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-tier-export]');if(!button)return;
  const action=button.dataset.tierExport;if(action==='close'){close();return;}
  const status=dialog.querySelector('p')!;button.disabled=true;button.dataset.loading='true';
  try{
   if(action==='copy'){
    if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('이미지 복사를 지원하지 않아요. 이미지 저장을 이용해 주세요.');
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);status.textContent='이미지를 복사했어요. 원하는 곳에 붙여넣으세요.';
   }else{
    const downloadUrl=URL.createObjectURL(blob),link=document.createElement('a');link.href=downloadUrl;link.download='MIMIR-티어표.png';link.click();setTimeout(()=>URL.revokeObjectURL(downloadUrl),10000);status.textContent='이미지를 저장했어요.';
   }
  }catch(error){status.textContent=(error as Error).message;}finally{button.disabled=false;delete button.dataset.loading;}
 });document.body.append(dialog);dialog.showModal();
}
