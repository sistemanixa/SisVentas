'use strict';
const fs=require('node:fs');
let guarded;
function rulesFor(stage){
 if(process.env.SV_SECURITY_ACCESS_GUARD!=='1')return fs.readFileSync('security/database.'+stage+'.candidate.json','utf8');
 guarded||=require('../../scripts/prepare-access-permission-stages.cjs').buildStages();
 if(!guarded.stages[stage])throw Error('Etapa no registrada: '+stage);
 return JSON.stringify(guarded.stages[stage]);
}
module.exports={rulesFor};
