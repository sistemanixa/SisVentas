const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const index=fs.readFileSync('index.html','utf8'),src=fs.readFileSync(index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1],'utf8');const code=src.slice(src.indexOf('async function _resolverRolYCompletarLogin'),src.indexOf('async function _cancelarAutenticacionParcial'));
function setup(role,options={}){
 let complete=0,rejected=0,timer;
 const user={uid:'u',email:'user@example.com'},document=new EventTarget();document.hidden=false;document.visibilityState='visible';
 const record={uid:'u',rol:role,activo:true,nombre:'Prueba'};
 const w={fbAuth:{currentUser:user},svPrepararRutasSeguridad:async()=>{if(options.prepareError)throw Error('offline');},svRutaUsuarios:()=> 'sv_usuarios',fbRef:(_,p)=>p,
  fbGet:async p=>{if(options.slow)return new Promise(()=>{});return {val:()=>p==='sv_usuarios'?(options.missing?{}:{key:record}):{rol:options.identityRole||role,activo:!options.inactive}};}};
 const ctx={window:w,document,Event,AbortController,currentRole:'admin',currentUserUid:'',currentUserEmail:'',setTimeout:f=>(timer=f,1),clearTimeout(){},
  _completarLogin:()=>complete++,_cancelarAutenticacionParcial:()=>{rejected++;ctx.currentRole='';ctx.currentUserUid='';},console};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,run:()=>ctx._resolverRolYCompletarLogin(user),async timeout(){for(let attempt=0;attempt<100&&!timer;attempt++)await new Promise(setImmediate);if(!timer)throw Error('El fixture no alcanzó el plazo de verificación de rol');timer();},counts:()=>({complete,rejected})};
}
for(const role of ['admin','administrativo','vendedor','tecnico','tecnico_vendedor'])test('conserva rol protegido '+role,async()=>{const x=setup(role);await x.run();assert.equal(x.ctx.currentRole,role);assert.deepEqual(x.counts(),{complete:1,rejected:0});});
for(const opts of [{prepareError:true},{missing:true},{identityRole:'vendedor'},{inactive:true}])test('rechaza acceso no verificado '+JSON.stringify(opts),async()=>{const x=setup('tecnico',opts);await x.run();assert.equal(x.ctx.currentRole,'');assert.deepEqual(x.counts(),{complete:0,rejected:1});});
test('demora no concede vendedor',async()=>{const x=setup('tecnico',{slow:true});x.run();await x.timeout();assert.deepEqual(x.counts(),{complete:0,rejected:1});assert.equal(x.ctx.currentRole,'');});
