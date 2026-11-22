# Auditoría integral reanudada · 22/11/2026

Autorización del titular: revisar pendientes y corregir en paralelo. Se trabaja en local, con datos ficticios, sin operaciones comerciales reales, cambios de permisos, compilaciones remotas ni publicación durante la investigación. Esta reanudación reemplaza la pausa de la auditoría general para este alcance.

## Base comprobada

- Web consultada por HTTP: v3.21.2-firebase. El índice referencia app.v3.21.2.js.
- Base limpia de integración:060c77f8; código público5e4bb83d. Copia central: C:/SisVentas/.local/auditoria-integral-20261122, rama codex/auditoria-integral-20261122.
- origin/main actualizado por fetch:4639a87b, limpieza sobre una base histórica. No representa automáticamente el código publicado. No importar eliminaciones de tests para resolver fallos.
- C:/SisVentas está atrasado y tiene cambios desconocidos conservados. Los cinco frentes usan worktrees propios; nadie edita el checkout de otro frente.

## Reparto y propiedad

| Frente | Dueño funcional | Pendientes de base | Entregable |
|---|---|---|---|
| A | Recibos y operaciones comerciales |8fallos de revocación/recuperación/concurrencia, eliminaciones de ventas y comisiones | Reproducción, corrección, pruebas, commit aislado |
| B | Claims y empaquetado |1fallo de claims reservados +2de Docker/dependencias | Commits separados de claims y paquete, sin ampliar permisos |
| C | Gastos y consultas |4fallos de retorno de Gastos; cobertura histórica, buscadores y recargas | Funciones de frontend y pruebas nativas, sin modificar escritores comerciales |
| D | OT y Tecnoprices |1fallo HTTP incierto OT; entregas/instalaciones/remitos/eliminación y proveedor | Ciclos sintéticos e idempotencia/latencia; sin usar OTs reales |
| E | Stock de oficina | Lectura positiva, orden/páginas, alta por búsqueda y Revisar vínculo | Conservación de cantidades/historial, pruebas de UI y servicio |
| Coordinación | Inventario, compatibilidad e integración |91omisiones documentadas deben clasificarse; pruebas generales y regresión cruzada | Registro único, conflictos por función, cobertura explícita |

El store laboral puede recibir funciones distintas de A/B; cada uno entrega un commit propio y la integración revisa el conflicto. Ningún frente cambia index, SW, versión o configuración de producción. La comprobación general se ejecuta centralmente para no multiplicar navegadores ni presentar cinco suites independientes como prueba del conjunto.

## Criterios de cierre

Un fallo se marca resuelto sólo con causa, reproducción y prueba del cambio en la fuente actual. Si es una fixture obsoleta, se demuestra el contrato vigente sin debilitar permisos ni invariantes. Conservar los fallos anteriores y pruebas omitidas como evidencia; no atribuir cobertura a tests no ejecutados. Validar éxito, rechazo, permisos revocados, respuestas tardías, concurrencia y reintento incierto según el circuito.

La suite de referencia anterior fue11041total/10934PASS/16FAIL/91SKIP. Primera corrida central diagnóstica sobre3510ef2f:11058total/10962PASS/5FAIL/91SKIP; los16fallos de referencia ya no aparecen y se detectaron4expectativas viejas de esquema y1preservación exacta de Stock tras el cambio aprobado. Se conservaron hashes originales y se probó una derivación acotada/adversarial, no se reemplazaron para ocultar cambios. Contrato de claims distingue esquema de capacidades con inyección maliciosa neutralizada. Segunda puerta completa, fuente fija9dec32e6ef26a1ac1d3cd54d3de61d28eb842fb6:11089total/10998PASS/0FAIL/91SKIP/0canceladas, Node24.17.0 y Chrome existente. No se modificó código durante esa corrida. La corrida inicial de preparación se interrumpió al integrar los primeros bloques: preintegracion-parcial.private.log no es una certificación de baseline completa. Logs y artefactos van en C:/SisVentas/tmp/auditoria-integral-20261122, fuera de Git.

## Evidencia adicional y pendientes reales

Pruebas fuera de puerta, con datos ficticios: compartir preview2PASS, presentación genérica18PASS, recuperación nativa3PASS; protocolos mínimos19PASS en emulador efímero y control completo con copia de reglas reales2PASS (gasto por modelo/acceso/guard/store/índices; válido confirma una vez y revocaciones rechazan). Los19casos mínimos no sirven sin cambios como prueba positiva de todo el baseline: al aplicarlo íntegro11PASS/8FAIL por preparación financiera incompleta, conservados por separado; el control completo existe precisamente para no atribuirlos falsamente al claim2. No se transforma una matriz parcial en cobertura global.

Los frentes aportan informes separados: A154casos; B35y matriz19; C114lectores+6garantías+346casos económicos distintos; D445PASS/13SKIP; E43casos base. No sumar esos conteos a la puerta ni entre sí: hay solapamientos y condiciones diferentes. Las91omisiones globales siguen inventariadas, con opt-ins ejecutados por separado y artefactos privados faltantes expresamente no certificados.

Lecturas externas autorizadas de metadata, sin registros comerciales: localHTTP y web entregan21.2; Cotizador cotizador-otropa-cc198f6e concentra100%y15tags, digest55e5d728480cf490b36d78591cf5441095ab05c635ed91631de1c927e41eba50. No inferir igualdad de fuentes por nombre de revisión. Reglas RTDB leídas porGET, copia privada3576401bytes SHA256ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db. No hubo PUT remoto, build, cambio de tráfico/permisos ni operaciones reales. El conectorFirebase no tenía sesión; se usó CLI existente sin imprimir credenciales.

Revisar vínculo de Stock continúa como migración local separada: resolver/plan/política propios preparadosOFF; todos los escritores de Compras/OT deben usar la misma clave física, conservar identidad histórica del recibo y cerrar SDK antiguo tras liberarlease. Catálogo requiere barrera común; se preparó candidato acotado con30pruebas sobre reglas íntegras, aún no aplicado. No hay botón de reparación que guarde mientras esto no esté completo. Este pendiente no se oculta bajo la puerta verde del bloque anterior. Tecnoprices se verifica con fixtures del lector; no se atribuye login/proveedor en vivo ni rendimiento productivo a las simulaciones.
