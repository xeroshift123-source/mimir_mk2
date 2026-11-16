import {loadingMarkup} from './loading';
import type {Growth} from './profile-data';
import {number} from './profile-data';
import {level40Cp} from './profile-controls';

/** Same thresholds and labels as the original NikkeDriverLicense. */
export function licenseClass(cp:number){return cp>=100000?'승리의 날개호 운용':cp>=90000?'어드마이어호 운용':cp>=80000?'AZX운용':cp>=70000?'1종 특수':cp>=60000?'1종 대형':cp>=50000?'1종 보통':cp>=40000?'1종 소형':'자전거 면허';}
export function licenseScore(g:Pick<Growth,'score'>){return g.score!==null&&Number.isFinite(g.score)?g.score:null;}
export async function captureLicense(g:Growth):Promise<Blob>{
 const cp=level40Cp(g);if(cp===null)throw Error('면허증 발급에는 4부위 오버로드와 육성 정보가 필요해요.');
 const load=async(src:string)=>{const img=new Image();img.src=src;await img.decode();return img;};
 const [portrait,stamp]=await Promise.all([load('/'+g.nikke.imageUrl),load('/assets/images/dorodojang.png')]);
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지를 생성할 수 없는 브라우저예요.');
 ctx.scale(2,2);
 const wings=cp>=100000,admire=cp>=90000&&!wings,azx=cp>=80000,special=cp>=70000,ink=special?'#fff':'#25252b',sub=wings?'#b9d8f3':admire?'#c9c3b5':special?'#c0bdc8':'#68636a',accent=wings?'#69c6ff':admire?'#ffd15c':azx?'#ff4d4d':special?'#ffce54':'#28232d';
 const background=ctx.createLinearGradient(0,0,640,400);
 if(wings){background.addColorStop(0,'#050e1e');background.addColorStop(.6,'#0c2d59');background.addColorStop(1,'#145aa0');}
 else if(admire){background.addColorStop(0,'#090a0c');background.addColorStop(.5,'#191711');background.addColorStop(.8,'#443419');background.addColorStop(1,'#896724');}
 else if(azx){background.addColorStop(0,'#0a070a');background.addColorStop(.6,'#330005');background.addColorStop(1,'#8b0000');}
 else if(special){background.addColorStop(0,'#2c2c35');background.addColorStop(1,'#0f0f13');}
 else{background.addColorStop(0,'#fff6e5');background.addColorStop(.5,'#fde8f3');background.addColorStop(1,'#e8f4f8');}
 ctx.beginPath();ctx.roundRect(0,0,640,400,16);ctx.fillStyle=background;ctx.fill();
 const text=(value:string,x:number,y:number,size:number,color=ink,weight=700)=>{ctx.font=`${weight} ${size}px "Malgun Gothic","Noto Sans KR",sans-serif`;ctx.fillStyle=color;ctx.fillText(value,x,y);};
 const fit=(value:string,x:number,y:number,width:number,size:number,color=ink)=>{ctx.font=`700 ${size}px "Malgun Gothic","Noto Sans KR",sans-serif`;let label=value;while(label.length&&ctx.measureText(label).width>width)label=label.slice(0,-1);text(label===value?label:label.slice(0,-1)+'…',x,y,size,color);};
 text(licenseClass(cp),24,49,wings?16:admire?17:22,accent,900);
 if(!special){ctx.fillStyle='#fff394';ctx.fillRect(25,67,120,22);ctx.fillRect(25,91,124,22);}
 text('이 면허증은 현실에서',31,82,12,special?'#ff8585':ink);text('쓰면 안 돼요! (진짜임)',31,106,12,special?'#ff8585':ink);
 ctx.save();ctx.shadowColor='#00000018';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
 ctx.beginPath();ctx.roundRect(25,125,170,240,11);ctx.fillStyle=special?'#36363e':'#eee';ctx.fill();ctx.restore();
 ctx.save();ctx.beginPath();ctx.roundRect(25,125,170,240,11);ctx.clip();
 const scale=Math.max(170/portrait.naturalWidth,240/portrait.naturalHeight),sw=170/scale,sh=240/scale;
 ctx.drawImage(portrait,(portrait.naturalWidth-sw)/2,0,sw,sh,25,125,170,240);ctx.restore();
 ctx.beginPath();ctx.roundRect(25,125,170,240,11);ctx.strokeStyle=admire?accent:special?'#606069':'#cdcdcd';ctx.lineWidth=admire?2:1;ctx.stroke();
 const title=wings?'승리의 날개호 운용 권한 증서':admire?'어드마이어호 운용 권한 증서':azx?'AZX 운용 권한 증서':'협전 운전 면허증';
 const english=azx?'(Operator’s License)':"(Driver’s License)";
 // Fit both labels on the same header row, including the long ship names.
 ctx.font=`500 11px "Malgun Gothic","Noto Sans KR",sans-serif`;
 const englishWidth=ctx.measureText(english).width,titleWidth=398-englishWidth-10;
 let titleSize=25;
 while(titleSize>10){ctx.font=`900 ${titleSize}px "Malgun Gothic","Noto Sans KR",sans-serif`;if(ctx.measureText(title).width<=titleWidth)break;titleSize--;}
 text(title,218,55,titleSize,admire?accent:ink,900);
 if(g.nikke.name==='율하'&&cp>=50000){
  ctx.save();ctx.textAlign='right';text('7만을 향해!',616,48,11,sub);ctx.restore();
 }
 text(english,616-englishWidth,62,11,sub,500);
 ctx.fillStyle=special?accent:'#e8a4c2';ctx.fillRect(218,74,398,2);
 fit('이름 : '+g.nikke.name,218,140,398,21);
 text('40레벨 전투력 · 협투력',218,188,13,sub);text(number(cp),218,229,38,accent,900);
 const score=licenseScore(g);
 if(score!==null){
  ctx.beginPath();ctx.roundRect(416,168,200,72,10);ctx.fillStyle=special?'#ffffff0d':'#ffffff80';ctx.fill();
  text('미미르 스코어',430,189,12,sub,500);text(number(score,2),430,225,29,special?accent:'#9c5223',900);
 }
 text('한계 돌파',218,263,13,sub);text('★'.repeat(g.grade)+'☆'.repeat(3-g.grade)+(g.core?'  +'+g.core:''),300,263,18,'#ffc400');
 text('스킬 레벨',218,292,13,sub);text(g.skills.join(' / '),300,292,18);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-','. ');
 text(date,266,358,18,ink);
 const issuerPrefix='발급기관 : ',issuer='미미르만만세';
 text(issuerPrefix,412,358,16,ink);
 const issuerX=412+ctx.measureText(issuerPrefix).width;
 text(issuer,issuerX,358,16,ink);
 const issuerMetrics=ctx.measureText(issuer);
 const stampX=issuerX+issuerMetrics.width/2;
 const stampY=358-(issuerMetrics.actualBoundingBoxAscent-issuerMetrics.actualBoundingBoxDescent)/2;
 // Stamp the actual issuer text bounds, after painting the letters.
 ctx.save();ctx.translate(stampX,stampY);ctx.rotate(-.15);ctx.globalAlpha=.85;ctx.drawImage(stamp,-39,-39,78,78);ctx.restore();
 if(g.isDemo)text('예시 육성 데이터',25,385,10,sub,500);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG 생성에 실패했어요.')),'image/png'));
}

export async function showLicense(g:Growth,isCurrent:()=>boolean){
 const dialog=document.createElement('dialog');dialog.className='nikke-license-dialog';
 dialog.setAttribute('aria-labelledby','nikke-license-title');
 dialog.innerHTML=`<div class="license-dialog-heading"><div><small>CO-OP / Lv.40</small><h2 id="nikke-license-title">면허증 발급</h2></div><button data-license="close" aria-label="면허증 닫기">×</button></div><div class="license-preview" aria-busy="true"><p>${loadingMarkup("면허증 이미지를 만드는 중…")}</p></div><p class="license-status" role="status">예시 육성 데이터로 발급합니다.</p><div class="license-actions"><button data-license="copy" disabled>이미지 복사</button><a aria-disabled="true">PNG 이미지 저장 ↓</a></div>`;
 if(!g.isDemo)dialog.querySelector('.license-status')!.textContent='연결된 계정의 40레벨 전투력으로 발급합니다.';
 document.body.append(dialog);dialog.showModal();
 let blob:Blob|undefined,url:string|undefined;
 const close=()=>{if(dialog.open)dialog.close();};
 window.addEventListener('hashchange',close);
 dialog.addEventListener('close',()=>{window.removeEventListener('hashchange',close);if(url)URL.revokeObjectURL(url);dialog.remove();},{once:true});
 dialog.addEventListener('click',async e=>{
  const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if(b?.dataset.license==='close')close();
  if(b?.dataset.license==='copy'&&blob){
   const status=dialog.querySelector<HTMLElement>('.license-status')!;
   if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){status.textContent='이미지 복사를 지원하지 않는 브라우저예요. PNG 저장을 이용해 주세요.';return;}
   b.disabled=true;b.dataset.loading='true';
   try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);if(dialog.open){b.textContent='✓ 복사 완료';status.textContent='면허증 이미지를 클립보드에 복사했어요.';}}
   catch{if(dialog.open)status.textContent='이미지를 복사하지 못했어요. PNG 저장을 이용해 주세요.';}
   finally{b.disabled=false;delete b.dataset.loading;}
  }
 });
 try{
  blob=await captureLicense(g);if(!dialog.open||!isCurrent()){close();return;}
  url=URL.createObjectURL(blob);
  const preview=dialog.querySelector<HTMLElement>('.license-preview')!;preview.replaceChildren();preview.setAttribute('aria-busy','false');
  const img=document.createElement('img');img.src=url;img.alt=`${g.nikke.name} · 협투력 ${number(level40Cp(g))} · ${licenseClass(level40Cp(g)!)} 면허증${licenseScore(g)!==null?' · 미미르 스코어 '+number(licenseScore(g),2):''}${g.isDemo?' · 예시 데이터':''}`;preview.append(img);
  dialog.querySelector<HTMLButtonElement>('[data-license="copy"]')!.disabled=false;
  const download=dialog.querySelector<HTMLAnchorElement>('.license-actions a')!;download.href=url;download.download=`MIMIR-license-${g.nikke.id}.png`;download.removeAttribute('aria-disabled');
 }catch{if(dialog.open){dialog.querySelector('.license-preview')!.textContent='면허증 이미지를 불러오지 못했어요. 닫은 뒤 다시 시도해 주세요.';dialog.querySelector('.license-preview')!.setAttribute('aria-busy','false');}}
}
