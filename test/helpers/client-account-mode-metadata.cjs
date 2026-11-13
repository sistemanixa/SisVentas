'use strict';
// Synthetic server metadata, shared by bridge tests, not application code.
function account(config){return config&&typeof config==='object'?{scopeBootstrapVersion:1,...structuredClone(config)}:config;}
function pages(config){if(config===null||config?.ready===false&&!config?.writerMode)return{schema:1,ready:true,generation:'legacy-pages-fixture'};const c=account(config),envelope={schema:c?.schema,generation:c?.generation,writerMode:c?.writerMode,scopeBootstrapVersion:c?.scopeBootstrapVersion};return{schema:1,ready:true,generation:'pages-fixture',accountWriter:envelope};}
function value(path,config){if(path==='sv_commercial_pages_config')return pages(config);if(path==='sv_client_accounts_config')return account(config);throw Error('Unexpected metadata path: '+path);}
module.exports={account,pages,value};
