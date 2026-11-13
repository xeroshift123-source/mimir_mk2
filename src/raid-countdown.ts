import type {RaidInfo} from './data/raids';
const clock=(milliseconds:number)=>{
 const seconds=Math.max(0,Math.ceil(milliseconds/1000));
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
};
export function raidCountdown(raid:Pick<RaidInfo,'startsAt'|'endsAt'|'completed'>,now=Date.now()):string|null{
 const start=Date.parse(raid.startsAt??''),end=Date.parse(raid.endsAt??'');
 if(raid.completed)return '종료됨';
 if(Number.isFinite(start)&&Number.isFinite(end)&&start>=end)return null;
 if(Number.isFinite(start)&&now<start)return '시작까지 '+clock(start-now);
 if(Number.isFinite(end)&&now>=end)return '종료됨';
 if(Number.isFinite(start)&&Number.isFinite(end))return '종료까지 '+clock(end-now);
 return null;
}
