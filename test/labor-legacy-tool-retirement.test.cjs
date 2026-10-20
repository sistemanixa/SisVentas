'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../scripts/migrar-adjuntos-gastos.ps1');
for(const flag of ['-Apply','-Restore'])test('el migrador anterior rechaza '+flag+' antes de obtener credenciales o tocar datos',t=>{
 const result=spawnSync(process.platform==='win32'?'powershell':'pwsh',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,flag],{encoding:'utf8',windowsHide:true,timeout:10000});
 if(result.error?.code==='ENOENT'){t.skip('PowerShell no está disponible en este entorno');return;}
 assert.ifError(result.error);assert.notEqual(result.status,0);
 const output=result.stdout+result.stderr;
 assert.match(output,/herramienta de escritura directa fue retirada/);
 assert.doesNotMatch(output,/Google Cloud SDK|autenticacion|gastos\.json|gastos_adjuntos\.json|Bearer/);
});
