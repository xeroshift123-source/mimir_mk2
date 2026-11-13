import type {Nikke} from './deck-model';
import type {SimEquipment} from './overload-simulator-model';
import {allBlackResultOptions} from './all-black-model';

export async function allBlackResultImage(nikke:Nikke,equipment:SimEquipment[],modules:number):Promise<Blob>{
 const img=new Image();img.src='/'+nikke.imageUrl;
 try{await img.decode();}catch{throw Error('니케 이미지를 불러오지 못했어요. 다시 시도해 주세요.');}
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=880;
 const c=canvas.getContext('2d');if(!c)throw Error('이미지를 만들 수 없어요.');
 const font='"Malgun Gothic","Noto Sans KR",sans-serif';
 // Clip the artwork itself so copied PNGs keep transparent, rounded corners.
 c.beginPath();c.roundRect(0,0,720,880,32);c.clip();
 const bg=c.createLinearGradient(0,0,720,880);bg.addColorStop(0,'#30392d');bg.addColorStop(1,'#141b18');c.fillStyle=bg;c.fillRect(0,0,720,880);
 const portrait=document.createElement('canvas');portrait.width=720;portrait.height=880;const p=portrait.getContext('2d')!;
 const scale=Math.max(480/img.naturalWidth,600/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
 p.save();p.beginPath();p.rect(240,80,480,600);p.clip();p.drawImage(img,240+(480-w)/2,80+(600-h)*.3,w,h);p.restore();
 p.globalCompositeOperation='destination-in';
 const side=p.createLinearGradient(240,0,720,0);side.addColorStop(0,'#0000');side.addColorStop(.45,'#0009');side.addColorStop(1,'#000');p.fillStyle=side;p.fillRect(0,0,720,880);
 const bottom=p.createLinearGradient(0,80,0,680);bottom.addColorStop(0,'#0000');bottom.addColorStop(.12,'#000');bottom.addColorStop(.6,'#000');bottom.addColorStop(1,'#0000');p.fillStyle=bottom;p.fillRect(0,0,720,880);
 c.drawImage(portrait,0,0);
 c.fillStyle='#ffbc75';c.font=`700 18px ${font}`;c.fillText('MIMIR · ALL BLACK CHALLENGE',48,60);
 c.fillStyle='#ffc17c';c.font=`700 28px ${font}`;c.fillText(`${modules.toLocaleString('ko-KR')}개의 모듈로`,48,156);
 c.fillStyle='#fff';c.font=`700 40px ${font}`;c.fillText('지상 최강의',48,222);c.fillText('화력을 완성!',48,278);
 c.fillStyle='#c0c9b9';c.font=`400 20px ${font}`;c.fillText(nikke.name,48,330);
 allBlackResultOptions(equipment).forEach((o,i)=>{
  const y=544+i*62;c.fillStyle='#c0c9b9';c.font=`400 24px ${font}`;c.fillText(`${o.name} (${o.count})`,48,y);
  c.textAlign='right';c.fillStyle='#ffc17c';c.font=`700 26px ${font}`;c.fillText(`+${o.value.toFixed(2)}%`,672,y);c.textAlign='left';
 });
 c.fillStyle='#acb5a5';c.font=`400 18px ${font}`;c.fillText('12개 옵션 모두 Lv.15',48,824);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지 생성에 실패했어요.')),'image/png'));
}
