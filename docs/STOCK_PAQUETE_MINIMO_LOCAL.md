# Stock: paquete mínimo local compatible con runtime retenido

Estado 08/11/2026. Preparación offline, sin despliegue, push, recursos nuevos, cargos ni cambios de datos/permisos reales. Producción se describe por evidencia retenida; no se consultó de nuevo para certificar su vigencia.

## Componentes exactos

El preparador `scripts/prepare-office-stock-package.cjs` exige checkout limpio, SHA completo y destino nuevo. Fija imagen base cf7bcefb95650282ecb6a29aec3f33871c5f05371976ff3b1970d0122825dc65 y huellas exactas de cuatro fuentes retenidas. Si cambian base o anclas, rechaza la composición: nunca aplica el repositorio completo.

Servidor: modifica sólo index.js (cuatro rutas Stock), labor-guard.js (acción stock.ajustar), labor-rtdb-store.js (capacidad privada Stock). Agrega office-stock.js, office-stock-policy.js, office-stock-model.js y office-stock-money.js. El decimal queda aislado: la imagen retenida no contiene commercial-money.v1.js; no se sobrescribe su modelo monetario anterior. Schema2 se firma sólo para una capacidad Stock válida; otros escritores conservan sus claims previos. Se conserva el clasificador canónico de servicios de la imagen retenida. No se modifica ciclo OT ni se añade rendición atómica, protocolos H7 o eliminación de órdenes.

Frontend:14 archivos públicos enumerados en FRONT, incluyendo app19, índice/SW/versiones, menú/permisos/readiness, recuperación y módulos/CSS Stock. Incluye el centrado d72a4fd8 y la corrección posterior del guardado de Roles: módulo marcado se conserva como permiso explícito y se construye su índice sin añadirlo a los módulos base de todos los roles. La habilitación real sigue limitada en servidor a administrador/administrativo. No cambia Compras.

Receta Docker local: base inmutable, sólo COPY de siete fuentes y comprobación de sintaxis/imports. Sin npm install, descarga ni build ejecutados. El manifiesto identifica22archivos por SHA256, además de base y commit. Reglas candidatas se conservan separadas con hash; no se adjuntan respaldos, datos, perfiles ni credenciales.

## Validación y límite

Puerta anterior de fuente3c933f3b:10009PASS/0FAIL/46SKIP. Ajuste visual:5ChromePASS. Preparador:3PASS con huellas exactas y rechazo de otra base. Runtime compuesto de la fuente retenida + sólo siete archivos:13casos de emulador PASS, incluyendo habilitación de Stock por el escritor canónico de Roles y reglas vigentes, ambos roles, revocaciones, concurrencia y replay. Regresión posterior Stock/Roles:70PASS/0FAIL/0SKIP. No sumar corridas solapadas como pruebas independientes. Sintaxis/diff y coherencia local verificados.

La imagen NO fue construida ni ejecutada. La composición en host y emulador no acredita imports dentro de la imagen, arranque en CloudRun ni configuración remota actual. Antes de activar debe comprobarse que la revisión/imagen y reglas productivas siguen coincidiendo con la base retenida, construir y ejecutar la imagen exacta, verificar rutas desactivadas/arranque y recién plantear corte. No instalar ni construir remotamente sin autorización concreta y estimación previa. Este es el límite pendiente para publicación; la preparación local no habilita un despliegue a ciegas.

## Orden de habilitación propuesto, no ejecutado

1. Comparar revisión, imagen, configuración y reglas remotas con referencias retenidas; respaldar sólo el alcance necesario en destino privado autorizado. Si difieren, recomponer y repetir regresión, sin sobrescribir cambios concurrentes.
2. Construir/verificar imagen Stock exacta en entorno aprobado. Mantener OFFICE_STOCK_ENABLED=false y officeStockVersion desactivado; comprobar que recorridos existentes conservan comportamiento y recursos/accesos previos.
3. Revisar y aplicar únicamente validadores condicionales/index fecha de ajustesConteo sobre reglas exactas respaldadas. Sin ampliar read/write ni reemplazar base. Verificar comparación inmediata y resultado.
4. Configurar módulo mediante guardado canónico de Roles, revisión incrementada, sólo admin/administrativo según elección aprobada; conservar todas las otras casillas/acciones. No dar permisos globales ni modificar usuarios por inferencia. Stock además exige acceso Productos ya permitido.
5. Activar servidor/officeStockVersion1 con readiness operacional schema1readytrue y escrituras coordinadas existentes. No migrar ni completar inventarios. Publicar frontend exacto y comprobar lecturas autorizadas sin ajustes reales de prueba. Actualizar aviso sólo después de verificar web.
6. Primer ajuste real únicamente por decisión humana sobre producto/cantidad/motivo. Nunca usar una operación real incidental para demostrar funcionamiento.

## Rollback que conserva confirmaciones

Ocultar/deshabilitar módulo y rechazar nuevos comandos; primero resolver operaciones inciertas por su identificador/recibo, sin cambiarlo ni repetir con otro ID. Dejar terminar la operación activa antes de cambiar la revisión del escritor. Revertir frontend y tráfico al artefacto previo comprobado si corresponde, conservando recursos/accesos. No restaurar inventario desde respaldo previo ni borrar ajustesConteo, general confirmado, resúmenes vigentes, revisiones o sv_labor_receipts. Mantener validadores compatibles mientras pueda haber escritor Stock activo; retirar sólo tras confirmar ausencia de operaciones y comprobar reglas exactas. Un error de conteo se corrige con otro ajuste explícito trazable, no borrando el anterior.

## Autorización indispensable para un corte futuro

Separada de este bloque: build de imagen exacta sobre registro/CloudBuild aprobado (si local no hay motor), eventual coste estimado; despliegue Cotizador conservando configuración/accesos; escritura acotada de validadores de inventario y resumen, índice fecha, officeStockVersion; guardado de casillas Stock en Roles; Hosting y aviso oficial. Cada acción requiere alcance concreto revisado; nada está ejecutado ni se solicita activar ahora. Costos y OT real permanecen separados y pausados donde corresponda.

Artefacto final: fuente28436175d7013ab63ea61115ba6dae31df0b8ae2; manifiesto b894cfeb792cce04278bc5c3dd04f7c6e96700456f8212a37c56bf2bed37d4bf,22archivos verificados. Servidor byteidéntico al compuesto13/13PASS. Regresión70/70PASS. Evidencia exacta y límite de imagen en CONTEXTO_ACTUAL.

## Imagen exacta ya comprobada
Build autorizado0f27e6e9-ef58-4b74-a4b6-c656f7d071e9 SUCCESS el08/11/2026,9tests contenedorPASS/0FAIL. Imagen guardada sha256:ce214d16acc17a89acecab937a499c4984ca49c5f6a097fedba2d5aab73fb8a2. Queda superado el límite anterior de imagen sin construir. Producción no activada; orden de habilitación/rollback permanece propuesto. Usar este digest sin otro build en eventual corte autorizado. Evidencias exactas en CONTEXTO_ACTUAL.
