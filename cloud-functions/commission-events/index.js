'use strict';
const {GoogleAuth}=require('google-auth-library'),{createForwarder}=require('./forwarder');
const auth=new GoogleAuth();let identity;
exports.sisventasCommissionEventForward=createForwarder({instance:process.env.COMMISSION_EVENT_INSTANCE,target:process.env.COMMISSION_EVENT_TARGET,deliveryURL:process.env.COMMISSION_EVENT_DELIVERY_URL||process.env.COMMISSION_EVENT_TARGET,probeRef:process.env.COMMISSION_EVENT_PROBE_REF||'',client:async audience=>{identity ||= auth.getIdTokenClient(audience).catch(error=>{identity=null;throw error;});return identity;},logger:entry=>console.log(JSON.stringify(entry))});
