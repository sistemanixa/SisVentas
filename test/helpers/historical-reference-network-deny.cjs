'use strict';
// Child-process safeguard for this local, in-memory matrix. No listeners,
// emulator, remote Auth, REST endpoint or Google credentials are required.
const deny=()=>{throw Error('historical-reference matrix forbids network transports');};
global.fetch=async()=>deny();
for(const name of ['node:http','node:https']){const api=require(name);api.request=deny;api.get=deny;}
const net=require('node:net');net.connect=deny;net.createConnection=deny;
