'use strict';
// Container checks must not access production, metadata, DNS or any network.
const deny=()=>{throw Error('Network is forbidden in isolated Stock image checks');};
globalThis.fetch=deny;for(const [module,names]of [['node:http',['request','get']],['node:https',['request','get']],['node:net',['connect','createConnection']],['node:tls',['connect']],['node:dns',['lookup','resolve']],['node:dgram',['createSocket']],['node:child_process',['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']]]){const api=require(module);for(const n of names)api[n]=deny;}
