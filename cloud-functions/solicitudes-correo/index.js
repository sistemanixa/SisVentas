'use strict';
const functions=require('@google-cloud/functions-framework');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const nodemailer=require('nodemailer');
const {dispatch}=require('./mail.cjs');
initializeApp({databaseURL:'https://nixa-sisventas-default-rtdb.firebaseio.com'});
function handler(type,path){return async cloudEvent=>{
 const ref=String(cloudEvent.ref||'').replace(/^\/+|\/+$/g,'');
 const parts=ref.split('/');
 if(parts.length!==2||parts[0]!==path||!parts[1])throw Error('Referencia de evento inválida');
 const event=(await getDatabase().ref(ref).get()).val();
 if(!event)throw Error('Registro de atención no disponible');
 const transport=nodemailer.createTransport({service:'gmail',auth:{user:'nixa@sistemanixa.com',pass:process.env.NIXA_GMAIL_APP_PASSWORD},connectionTimeout:15000,socketTimeout:30000});
 try{await dispatch({db:getDatabase(),id:parts[1],type,event,send:message=>transport.sendMail(message)});}finally{transport.close();}
};}
functions.cloudEvent('correoSolicitudConfirmada',handler('confirmada','sv_catalogo_solicitudes_atencion'));
functions.cloudEvent('correoSolicitudDeclinada',handler('declinada','sv_catalogo_solicitudes_declinacion'));

