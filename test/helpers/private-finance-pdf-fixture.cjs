'use strict';
// PDF sintético pequeño para extracción/render; no proviene de un banco.
module.exports=function(pages=1){
 if(!Number.isInteger(pages)||pages<1||pages>10)throw Error('Cantidad ficticia de páginas inválida');
 const lines=['RESUMEN FICTICIO DE PRUEBA','Periodo: 2026-09','Cierre: 15/09/2026','Vencimiento: 05/10/2026','Saldo anterior ARS: 0,00','Saldo actual ARS: 250,00','Saldo actual USD: 0,00','Pago minimo ARS: 25,00','TEM: 5,25%','15/09/2026 Compra ficticia ARS 250,00'];
 const stream='BT /F1 11 Tf 45 760 Td '+lines.map((t,i)=>(i?'0 -22 Td ':'')+'('+t.replace(/[()\\]/g,'\\$&')+') Tj').join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream'];
 const kids=['3 0 R'];for(let i=1;i<pages;i++){objects.push(objects[2]);kids.push(objects.length+' 0 R');}objects[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages+' >>';
 let value='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(value));value+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const start=Buffer.byteLength(value),size=objects.length+1;value+='xref\n0 '+size+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+size+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';return Buffer.from(value);
};
