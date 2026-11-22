'use strict';
const {digest}=require('./labor-guard'),Order=require('./office-stock-order');
function create({store,queryPage,readOrderingFence,hydrate}){
 async function snapshot(){if(typeof readOrderingFence!=='function')throw Order.failure('El orden global de Stock todavía no está preparado.');const config=await store.read(Order.CONFIG),fence=Order.validateFence(await readOrderingFence());if(!config||config.schema!==1||config.ready!==true||config.writersClosed!==true||config.writerVersion!==1||config.generation!==fence.generation||fence.invalidCount!==0)throw Order.failure('El orden global de Stock requiere cobertura y cantidades verificadas.');return{config,fence};}
 async function page(body={}){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['cursor','limit'].includes(k))||body.limit!==undefined&&body.limit!==50)throw Order.failure('Página de Stock inválida.');
  const start=await snapshot(),cursor=body.cursor;
  if(cursor!=null&&(!cursor||Object.keys(cursor).sort().join(',')!=='generation,key,rank,revision'||!Order.key(cursor.key)||!Number.isFinite(cursor.rank)||cursor.rank>=0||cursor.rank< -1e9||cursor.generation!==start.fence.generation||cursor.revision!==start.fence.revision))throw Order.failure('El Stock cambió. Actualizá la lista para continuar.');
  if(cursor){const old=await store.read(Order.INDEX+'/'+cursor.key);if(old?.[Order.RANK]!==cursor.rank||!/^[a-f0-9]{64}$/.test(old?.[Order.HASH]||''))throw Order.failure('El Stock cambió. Actualizá la lista para continuar.');}
  const raw=await queryPage(Order.INDEX,{orderBy:Order.RANK,startAt:cursor?.rank??-1e9,after:cursor?.key||null,limit:cursor?52:51});
  let entries=Object.entries(raw||{}).map(([key,row])=>{if(!Order.key(key)||!row||typeof row[Order.RANK]!=='number'||!Number.isFinite(row[Order.RANK])||row[Order.RANK]>=0||row[Order.RANK]< -1e9||!/^[a-f0-9]{64}$/.test(row[Order.HASH]||''))throw Order.failure('El índice de Stock necesita revisión.');return{key,rank:row[Order.RANK],hash:row[Order.HASH]};}).sort(Order.compare);
  if(cursor)entries=entries.filter(row=>{const comparison=Order.compare(row,cursor);if(comparison<0)throw Order.failure('La página no corresponde al orden solicitado.');return comparison>0;});
  if(entries.length>51)throw Order.failure('La página de Stock supera el límite.');const more=entries.length>50;entries=entries.slice(0,50);if(!cursor&&!more&&entries.length!==start.fence.positiveCount||entries.length>start.fence.positiveCount)throw Order.failure('La cobertura de Stock está incompleta.');
  const rows=[];for(let i=0;i<entries.length;i+=6){const batch=await Promise.all(entries.slice(i,i+6).map(async entry=>{const record=await store.read('sisventas/inventario_operativo/'+entry.key),c=Order.classify(record);if(c.invalid||c.positive!==1||c.rank!==entry.rank||c.hash!==entry.hash)throw Order.failure('El Stock cambió. Actualizá la lista para continuar.');return hydrate(entry.key,record,-entry.rank);}));rows.push(...batch);}
  const end=await snapshot();if(digest(start)!==digest(end))throw Order.failure('El Stock cambió. Actualizá la lista para continuar.');const last=entries.at(-1);return{rows,cursor:more?{generation:start.fence.generation,revision:start.fence.revision,key:last.key,rank:last.rank}:null,ready:true,complete:!more,continuation:more,scanned:entries.length,orderScope:'global',order:'quantity-desc',generation:start.fence.generation,revision:start.fence.revision,totalPositive:start.fence.positiveCount,reviewRequired:rows.some(row=>row.review)};
 }
 return{page};
}
module.exports={create};
