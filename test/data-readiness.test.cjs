const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('carga distingue pendiente, vacío confirmado, error y sesión nueva',()=>{
 const context={URL,window:{addEventListener:()=>{}},document:{addEventListener:()=>{}},requestAnimationFrame:()=>{}};
 vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),context);
 const api=context.window.SVDataReadiness;
 assert.equal(api.status(['productos']).ready,false);
 const token=api.begin('https://example.com/sisventas/productos');token.error();
 assert.equal(api.status(['productos']).ready,false);assert.equal(api.status(['productos']).errors.length,1);
 token.ready();assert.equal(api.status(['productos']).ready,true);assert.equal(api.status(['productos']).errors.length,0);
 token.error();assert.equal(api.status(['productos']).ready,true);assert.equal(api.status(['productos']).errors.length,1);
 api.reset();token.ready();assert.equal(api.status(['productos']).ready,false);
 const child=api.begin('https://example.com/sisventas/productos/P1');child.ready();assert.equal(api.status(['productos']).ready,false);
 const next=api.begin('https://example.com/sisventas/productos');next.cancel();next.ready();assert.equal(api.status(['productos']).ready,false);
});
test('Firebase informa carga luego de procesar el snapshot y respeta opciones y cancelación',async()=>{
 const source=fs.readFileSync('js/core/firebase.js','utf8');
 const fragment=source.slice(source.indexOf('    const fbValueListeners'),source.indexOf('    window.fbUpdate'));
 let args,ready=0,errors=0,cancel=0,processed=0;
 const context={window:{SVDataReadiness:{begin:()=>({ready:()=>{assert.equal(processed,1);ready++;},error:()=>errors++,cancel:()=>cancel++})}},onValue:(...a)=>{args=a;return ()=>{};},console};
 vm.runInNewContext(fragment,context);
 const stop=context.window.fbOnValue('ref',()=>{processed++;},{onlyOnce:true});
 args[1]({val:()=>null});await Promise.resolve();assert.equal(ready,1);assert.equal(args[3].onlyOnce,true);
 args[2](Error('denied'));assert.equal(errors,1);stop();assert.equal(cancel,1);
});
test('usuarios protegidos completan la carga sin confundir una ficha individual',()=>{
 const c={URL,window:{addEventListener(){}},document:{addEventListener(){}},requestAnimationFrame(){}};vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);const api=c.window.SVDataReadiness;
 api.begin('https://example.com/sv_usuarios/ygil').ready();assert.equal(api.status(['usuarios']).ready,false);
 api.begin('https://example.com/sv_usuarios').ready();assert.equal(api.status(['usuarios']).ready,true);
});
