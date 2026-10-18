'use strict';

// Retry an actual interrupted operation, never poll the entire job history.
function watchCommissionJobs({db,retry,now=Date.now,schedule=setTimeout,cancel=clearTimeout,onError=()=>{}}){
 const ref=db.ref('sv_commission_generation'),timers=new Map();let stopped=false;
 function changed(snapshot){
  const id=snapshot.key;if(!id||stopped)return;
  if(timers.has(id)){cancel(timers.get(id));timers.delete(id);}
  const job=snapshot.val();
  const attempts=Number(job?.intentos),lease=Number(job?.leaseUntil||0),next=Number(job?.reintentarEn||0);
  if(!job||!['error','procesando'].includes(job.estado)||!Number.isInteger(attempts)||attempts<1||attempts>=5||![lease,next].every(n=>Number.isFinite(n)&&n>=0))return;
  const delay=Math.max(0,lease-now(),next-now());if(delay>86400000)return;
  const handle=schedule(()=>{timers.delete(id);if(!stopped)Promise.resolve().then(()=>retry(id)).catch(onError);},delay+1);
  handle?.unref?.();timers.set(id,handle);
 }
 const removed=snapshot=>{if(timers.has(snapshot.key)){cancel(timers.get(snapshot.key));timers.delete(snapshot.key);}};
 ref.on('child_added',changed,onError);ref.on('child_changed',changed,onError);ref.on('child_removed',removed,onError);
 return ()=>{stopped=true;for(const timer of timers.values())cancel(timer);timers.clear();ref.off('child_added',changed);ref.off('child_changed',changed);ref.off('child_removed',removed);};
}
module.exports={watchCommissionJobs};
