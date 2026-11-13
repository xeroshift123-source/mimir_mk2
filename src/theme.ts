type Theme='dark'|'light';
const key='mimir-mk2-theme';
export function mountThemeToggle(){
 const button=document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!;
 let transitionTimer:number|undefined;
 const apply=(theme:Theme,animate=false)=>{
  window.clearTimeout(transitionTimer);
  const root=document.documentElement;
  const shouldAnimate=animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.toggle('theme-transitioning',shouldAnimate);
  if(shouldAnimate){
   // Commit transition rules before changing the palette; no animation on initial load.
   void root.offsetWidth;
   transitionTimer=window.setTimeout(()=>root.classList.remove('theme-transitioning'),260);
  }
  document.documentElement.dataset.theme=theme;
  button.textContent=theme==='dark'?'☀ 라이트':'☾ 다크';
  button.setAttribute('aria-label',theme==='dark'?'라이트 모드로 전환':'다크 모드로 전환');
  button.title=theme==='dark'?'라이트 모드로 전환':'다크 모드로 전환';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#141516':'#f7f8fa');
 };
 apply(document.documentElement.dataset.theme==='dark'?'dark':'light');
 button.addEventListener('click',()=>{
  const theme:Theme=document.documentElement.dataset.theme==='light'?'dark':'light';apply(theme,true);
  try{localStorage.setItem(key,theme);}catch{/* The toggle remains usable when storage is unavailable. */}
 });
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue==='dark'?'dark':'light',true);});
}

