'use strict';
const {getApps,initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
if(!getApps().length)initializeApp({databaseURL:'https://nixa-sisventas-default-rtdb.firebaseio.com'});
module.exports={auth:getAuth,database:getDatabase};
