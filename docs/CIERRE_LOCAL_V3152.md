# Cierre local de la candidata v3.15.2

> Nota26/10: este checkpoint amplio se reservó como15.3. La versión15.2 queda para Agenda aislada desde15.1; este documento conserva la evidencia histórica del bloque amplio. Ninguno de los dos se activa por ese cambio de número.

>Actualización27/10: la decisión fiscal ya fue respondida y el lector explícito está implementado/pruebas en FISCAL_ACCESO_EXPLICITO_V3157.md. Sigue sin activar; este texto conserva su checkpoint histórico.

Estado: preparación local del 26/10/2026. **No publicada ni lista para activar.**
La versión externa vigente es v3.15.1, cuyo arreglo de Gastos ya fue publicado
y comprobado entrando directamente al Dashboard. La ventana local8766 sigue
sirviendo esa versión funcional, sin mezclarla con servicios todavía inactivos.

## Bloque integrado y comprobado

- Vistas de cuenta por empleado, directorios y gastos con revisiones opacas.
  Los comandos conservan los originales privados y verifican identidad,
  permisos, pagos, cálculos y versión antes de confirmar.
- Bonificaciones por unidades, aguinaldo y liquidación mensual delegados sin
  conceder por extensión salarios, DNI o datos bancarios. Un adelanto entregado
  no se puede trasladar a otro empleado: corresponde anular y crear otro.
- Transporte comercial y edición compatibles: los campos privados ausentes de
  la respuesta se conservan internamente; las líneas duplicadas se identifican
  por revisión e índice. Altas, conversión y créditos conservan costos,
  comisionados, autoría, pagos e historial. No se recalculan comisiones previas.
- Recepción, conciliación y eliminación de órdenes de compra confirman sus
  efectos relacionados en un mismo guardado. Claves contradictorias de
  variantes no se equiparan por compartir un código. Los históricos ambiguos
  se rechazan sin efectos parciales.
- Los acuses perdidos se recuperan sin repetir la operación. Un rechazo
  comprobado previo al guardado no abre otra consulta por reloj.
- El arreglo15.1 de Gastos está incorporado sin sustituir los escritores nuevos.
- Agenda: se eliminó una segunda llamada de arranque a `applyRole` programada
  por reloj que retiraba la fuente inicial y dejaba el botón Consultar. Se
  conserva la aplicación inicial del rol, los cambios reales de permisos y el
  retiro al salir/ocultar. No se relajaron los controles de `DataQuery`.

Puerta vigente: **7.542 casos;7.515 PASS,27 opt-in,0 fallos**,33,40s.
Sintaxis de128JS correcta; diff y validación oficial local15.2 correctos.
El cierre transitivo de Docker inventaría86módulos sin faltantes. Son pruebas
aisladas: no acreditan el comportamiento de reglas desplegadas, ADC real ni
todas las interfaces y operaciones financieras en producción.

La comparación fiscal canónica sólo añade identidad opaca de líneas al helper
compartido;18 salidas fiscales completas permanecen idénticas. No amplía acceso
a documentos. Las pruebas de paridad fiscal originales siguen pasando.

Agenda se reprodujo en la aplicación publicada completa con SDK ficticio:
antes, la reaplicación del rol retiraba la lectura; con la corrección aparece
el evento sin pulsar Consultar, en escritorio y390px. No hubo escrituras
financieras ni red exterior; presencia/actividad se simulan en la fixture.
Esta prueba no demuestra ahorro de factura ni cambia la primera descarga raíz.

## Activación que sigue pendiente

1. **Acceso fiscal:** la revisión automática rechazó ampliar el DTO comercial
   con archivos de facturas. Esa ampliación no se aplicó ni se reintentó.
   El DTO candidato anterior todavía incluye aliases de URL fiscal; no se
   presenta como confidencialidad documental terminada. Se consultó al titular
   la alternativa concreta: sólo acción explícita y permiso
   `facturas.verEmitidas` más acceso a la venta; sin PDF en listados ni acceso
   implícito para un receptor de comisión. Esa decisión sigue pendiente.
2. **Preparación y corte:** falta el adaptador productivo del coordinador,
   preparación verificable de las vistas y el drenaje de todos los escritores
   antiguos. Se necesita fuente limpia revisada, inventario remoto fresco,
   respaldo privado, comparación exacta de reglas y un corte concreto autorizado
   con costo informado antes de infraestructura. La CLI local rechaza `--apply`.
3. **Reglas:** propuesta offline comercial/Compras
   `be01c924e40e0f0468402d8f713bb87f96bbc017f2c421108edd4341c63b7763`,
   sobre la propuesta previa de cuentas774afc. Cambia cuatro políticas de
   escritura existentes: presupuesto, órdenes, listas de materiales e inventario
   operativo. Conserva sus predicados de usuario dentro del fence; validadores
   e índices existentes no cambian.43 pruebas de expresiones no equivalen a
   emulador, compilación remota o aplicación. No se repitió ni evadió el bloqueo
   anterior del emulador.

## Otros pendientes reales del inventario

El cierre de transporte no convierte todas las primeras descargas en consultas
reducidas. Agenda conserva su raíz y los cálculos de saldos requieren cobertura
histórica completa. Persisten la escritura redundante del catálogo público desde
la lectura de proveedores, el prototipo de CPU de Cobranzas que debe preservar
aliases y el bloque de OT/garantías12 antes rechazado por revisión automática.
No se aplicó una excepción ni se reintentó ese bloque por otra vía. El inventario
histórico continúa en `CIERRE_PENDIENTES_2026-10-24.md` y
`LECTURAS_Y_BORRADORES_V31418.md`.

Ningún dato real se guardó o eliminó como prueba. No se activaron reglas,
flags, servicios, mínimos ni procesos periódicos nuevos. No declarar terminada
la auditoría general por esta puerta local.
