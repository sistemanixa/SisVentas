'use strict';
// The deployment principal (OAuth Admin) publishes the marker; ordinary RTDB
// sessions, including administrator application users, may never alter it.
const closed=v=>v===undefined||v===false||v==='false';
function prepare(input){const out=structuredClone(input),r=out?.rules;if(!r||!closed(r['.read'])||!closed(r['.write']))throw Error('Review parent read/write grants before adding a private attestation.');for(const[k,v]of Object.entries(r))if(k.startsWith('$')&&v&&typeof v==='object'&&JSON.stringify(v).match(/"\.(?:read|write)":(?!false|"false")/))throw Error('A root wildcard may expose/overwrite deployment attestation.');const parent=r.sv_deployment_attestations;if(parent&&(!closed(parent['.read'])||!closed(parent['.write'])||Object.keys(parent).some(k=>k.startsWith('$'))))throw Error('Review deployment attestation namespace authority.');r.sv_deployment_attestations={...(parent||{}),'.read':false,'.write':false,ot_delivery:{'.read':false,'.write':false}};return out;}
module.exports={prepare};
