'use strict';
// Offline compatibility gate. Activate writerSchema=2 only at the reviewed cut.
const Financial=require('../../cotizador/sale-financial-dependencies-protocol');
const closed=value=>value===undefined||value===false||value==='false';
const gate="((root.child('sv_labor_config/writerSchema').val() !== 2 && !root.child('sv_client_history/v1/state').exists() && !root.child('sv_client_accounts/v1/coverage/all').exists() && !root.child('sv_sale_financial_dependencies/v1').exists()) || auth.token.svLaborWriterSchema === 2)";
const historyGate="(!root.child('sv_client_history/v1/state').exists() || auth.token.svClientHistoryWriterVersion === 1)";
function prepare(input){const out=structuredClone(input),root=out.rules;if(!root||!closed(root['.write']))throw Error('Revisar autoridad padre del protocolo.');
 const targets=[[root.sv_labor_guard,'.write',true],[root.sv_labor_receipts?.$op,'.write',false],[root.sv_labor_indexes,'.write',false]];
 for(const [node,key,abort]of targets){if(!node||typeof node[key]!=='string'||!node[key].includes('svLaborService')||!node[key].includes('sv_labor_guard'))throw Error('Falta autoridad coordinada verificable.');const suffix=' && (('+gate+' && '+historyGate+' && '+Financial.gate+')'+(abort?" || auth.token.mode === 'abort'":'')+')';if(!node[key].endsWith(suffix))node[key]='('+node[key]+')'+suffix;}
 if(!root.sv_labor_config||root.sv_labor_config.writerSchema)throw Error('Revisar la configuración existente del protocolo.');root.sv_labor_config.writerSchema={'.validate':'newData.val() === 2'};
 return out;
}
module.exports={prepare,gate,historyGate,financialGate:Financial.gate};
