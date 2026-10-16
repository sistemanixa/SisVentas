'use strict';
const {execFileSync}=require('node:child_process');
function windowsCommand(args){
  return '& (Get-Command gcloud.cmd -ErrorAction Stop).Source '+args.map(value=>"'"+String(value).replaceAll("'","''")+"'").join(' ');
}
function gcloud(args){
  const windows=process.platform==='win32';
  return execFileSync(windows?'powershell.exe':'gcloud',windows?['-NoProfile','-NonInteractive','-Command',windowsCommand(args)]:args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
}
module.exports={gcloud,windowsCommand};
