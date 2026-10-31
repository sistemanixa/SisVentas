(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVCommercialMoney=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
function decimal(value){const s=String(value),m=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);if(!m)throw Error('Importe decimal inválido.');const exponent=Number(m[4]||0),fraction=(m[3]||'').length;if(Math.abs(exponent)>24||s.length>80)throw Error('Importe fuera de rango.');let n=BigInt(m[2]+(m[3]||''))*(m[1]?-1n:1n),scale=fraction-exponent;return scale<0?{n:n*10n**BigInt(-scale),d:1n}:{n,d:10n**BigInt(scale)};}
const multiply=(a,b)=>({n:a.n*b.n,d:a.d*b.d});
function cents(value){const negative=value.n<0n,n=negative?-value.n:value.n,scaled=n*100n,rounded=(scaled*2n+value.d)/(value.d*2n),signed=negative?-rounded:rounded;if(signed>BigInt(Number.MAX_SAFE_INTEGER)||signed<BigInt(Number.MIN_SAFE_INTEGER))throw Error('Importe fuera de rango.');return Number(signed);}
function line(qty,price,discount=0){const d=decimal(discount);if(d.n<0n||d.n>100n*d.d)throw Error('Descuento inválido.');return cents(multiply(multiply(decimal(qty),decimal(price)),{n:100n*d.d-d.n,d:100n*d.d}));}
function discount(centsValue,pct=0){const d=decimal(pct);if(!Number.isSafeInteger(centsValue)||d.n<0n||d.n>100n*d.d)throw Error('Subtotal inválido.');return cents({n:BigInt(centsValue)*(100n*d.d-d.n),d:10000n*d.d});}
function vat(centsValue){if(!Number.isSafeInteger(centsValue))throw Error('Subtotal inválido.');return cents({n:BigInt(centsValue)*21n,d:10000n});}
return Object.freeze({decimal,cents,line,discount,vat});
});
