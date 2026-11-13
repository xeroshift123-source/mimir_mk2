export const scoreColor=(strength:number)=>{
   const stops=[[235,100,91],[241,154,66],[231,199,70],[88,181,113],[78,151,226]];
   const position=Math.max(0,Math.min(100,strength))/25,index=Math.min(3,Math.floor(position)),fraction=position-index;
   return 'rgb('+stops[index].map((channel,i)=>Math.round(channel+(stops[index+1][i]-channel)*fraction)).join(', ')+')';
  };
