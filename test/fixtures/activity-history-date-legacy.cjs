'use strict';
// Frozen date oracle from activity-history.js at 9779d059; production no longer reparses originals.
module.exports=function fechaMs321(f,ts){ if(ts) return Number(ts)||0; var d=null; f=String(f||''); var m; if((m=f.match(/^(\d{4})-(\d{2})-(\d{2})/))) d=new Date(+m[1],+m[2]-1,+m[3]); else if((m=f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))){ var y=+m[3]; if(y<100)y+=2000; d=new Date(y,+m[2]-1,+m[1]); } return d?d.getTime():0; };
