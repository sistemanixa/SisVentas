'use strict';
const fs=require('node:fs'),path=require('node:path');
// Prefer the explicitly configured test browser, then Playwright's installation.
// Windows developer machines may have Chrome without the downloaded test shell.
function executablePath(chromium){
 const explicit=process.env.SV_TEST_CHROME||process.env.SV_TEST_CHROMIUM||process.env.CHROME_BIN;if(explicit)return explicit;
 if(fs.existsSync(chromium.executablePath()))return undefined;
 if(process.platform!=='win32')return undefined;
 const candidates=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)']].filter(Boolean).map(p=>path.join(p,'Google/Chrome/Application/chrome.exe'));
 return candidates.find(p=>fs.existsSync(p));
}
module.exports={executablePath};
