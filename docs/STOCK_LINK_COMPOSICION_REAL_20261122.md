# Composición real de vínculo y recuperación — 22/11/2026

Se compone la interfaz y adaptador reales con `office-stock-link-command`, `createLaborGuard`, `createLaborRtdbStore` y `createLaborWriteGateway.resolve` reales. Servicio HTTP de prueba en loopback; fetchImpl del store implementa REST ficticio con datos en memoria y rechaza destinos distintos de loopback. No hay Firebase, credenciales ni datos comerciales reales. No se modifican núcleo, Compras, OT, aplicación/índice/SW ni la rama central; la función sigue OFF.

En este checkout aislado, que aún no contiene el núcleo E, el helper carga dependencias desde objetos Git inmutables `dd111977a48029c46f5f8b995155ebb180471d87`, sin copiar ni cambiar módulos de producto. En un árbol integrado que contiene office-stock-link-command, usa los módulos del propio checkout por require normal: no fija un backend histórico para futuras regresiones. La fixture HTTP/browser se extrae a un helper común y se conserva la suite anterior; no se duplicó la lógica de interfaz.

La tanda conjunta produjo **17 PASS / 0 FAIL / 0 SKIP**, código 0, 33,06 segundos: cinco casos de composición real y doce casos previos de recuperación nativa/contrato. Los cinco nuevos verifican:

- 390 y 1280: commit real del guard a través del store REST ficticio, pérdida del ACK después del commit, recarga, consulta nativa y recibo tipado propios. Un solo execute HTTP, un solo PATCH de commit y una sola actualización confirmada. UUID/digest conservados; digest de cuerpo diferente del CAS; inventario original byte-equivalente y asociación nueva verificada.
- Permiso Stock revocado en el estado de servidor después del commit y antes de recargar: no se presenta confirmación tipada ni se borra el espejo incierto; se conserva un solo commit y no se reenvía.
- UID distinto después de recargar: no consulta la recuperación nativa ni tipada ajena, mantiene el pendiente previo y no genera otro commit.
- Cuota de almacenamiento antes de enviar: cero execute, cero PATCH y ninguna operación REST de escritura; inventario conservado.

La suite previa repetida verifica también el aislamiento de un pendiente nativo de pago: no es adoptado por Stock, no genera espejo ni typed recover y libera normalmente el bloqueo compartido al resolverlo.

Evidencia privada `C:/SisVentas/tmp/audit-20261122-C/stock-link-real-composition.log`, SHA256 `5bedd914169f388108ca5d70d3da65e1c01186ded318fdc4c53269ec481f60bc`. Node/Chrome y dependencias existentes; concurrencia 1, sin otra puerta global. Sintaxis y diff check revisados. No certifica reglas RTDB remotas: el transporte REST es ficticio, aunque el store y las políticas cliente/servidor utilizadas son reales. Tampoco certifica cobertura productiva de referencias, preparación del índice ni durabilidad fuera de la sesión de pestaña. Siguiente paso: revisión del coordinador e integración local de los commits separados, conservando OFF hasta validar cobertura/barrera y composición del producto.

Después de agregar al helper la selección del núcleo del checkout integrado, se repitieron los cinco casos reales: 5 PASS / 0 FAIL / 0 SKIP, código 0. `stock-link-real-core-final.log`, SHA256 `74e81a815133e51b09e0a0e384fb9612dbb60e33aaaaf21f3cf3f8dd413fba09`.
