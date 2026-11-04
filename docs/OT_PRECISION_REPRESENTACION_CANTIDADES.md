# Representación decimal de cantidades OT · propuesta aislada

Base `6c6559484b3256309f4327e32615de310751f183`, rama
`codex/ot-quantity-display-precision`. No se importa a la integración congelada,
no modifica app/index/SW, modelo, validaciones, transporte, reglas ni datos base.

## Reproducción y cambio

Antes del cambio, las cuatro pruebas nativas propias fallaron en 390/1280 px:
el máximo `1e-7` se precargaba como `1e-7`, que el propio parser del selector
rechazaba por contener exponente. En custodia, agrupar `1e-7 + 2e-7` mostraba
`0 metros`; una fracción larga se limitaba a seis decimales.

`ot-delivery-selection.v1.js` representa el decimal canónico de
`SVCommercialMoney.decimal` mediante su numerador entero y escala de potencia
de diez. Lo expande a texto decimal sin exponente para la precarga y para los
detalles Pendiente/Disponible. No convierte el valor a otro número, redondea ni
agrega separadores de miles al input. El detalle puede envolver cantidades largas.

`ot-material-custody.js` usa la misma representación decimal del modelo para
el detalle de entrega, con coma decimal y agrupación de miles es-AR. Retira
`toFixed(6)` y el límite de fracción; la suma canónica existente permanece intacta.
Los helpers son locales a cada módulo para no introducir dependencias nuevas
entre sus órdenes de carga.

Se mantiene el rechazo de exponentes ingresados manualmente: escribir `1e-7`
continúa siendo inválido; `0.0000001` o `0,0000001` siguen la validación existente.
Tampoco se permite una cantidad mayor al máximo o una precisión que el modelo
no pueda conservar. No se modifica ni normaliza la base o históricos.

## Verificación

Prueba propia: `test/ot-delivery-display-precision-native.test.cjs`, cuatro casos
Chrome headless en 390/1280 px. Sirve sólo activos ficticios por loopback, bloquea
red de negocio, no usa Firebase ni guarda ventas/stock. Comprueba:

- Default pequeño y grande sin exponentes; confirmar sin editar conserva el
  valor exacto de la propuesta. Incluye `1e-7`, `1e21`, `1e-24` y fracción larga.
- Exponente manual rechazado y posterior ingreso con coma aceptado.
- Detalles pequeños/fraccionarios completos; suma `0,0000003 metros`.
- Filas originales intactas, diálogo dentro del viewport, cierre que libera
  scroll y restaura foco; sin errores de página ni solicitudes externas.

Se ejecutan también las diez pruebas nativas existentes de selector: sesión,
errores, cancelación/Enter/Escape/Tab, scroll con 40 filas, destrucción del diálogo
y fallos de showModal. Capturas móvil/escritorio inspeccionadas visualmente.
Las 48 pruebas focales existentes de selección, remitos, adicionales y precisión
de custodia pasan sin cambiar sus expectativas.

Evidencia privada fuera de Git: `tmp/ot-display-precision-before.private.log`
(0 PASS/4 FAIL), `tmp/ot-display-precision-native-final.private.log`,
`tmp/ot-display-precision-unit.private.log`, y capturas en
`tmp/ot-display-precision-before/` / `tmp/ot-display-precision-after/`.
Node 22.23.4; Chrome instalado. No se ejecuta otra puerta global ni se publica.
Resultado final: **14/14 nativas y 48/48 focales PASS, cero FAIL/SKIP**.
`node --check` de módulos/prueba y `git diff --check`: PASS.
El recorrido es del selector/detalle ficticio: no acredita todas las pantallas
financieras ni un despliegue productivo.
