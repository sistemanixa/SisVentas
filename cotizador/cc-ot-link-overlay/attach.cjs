'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const BASE='7936cb65d857ab514186ae9ed33270a065d5494e17850b26bf528ba5f0537e53';
const BRANCH=" if(sale.otId==null&&!['otFbKey','otKey','ordenTrabajoId','ordenTrabajoFbKey','ot','otNumero'].some(k=>sale[k]!=null)&&Object.hasOwn(others,otKey)&&row&&typeof ot.id==='string'&&ot.id.length>0&&row.id===ot.id&&Number.isSafeInteger(row._svListRevision)&&row._svListRevision>0&&row._svListRevision===ot._svListRevision&&row.ventaFbKey===ot.ventaFbKey&&row.ventaId===sale.id&&ot.ventaId===sale.id)return true;";
function apply(source){
 if(sha(source)!==BASE)throw Error('Unknown OT baseline; refused');
 const anchor=' const row=others[otKey],main=others[sale.otId];';
 if(source.split(anchor).length!==2)throw Error('Ambiguous OT link anchor');
 return source.replace(anchor,anchor+(source.includes('\r\n')?'\r\n':'\n')+BRANCH);
}
if(require.main===module){const target=path.join(process.argv[2]||'/app','ot-lifecycle-model.js'),next=apply(fs.readFileSync(target,'utf8'));fs.writeFileSync(target,next);console.log(JSON.stringify({patch:'verified-one-way-ot-link',sha256:sha(next)}));}
module.exports={BASE,BRANCH,apply,sha};
