const {createHash}=require('node:crypto');

// Sólo memoria del servidor. Nunca almacenar credenciales ni respuestas
// privadas en el navegador o en una caché pública.
function crearCache({ttl=60000, max=300, ahora=Date.now}={}) {
  const resultados=new Map(), pendientes=new Map(), bloqueos=new Map();
  const contadores={consultas:0,reutilizadas:0,compartidas:0,bloqueadas:0};
  async function consultar(clave, trabajo) {
    const bloqueo=bloqueos.get(clave);
    if(bloqueo && bloqueo.hasta>ahora()) {contadores.bloqueadas++;const e=new Error(bloqueo.mensaje);e.codigo=bloqueo.codigo;throw e;}
    bloqueos.delete(clave);
    const previa=resultados.get(clave);
    if(previa && previa.hasta>ahora()) {contadores.reutilizadas++;return structuredClone(previa.valor);}
    resultados.delete(clave);
    if(pendientes.has(clave)){contadores.compartidas++;return structuredClone(await pendientes.get(clave));}
    contadores.consultas++;
    const promesa=Promise.resolve().then(trabajo).then(valor=>{
      // No reutilizar errores, dudas de identidad ni valores vacíos.
      if(valor && valor.ok===true && !valor.requiereConfirmacionIdentidad) {
        for(const [k,v] of resultados)if(v.hasta<=ahora())resultados.delete(k);
        while(resultados.size>=max)resultados.delete(resultados.keys().next().value);
        resultados.set(clave,{hasta:ahora()+ttl,valor:structuredClone(valor)});
      }
      return valor;
    }).catch(error=>{
      if(error.codigo==='ML_VERIFICACION_SEGURIDAD') {
        while(bloqueos.size>=max)bloqueos.delete(bloqueos.keys().next().value);
        bloqueos.set(clave,{hasta:ahora()+120000,codigo:error.codigo,mensaje:error.message});
      }
      throw error;
    }).finally(()=>pendientes.delete(clave));
    pendientes.set(clave,promesa);
    return structuredClone(await promesa);
  }
  return {consultar,estadisticas:()=>({...contadores,guardadas:resultados.size,enCurso:pendientes.size})};
}
function claveConsulta(proveedor, solicitud) {
  // Incluye permisos comerciales, credenciales, URL/variante, identidad y
  // contexto de validación. Un cambio de cualquiera invalida el resultado.
  return createHash('sha256').update(JSON.stringify([proveedor,solicitud])).digest('hex');
}
module.exports={crearCache,claveConsulta};
