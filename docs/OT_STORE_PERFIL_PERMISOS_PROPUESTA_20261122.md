# Propuesta separada: lecturas frescas de autoridad OT en store

Sólo para revisión por el propietario del store y el integrador. No aplicada. Fuente examinada: `labor-rtdb-store.js`, función `commit`, en la base652; revisar el contexto integrado de E/A antes de cualquier cambio.

La rama OT valida actualmente perfil y permisos con dos awaits consecutivos antes de derivar el token y ejecutar la validación de commit. Son fuentes independientes una vez que `actor.uid` y `actor.role` provienen del contexto interno autorizado. El siguiente diff propuesto conserva ambas lecturas frescas y la misma función de validación, esperando todos los resultados antes de propagar cualquier error:

```diff
- if(actor?.otLifecycle)require('./ot-lifecycle-policy').validate(actor,await read('sv_chat_roles/'+actor.uid),await read('sv_permisos/'+actor.role));
+ if(actor?.otLifecycle){
+  const checks=await Promise.allSettled([
+   read('sv_chat_roles/'+actor.uid),
+   read('sv_permisos/'+actor.role)
+  ]);
+  const failed=checks.find(result=>result.status==='rejected');
+  if(failed)throw failed.reason;
+  require('./ot-lifecycle-policy').validate(actor,checks[0].value,checks[1].value);
+ }
```

No sustituir por planning ni por TTL; no usar rol/uid del body. Conservar esta validación antes de claims/OT proof/PATCH. No afecta por sí sola la cantidad de requests. No se ha medido ni probado este diff: antes de aceptarlo deben mantenerse los negativos de revocación, cambio de rol/revisión/UID, lectura fallida en cualquiera de ambas ramas y ausencia de PATCH. Verificar también el hook Stock integrado y las ramas combinadas `commercialContext`/OT para no duplicar ni debilitar autoridad.

El frente D no editó el store por este pedido. No implica despliegue ni autorización para cambiar reglas, recibos o claims genéricos.
