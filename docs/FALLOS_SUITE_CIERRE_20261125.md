# Cierre de los 17 fallos de suite · 25/11/2026

Base fija: `9cbe59dd76a1d1e5aa0caaeb0ccab3427832d4a2`, aplicación activa v3.21.12. Se reprodujeron los mismos 17 fallos que registró la puerta de b624bf4c. No se editan originales comerciales, reglas, flags remotos, guard, Store, modelos financieros ni la aplicación inmutable.

| Caso anterior | Causa comprobada | Corrección y evidencia |
|---|---|---|
| Store: claims reservados no elevan al usuario | La prueba exigía schema2 aun sin ninguna familia coordinada activa | Comprueba que los claims del cliente no emiten schema; positivo separado con familia Accounts activada por el actor servidor, y History/Financial falsificados siguen en cero |
| Dependencias locales Docker | Cinco dependencias transitivas ya referenciadas faltaban en COPY | Se agregan tecnoprices-login, budget-presentation-trial, su modelo, ot-custody-held-authority y client-account-operational-state; cierre completo del grafo pasa |
| Arranque de index desde payload Docker | Mismas omisiones, incluida carga diferida del modelo de presentación | Arranca el index real sólo desde el payload copiado, con flags desactivados y activados; sin recurrir a archivos vecinos del repositorio |
| Dashboard: capacidad de facturación | Leía app.js histórico y exigía markup sin atributos de una versión antigua | Ejecuta funciones de la aplicación activa y el cálculo real de Facturas; verifica crédito, deuda y cero, importe, signo, leyenda y color |
| Retorno Gastos 390 | Faltaba el Chromium descargado por Playwright | Usa navegador explícito, luego el de Playwright o Chrome instalado en Windows; mantienen las comprobaciones de filas, filtros, foco, scroll y cero lecturas/escrituras |
| Retorno Gastos 768 | Misma ausencia de ejecutable | Mismas comprobaciones completas, PASS |
| Retorno Gastos 1280 | Misma ausencia de ejecutable | Mismas comprobaciones completas, PASS |
| Control negativo de retorno display-only | Misma ausencia de ejecutable | Sigue demostrando que el patrón anterior deja oculta la tabla, mientras la función actual la restaura |
| Ruta OT: error incierto | Se exigía literalmente «operación» donde el mensaje vigente dice «intento» | Comprueba 503, ok:false, eliminación sin confirmar, consulta antes de repetir y ausencia del error interno; admite ambas redacciones equivalentes |
| Recibo de venta tras cambio de UID | El fixture no habilitaba mantenimiento financiero requerido por el fence | Se declara el prerrequisito verdadero en el runtime ficticio; se conserva el rechazo después de cambiar UID |
| Recibo de venta tras cambio de rol | Mismo fixture incompleto | Se conserva autorización fresca y rechazo de rol |
| Recibo de venta tras cambio de contraseña | Mismo fixture incompleto | Se conserva rechazo por cambio de contraseña requerido |
| Recibo de venta tras revocación | Mismo fixture incompleto | Se conserva rechazo por Auth revocado |
| Operación idéntica concurrente | Mismo fixture incompleto impedía cualquier commit | Dos solicitudes producen un recibo y un solo commit real del guard ficticio |
| ID concurrente con cuerpo diferente | Mismo fixture incompleto | Una solicitud confirma y la otra se rechaza; un solo efecto |
| Capacidad y recuperación propia | Mismo fixture incompleto | Recupera recibo sin leer raíces comerciales ni escribir de nuevo |
| Runtime HTTP/REST completo de borrado | Mismo fixture incompleto | Gateway, guard y Store reales con transporte ficticio: rutas conservadas, recibo privado y replay de un solo efecto |

Se añade además un negativo explícito: `saleFinancialDependencies:false` mantiene el fence cerrado antes de cualquier mutación. No se modifica ese requisito del producto para conseguir un positivo.

## Validación

- Los ocho archivos que contenían los 17 fallos: **32/32 PASS**, cero omitidas y cero canceladas. Antes eran 31 casos, 17 fallidos; el adicional es el nuevo negativo de mantenimiento financiero apagado.
- Regresión de borrado, actividad, dependencias financieras, relaciones indexadas, rutas, presentación y privacidad: **177/177 PASS**, cero omitidas y cero canceladas.
- Retornos reales de componentes Gastos en Chrome aislado: 390, 768 y 1280. Datos ficticios, sin Firebase ni red exterior y sin instalar navegadores.
- Sintaxis de JS modificado y `git diff --check` correctos.

Logs privados: `C:/SisVentas/tmp/remaining-failures-{baseline,firstfix,final,regression}-20261125.private.log`. No se agregan al repositorio.

## Límites

Esto corrige el empaquetado de **la fuente del repositorio** y los contratos de sus pruebas. No equivale a reconstruir ni desplegar la imagen compuesta actualmente en producción, ni autoriza sustituirla con el Dockerfile general. Los positivos HTTP usan fixtures de identidad, almacenamiento y transporte; no prueban una eliminación real ni reglas RTDB remotas. La suite completa de la integración queda a cargo del coordinador después de reunir los demás frentes.
