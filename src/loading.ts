const escapeLoadingText=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const loadingSpinner='<span class="loading-spinner" aria-hidden="true"></span>';
export const loadingMarkup=(text:string)=>'<span class="loading-message" role="status">'+loadingSpinner+'<span>'+escapeLoadingText(text)+'</span></span>';
