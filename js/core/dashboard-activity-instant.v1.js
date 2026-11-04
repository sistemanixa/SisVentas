(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardActivityInstantV1=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
// Activity ordering only. No implicit process zone or commercial-date conversion.
function canonicalZone(zone){
  if(typeof zone!=='string'||!zone||/^[+-]/.test(zone))throw new RangeError('Explicit IANA time zone required');
  return new Intl.DateTimeFormat('en-US',{timeZone:zone}).resolvedOptions().timeZone;
}
function utc(y,m,d,h=0,min=0,s=0){const date=new Date(0);date.setUTCFullYear(y,m,d);date.setUTCHours(h,min,s,0);return date.getTime();}
function midnight(y,m,d,zone){
  // Date's multi-argument constructor maps years 0..99 to 1900..1999.
  const target=utc(y>=0&&y<100?y+1900:y,m,d);
  const fmt=new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function wall(ms){const p={};for(const v of fmt.formatToParts(ms))if(v.type!=='literal')p[v.type]=Number(v.value);return utc(p.year,p.month-1,p.day,p.hour,p.minute,p.second);}
  const offsets=new Set();
  // Include both sides of offset transitions, including whole skipped dates.
  for(let h=-72;h<=72;h+=6){const sample=target+h*3600000;offsets.add(wall(sample)-sample);}
  let exact=Infinity,forward=Infinity,forwardWall=Infinity;
  for(const offset of offsets){const instant=target-offset,local=wall(instant);if(local===target)exact=Math.min(exact,instant);else if(local>target&&(local<forwardWall||(local===forwardWall&&instant<forward))){forward=instant;forwardWall=local;}}
  // Date-compatible disambiguation: earliest overlap, advance through a gap.
  if(exact!==Infinity)return exact;
  if(forward!==Infinity)return forward;
  throw new RangeError('Activity midnight cannot be resolved');
}
function legacyMs(fecha,ts,zone){
  zone=canonicalZone(zone);
  if(ts)return Number(ts)||0;
  let m;fecha=String(fecha||'');
  if((m=fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)))return midnight(+m[1],+m[2]-1,+m[3],zone);
  if((m=fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){let y=+m[3];if(y<100)y+=2000;return midnight(y,+m[2]-1,+m[1],zone);}
  return 0;
}
return Object.freeze({canonicalZone,legacyMs});
});
