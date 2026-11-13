import type {Nikke} from './deck-model';
export async function worldcupResultImage(nikke:Nikke,total:number):Promise<Blob>{
 const img=new Image();img.src='/'+nikke.imageUrl;try{await img.decode();}catch{throw Error('니케 이미지를 불러오지 못했어요. 다시 시도해 주세요.');}await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;const c=canvas.getContext('2d');if(!c)throw Error('이미지를 만들 수 없어요.');
 const font='"Malgun Gothic","Noto Sans KR",sans-serif';c.fillStyle='#171b19';c.fillRect(0,0,1080,1440);
 c.fillStyle='#ffac62';c.font=`700 27px ${font}`;c.fillText('MIMIR',64,78);c.fillStyle='#a1ada0';c.font=`400 22px ${font}`;c.textAlign='right';c.fillText('니케 이상형 월드컵',1016,78);c.textAlign='left';
 c.fillStyle='#f5f5ec';c.font=`700 58px ${font}`;c.fillText('나의 정실은?',64,168);
 c.save();c.beginPath();c.roundRect(64,214,952,984,24);c.clip();c.fillStyle='#f1eee8';c.fillRect(64,214,952,984);const scale=Math.max(952/img.naturalWidth,984/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;c.drawImage(img,64+(952-w)/2,214+(984-h)/2,w,h);const shade=c.createLinearGradient(0,900,0,1198);shade.addColorStop(0,'#10171300');shade.addColorStop(1,'#101713ed');c.fillStyle=shade;c.fillRect(64,900,952,298);c.fillStyle='#fff';let size=64;c.font=`700 ${size}px ${font}`;while(c.measureText(nikke.name).width>832&&size>25)c.font=`700 ${--size}px ${font}`;c.textAlign='center';c.fillText(nikke.name,540,1138);c.restore();
 c.fillStyle='#ffac62';c.textAlign='center';c.font=`700 30px ${font}`;c.fillText(`${total}명 중, 나의 단 한 명`,540,1270);c.fillStyle='#99a495';c.font=`400 22px ${font}`;c.fillText('끝까지 남은 건 너였어.',540,1320);c.font=`700 18px ${font}`;c.fillText('MIMIR  ·  나의 정실은?',540,1390);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지 생성에 실패했어요.')),'image/png'));
}
