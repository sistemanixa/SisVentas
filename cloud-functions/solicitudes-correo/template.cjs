'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderEmail({name,list,reason,confirmed}){
const color=confirmed?'#80d98b':'#f1c56b',title=confirmed?'Tu pedido ya está en gestión':'Una actualización sobre tu pedido';
return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#eef2f8">
<div style="display:none;max-height:0;overflow:hidden">${esc(title)} · ${esc(list)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:0 8px 22px"><span style="font-size:24px;font-weight:bold;color:#eef2f8">SisVentas</span><br><span style="font-size:12px;color:#93a4bf">Distribuidora · Nixa</span></td></tr>
<tr><td style="padding:30px 24px;background:#141e2e;border:1px solid #2c3b52;border-top:3px solid ${color};border-radius:14px">
<span style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${color}">${confirmed?'SOLICITUD CONFIRMADA':'SOLICITUD DECLINADA'}</span>
<h1 style="font-size:26px;line-height:1.25;margin:16px 0 22px;color:#eef2f8">${title}</h1>
<p style="font-size:15px;line-height:1.6;color:#cbd5e6;margin:0 0 12px">Hola${name?' '+esc(name):''},</p>
<p style="font-size:15px;line-height:1.6;color:#cbd5e6;margin:0 0 22px">${confirmed?'Recibimos tu solicitud y creamos la lista de compras para gestionarla. Te contactaremos para coordinar los próximos pasos.':'En esta ocasión no podemos completar tu solicitud. A continuación te contamos el motivo.'}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:18px;background:#1d2a42;border-radius:10px"><span style="font-size:11px;color:#93a4bf">TU PEDIDO</span><p style="margin:8px 0 0;font-size:16px;font-weight:bold;line-height:1.5;color:#eef2f8;overflow-wrap:anywhere">${esc(list)}</p>${confirmed?'':`<p style="margin:18px 0 6px;font-size:11px;color:${color}">MOTIVO</p><p style="margin:0;font-size:14px;line-height:1.6;color:#cbd5e6">${esc(reason).replace(/\r?\n/g,'<br>')}</p>`}</td></tr></table>
<p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#cbd5e6">${confirmed?'Gracias por elegirnos.':'Si querés consultar otras opciones, estamos para ayudarte.'}<br>Podés responder este correo y hablar con nuestro equipo.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td bgcolor="${color}" style="border-radius:8px"><a href="https://ventas.sistemanixa.com/catalogo.html" style="display:inline-block;padding:13px 20px;font-size:14px;font-weight:bold;color:#0b1220;text-decoration:none">Ver catálogo</a></td></tr></table>
</td></tr><tr><td style="padding:22px 8px;font-size:12px;line-height:1.7;color:#93a4bf">Nixa · nixa@sistemanixa.com<br>${confirmed?'Esta confirmación corresponde a la atención de tu solicitud; no confirma despacho ni entrega.':'Mensaje sobre la solicitud que enviaste desde nuestro catálogo.'}</td></tr></table></td></tr></table></body></html>`;
}
module.exports={renderEmail};
