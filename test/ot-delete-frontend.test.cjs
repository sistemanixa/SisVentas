'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),P=require('../scripts/lib/ot-delete-frontend.cjs');
function fixture(){const urls=['./js/app.v3.20.0.js','./js/core/version.v3.20.0.js','./js/core/financial-commands.js?v=3.19.0','./js/modules/office-stock.js?v=3.20.0'];return new Map(Object.entries({
 'index.html':"VERSION: 'v3.20.0-firebase';SV_CLIENT_ACCOUNTS_ROLLOUT=Object.freeze({schema:1,enabled:false});SV_CLIENT_HISTORY_ROLLOUT=Object.freeze({schema:1,enabled:false});"+urls.map(u=>'<script src="'+u+'"></script>').join(''),
 'sw.js':"const CACHE = 'sisventas-v3.20.0';const SHELL = ["+urls.map(u=>JSON.stringify(u)).join(',')+"];",
 'js/app.v3.20.0.js':"VERSION: 'v3.20.0-firebase';\n Object.freeze({version:'v3.20.0'});\nasync function eliminarOT(fbKey) {\n    notify('Verificando la OT…');\n}\nfunction buscarProveedor(){}",
 'js/core/version.js':"window.SISVENTAS_PWA_VERSION = 'v3.20.0';",
 'js/core/version.v3.20.0.js':"window.SISVENTAS_PWA_VERSION = 'v3.20.0';",
 'js/core/financial-commands.js':'existing financial operations',
 'js/modules/office-stock.js':'unchanged stock',
 'js/core/payment.js':'unchanged payments'
 }).map(([p,s])=>[p,Buffer.from(s)]));}
test('OT public composition creates a new immutable app and leaves original assets unchanged',()=>{const base=fixture(),snapshot=new Map([...base].map(([p,b])=>[p,Buffer.from(b)])),next=P.plan(base,Buffer.from('new commands'));a.deepEqual(base,snapshot);a.ok(next.get('js/app.v3.20.0.js').equals(base.get('js/app.v3.20.0.js')));a.match(next.get('js/app.v3.20.1.js').toString(),/await window.SVFinancialCommands.canDeleteOT/);a.equal(next.get('js/modules/office-stock.js').toString(),'unchanged stock');a.equal(next.get('js/core/payment.js').toString(),'unchanged payments');});
test('version, cache and command URL advance together without enabling other rollouts',()=>{const next=P.plan(fixture(),Buffer.from('new commands'));for(const p of ['index.html','sw.js'])a.match(next.get(p).toString(),/financial-commands.js\?v=3.20.1/);a.match(next.get('sw.js').toString(),/sisventas-v3.20.1/);a.equal(next.get('js/core/version.js').toString(),next.get('js/core/version.v3.20.1.js').toString());a.match(next.get('index.html').toString(),/ACCOUNTS_ROLLOUT=Object.freeze\(\{schema:1,enabled:false\}\)/);});
test('unreviewed base and occupied target reject before producing a package',()=>{const x=fixture();x.set('js/app.v3.20.1.js',Buffer.from('occupied'));a.throws(()=>P.plan(x,Buffer.from('commands')));const y=fixture();y.set('index.html',Buffer.from('unknown'));a.throws(()=>P.plan(y,Buffer.from('commands')));});
