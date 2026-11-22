# Componente: typed command OFF, sin ruta

Actualización posterior autorizada: STOCK_GUARD_COMPOSICION_20261122.md documenta el hook mínimo ya aplicado y la composición válida con guard/políticas/store reales y transporte ficticio. El bloqueo de tabla de acciones descrito más abajo es histórico; la prueba correspondiente ahora exige confirmación+replay único. El comando sigue OFF/no registrado y las demás barreras pendientes no cambian.

Implementado `cotizador/office-stock-link-command.js`, no registrado/importado por index ni runtime, sin UI, permisos nuevos, reglas aplicadas o writes reales. No edita guard ni su tabla de acciones. El builder de catálogo994341b9 ya comunicado por A no se reproduce ni se considera instalado remotamente.

## Interfaz

`create({authorize, store, guard, loadCoverage, assertBarrier, enabled=false, now})` expone authorize/preview/execute. OFF por defecto. authorize debe ser el verificador real de sesión existente; se rechazan Ver como y claims de identidad divergentes. preview sólo acepta productKey/inventoryKey; execute sólo id/productKey/inventoryKey/reason/expectedHash. No recibe snapshot, coverage, proof, patch ni bandera ready del cliente.

`loadSnapshot` hace lecturas puntuales del producto, mapping por producto e inversas, todos los candidatos de inventario y los forwards necesarios de las inversas. Agrega por hash la evidencia leída por el loader de cobertura. No lee raíces de productos/inventario ni devuelve costos/historial a la UI. Los máximos son límites que RECHAZAN, nunca truncan para elegir primer candidato.

loadCoverage es una dependencia de servidor aún por implementar con índice autoritativo/cobertura completa. Debe devolver schema1/generación, inventarios candidatos, propietarios, alias e identidad histórica respaldada y cobertura verificada. El comando obliga a que haya lecturas de evidencia por el callback en el namespace privado propuesto sv_stock_reference_config/index; el contenido se incluye en el CAS. No hay un índice real creado. Una marca completa inventada por el cliente no sirve porque el body no puede suministrarla y no existe ruta de API. La implementación productiva de ese callback debe validarse con A/B y emulador; la fixture usa datos inventados como doble, no certifica cobertura de producción.

assertBarrier es otra dependencia interna de servidor: comprueba barrera/pins en preview, ejecución bajo lease y antes de commit. No hay implementación que convierta un booleano cliente o config no verificada en readiness real. Sin callbacks, el comando falla cerrado. La barrera de catálogo candidata de A y el cierre de escritores anteriores/mapping deben ser parte de su verificación futura.

## Commit y reintento

El runner es mode=user/operation=office-stock-link/financialAction=stock.ajustar, con permisos derivados de perfil/config actuales. guard.run aporta lease y el recibo genérico original. Se verifica el contexto de permisos, se carga snapshot, se rechaza recibo propio huérfano y se emite la capacidad por Policy.issue. El callback beforeCommit relee identidad/permisos, barrera y snapshot completo frescos; exige hash original y ausencia de recibo propio previo. Sólo se stagingean las3rutas de asociación; el guard existente añade las2coordinadas para el patch exacto que comprueba la política.

Respuesta perdida se recupera por el recibo genérico propio/digest original de guard.run, antes de volver a emitir capacidad; no se fabrica un recibo genérico a partir de un recibo de dominio huérfano. No se modifica inventario, producto ni ledger. La orquestación positiva se prueba con un doble de guard que aplica los checks y la política real; no debe confundirse con integración habilitada del guard genérico.

## Hook genérico mínimo solicitado, NO aplicado

La prueba con createLaborGuard real demuestra que validateFinancialContext actualmente rechaza stock.ajustar (no figura en actions). No se usó otra acción ni se omitió financialAction para eludirlo. Interfaz concreta propuesta para acuerdo del coordinador:

Agregar únicamente a la tabla actions de validateFinancialContext, en cotizador/labor-guard.js, la entrada `stock.ajustar: [stockoficina, stock, ajustar, [admin, administrativo]]`. Conserva los chequeos existentes de perfil/revisión/digest y las verificaciones adicionales de productos de la política específica. No cambiar opId/claims/recibos genéricos ni añadir una vía arbitraria de escritura. Hasta autorizar/revisar esa entrada, la prueba del guard real espera RECHAZO, y el componente sigue OFF.

## Pruebas

14 casos: OFF, rechazo de readiness/snapshot cliente, preview puntual sin filtración, patch exacto bajo lease/doble y Policy real, replay tras pérdida de ACK, CAS de inventario/producto/permisos/generación/inversa, barrera revocada en final, falta de verificadores, Ver como/identidad alterada, recibo huérfano y rechazo explícito de guard real sin la entrada de acción. El primer intento falló por una llave faltante en la fixture y se corrigió su sintaxis; no se modificaron expectativas para ocultar un fallo de producto.

Siguiente componente: lectores/escritores con ausencia de mapping conservando su recorrido actual e identidad de recibos, y pruebas de la matriz D. No habilitar UI hasta comandos de Compras, barrera postlease, reglas cerradas de mapping y carreras completas. Suite general sólo coordinador; sin navegador/remotos/builds.
