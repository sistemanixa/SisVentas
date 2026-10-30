'use strict';
const Model=require('../../js/core/chat-header-model');
// Pure proposal: this module never contacts Firebase or applies rules.
function prepare(input){
 if(input?.rules?.['.read']!==false&&input?.rules?.['.read']!=null||input?.rules?.['.write']!==false&&input?.rules?.['.write']!=null)throw Error('Revisar permisos del padre raíz antes de preparar índices.');
 const out=structuredClone(input),rules=out.rules,channel=rules?.sv_chat?.$canal,message=channel?.$mensaje;
 if(!message||rules.sv_chat_headers||typeof channel['.read']!=='string'||typeof message['.write']!=='string')throw Error('Revisar reglas de Chat antes de preparar sus resúmenes');
 if(rules.sv_chat['.read']!==false&&rules.sv_chat['.read']!=null||rules.sv_chat['.write']!==false&&rules.sv_chat['.write']!=null)throw Error('Revisar permisos del padre Chat.');
 const access=channel['.read'],header="newData.parent().parent().parent().child('sv_chat_headers').child($canal).child($mensaje)",source="newData.parent().parent().parent().child('sv_chat').child($canal).child($mensaje)";
 channel['.read']='('+access+") && query.orderByChild === 'ts' && query.limitToLast > 0 && query.limitToLast <= 100";
 message['.read']=access;
 const matches=(body,summary)=>Model.chatFields.map(f=>summary+".child('"+f+"').val() === "+body+".child('"+f+"').val()").concat(['fotoUrl','audioUrl','archivoUrl'].map(f=>'('+body+".child('"+f+"').exists() && "+body+".child('"+f+"').val() !== '' ? "+summary+".child('"+f+"').val() === true : !"+summary+".child('"+f+"').exists())")).join(' && ');
 const trusted="auth != null && auth.token.svChatService === true";
 const service='('+trusted+') && ('+access+") && data.exists() && data.child('eliminado').val() !== true && (data.child('autorUid').val() === auth.uid || (!data.child('autorUid').exists() && auth.token.svChatLegacyOwner === true)) && data.child('texto').val() === auth.token.svChatExpectedText && data.child('editadoEn').val() === auth.token.svChatExpectedEdit && (auth.token.svChatAction === 'editar' || (auth.token.svChatAction === 'eliminar' && data.child('leidoNonce').val() === auth.token.svChatExpectedRead))";
 message['.write']='('+message['.write']+') || ('+service+')';
 message['.validate']='('+matches('newData',header)+')';
 channel['.indexOn']=Array.from(new Set([...(Array.isArray(channel['.indexOn'])?channel['.indexOn']:[]),'ts']));
 // Unchanged legacy fields must survive a protected edit; never authorize a
 // client to introduce an unknown field or change somebody else's authorship.
 for(const [field,rule]of Object.entries(message))if(!field.startsWith('.')&&field!=='$other'&&rule['.validate'])rule['.validate']='('+rule['.validate']+') || (('+trusted+') && newData.val() === data.val())';
 for(const field of ['editadoEn','eliminadoEn'])message[field]={'.validate':'('+trusted+') && newData.isNumber() && newData.val() >= 0'};
 for(const field of ['editadoPorUid','eliminadoPorUid'])message[field]={'.validate':'('+trusted+') && newData.val() === auth.uid'};
 message.eliminado={'.validate':'('+trusted+') && newData.val() === true'};
 message.$other={'.validate':'('+trusted+') && newData.val() === data.val()'};
 const marker=message.leido?.$uid;if(!marker||typeof marker['.write']!=='string')throw Error('Falta contrato de lectura por identidad');
 const markerRoot="newData.parent().parent().parent().parent().parent()",sourceMessage=markerRoot+".child('sv_chat').child($canal).child($mensaje)",headerMessage=markerRoot+".child('sv_chat_headers').child($canal).child($mensaje)";
 const freshNonce=sourceMessage+".child('leidoNonce').isString() && "+sourceMessage+".child('leidoNonce').val() !== root.child('sv_chat').child($canal).child($mensaje).child('leidoNonce').val() && "+sourceMessage+".child('leidoNonce').val() === "+headerMessage+".child('leidoNonce').val()";
 marker['.write']='('+marker['.write']+') && '+headerMessage+".child('leido').child($uid).val() === true && "+freshNonce;
 message.leidoNonce={'.write':'('+access+') && newData.isString() && newData.val() !== data.val() && newData.parent().parent().parent().parent().child(\'sv_chat_headers\').child($canal).child($mensaje).child(\'leidoNonce\').val() === newData.val()', '.validate':'newData.isString() && newData.val().length <= 80'};
 const row={'.write':'('+access+') && (('+trusted+') || (newData.exists() && !data.exists() && !root.child(\'sv_chat\').child($canal).child($mensaje).exists() && '+source+'.exists()) || (!newData.exists() && !'+source+'.exists()))','.validate':matches(source,'newData')};
 for(const field of Model.chatFields)row[field]={'.validate':"newData.val() === "+source.replace('newData.parent().parent().parent()','newData.parent().parent().parent().parent()')+".child('"+field+"').val()"};
 for(const field of ['fotoUrl','audioUrl','archivoUrl'])row[field]={'.validate':'newData.val() === true'};
 row.leido={$uid:{'.write':'('+access+') && $uid === auth.uid && newData.val() === true && '+freshNonce,'.validate':"newData.val() === true && "+sourceMessage+".child('leido').child($uid).val() === true"}};
 row.leidoNonce['.write']='('+access+') && newData.isString() && newData.val() === newData.parent().parent().parent().parent().child(\'sv_chat\').child($canal).child($mensaje).child(\'leidoNonce\').val() && newData.val() !== root.child(\'sv_chat\').child($canal).child($mensaje).child(\'leidoNonce\').val()';
 row.$other={'.validate':false};
 rules.sv_chat_headers={$canal:{'.read':access,'.write':'('+channel['.write']+") && !newData.exists() && !newData.parent().parent().child('sv_chat').child($canal).exists()",$mensaje:row}};
 channel['.write']='('+channel['.write']+") && !newData.parent().parent().child('sv_chat_headers').child($canal).exists()";
 return out;
}
module.exports={prepare};
