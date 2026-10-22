# Bonificaciones por unidades y varios empleados

Publicada y verificada el22/10/2026 desde `cd5597ac39f8fb826a5f102a78190903ec2f6272`.
Primero Cotizador/regla de recibo y después Hosting/aviso6. El bloque de activación
inferior describe el requisito previo y la evidencia de preparación; el estado
externo final, revisiones y límites están en CONTEXTO_ACTUAL. La comprobación web
abrió/canceló el formulario sin destinatarios ni guardados financieros reales.

## Uso preparado para v3.14.6

Desde Empleados → Bonificaciones se elige un concepto guardado y se pulsa Usar.
El formulario permite indicar el valor por unidad, seleccionar empleados y cargar
las unidades de cada uno. Por ejemplo, cinco cerraduras a $1.000 por instalación
dan una bonificación de $5.000. El precio es editable para esa entrega; usarlo no
reescribe el concepto ni las bonificaciones anteriores.

Cada persona tiene su subtotal y el formulario muestra personas, unidades y total
antes de registrar. No hay empleados preseleccionados. Fecha de registro y mes
de cómputo son campos distintos; el mes determina cuándo computa el adicional.
No se modifica el sueldo liquidado ni se crea un pago: las bonificaciones quedan
aprobadas y disponibles para abonar por el circuito existente de Gastos.

El catálogo llama a su importe sugerido «Valor por unidad». Un motivo histórico
sin cantidad/precio explícitos no toma su monto total como precio de una tarea.
El historial conserva ese importe original; los nuevos usos muestran también
unidades × precio cuando reconstruyen exactamente el importe guardado.

## Cálculo y guardado

- Cantidad positiva con hasta tres decimales y precio positivo con hasta dos.
  Se usan enteros escalados para redondear al centavo por persona; el total suma
  esos importes ya redondeados. Una persona inválida bloquea el grupo completo.
- Un grupo usa una sola operación protegida: una CTA y un Gasto vinculados por
  persona, con comparación del empleado y ambos destinos actuales. No se divide
  en múltiples guardados ni se omiten destinatarios que fallaron.
- Cada registro conserva cantidad, precio, ID de grupo, lista completa de
  destinatarios, total del grupo, concepto y mes. Los pagos posteriores conservan
  ese detalle. El máximo estructural es 42 personas por las 128 fuentes CAS del
  adaptador; no garantiza latencia para un grupo grande dentro del lease de 30 s.
- Doble clic se bloquea. Ante acuse incierto se retienen selección, importes e
  identificadores y se exige la comprobación explícita existente. Un rechazo
  conocido anterior al commit no se presenta como un guardado incierto.
- Un replay confirmado no vuelve a conceder el grupo ni borra pagos posteriores.
  Un grupo parcial o con otra cantidad, precio o destinatarios falla sin completar
  altas incompatibles. El ID no es un índice global de grupos deliberadamente
  disjuntos; no se descarga la base completa para buscarlo.

No se agregan servicios, tareas por reloj ni lecturas históricas al otorgar.
La preparación reutiliza los empleados cargados; el guardado consulta únicamente
los registros puntuales necesarios y la autorización vigente.

## Permisos y activación pendiente

El propósito `employee-bonus-batch` se comprueba en Cotizador, con permiso actual
`empleados.bonificar`, perfil, rol, módulo y revisión de permisos. Admin conserva
su valor por defecto; otros roles internos necesitan la concesión explícita.
Ver como no permite registrar. Los registros antiguos sin unidades conservan su
circuito anterior; no hay migración ni recálculo histórico de comisiones.

La regla se preparó como candidata offline y se aplicó en el corte autorizado
descrito al inicio. Su builder cambia sólo
`sv_labor_receipts/$op/.write`: añade la comprobación final de bonificar al recibo
obligatorio, preservando la restricción anterior de eliminar Gastos. No concede
lecturas/escrituras nuevas ni cambia pagos, índices o reglas fiscales.

Base local revisada: `2cf231b801aa720eee482b3c1d3203b37b5ded6c2b99ae0d6009433e04e24aea`.
Candidata: `a4b9a66f6ae6f272683bfcbf9c4cd6245436aa3f6bdc9e96de4aa098722ca4ad`.
Antes de activarla se requiere respaldo y comparación fresca de la base remota,
publicación coordinada de Cotizador con sus dos dependencias nuevas y verificación
de la regla exacta. Sólo después se puede publicar el frontend6; publicar únicamente
la web sobre el backend anterior daría «Propósito de guardado inválido».

No necesita desplegar emitirFactura, activar flags financieros, crear servicios
ni modificar IAM. El ensamblador fiscal futuro incluye las nuevas dependencias
transitivas del guard; su fixture verifica ese cierre sin emitir facturas.

El CAS y el fence cubren los escritores coordinados. Un owner/Admin que eluda ese
fence y cambie un empleado justo entre la lectura y el PATCH queda fuera de esa
garantía: no hay CAS HTTP del PATCH completo ni comprobación target-active por
cada empleado en las reglas. No se afirma protección contra ese bypass privilegiado.

## Evidencia local

Pruebas reproducibles sin credenciales:

```powershell
node --test test/bonus-quantity-model.test.cjs test/bonus-grant-flow.test.cjs test/bonus-batch-backend.test.cjs test/bonus-batch-rules.test.cjs test/bonus-concepts.test.cjs test/labor-write-recovery.test.cjs
```

Modelo: 14 pruebas, incluidas 500 combinaciones con oráculo entero independiente.
Backend: 57 nuevas; reglas: 58 unitarias. Integraciones opt-in separadas
`bonus-batch-emulator.integration.cjs` (26) y
`bonus-batch-runtime-emulator.integration.cjs` (6) pasaron contra RTDB real en
loopback con reglas locales y datos ficticios. Se comprobó el rechazo indivisible
al revocar bonificar aun manteniendo los otros permisos de admin. Ambos emuladores
quedaron detenidos. No son pruebas financieras de producción.

QA con markup, helpers, módulos y CSS reales en 320/390/768/1280 px, transporte
en memoria y CSP sin conexiones: cálculo de cinco cerraduras, varias personas,
mes, cancelación, doble clic, acuse perdido, replay, foco ocupado, teclado y scroll
del primer plano con fondo inmóvil. La fuente externa de iconos queda bloqueada
en la fixture; los glifos reales requieren la verificación web posterior.

Evidencia privada en `tmp/v3146-release` y `tmp/bonus-quantity-multi-private`, fuera
de Git. La publicación vigente es v3.14.6. No se concedieron bonificaciones ni se
modificaron pagos o comisiones reales para estas pruebas; el cambio remoto de
seguridad se limitó a la restricción autorizada de recibos.
