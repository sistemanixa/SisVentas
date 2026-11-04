# Devolución parcial sin instalación: QA local

04/11/2026, checkout aislado `integracion-v3190-verificada`, HEAD de inicio `b37e134b`. Caso independiente de la cadena que instala y corrige consumo. No se modificó código de aplicación, servidor ni helper compartido.

`test/commercial-uninstalled-return-chain.integration.cjs`: **2 PASS, 0 FAIL, 0 SKIP**, Chrome en 390×844 y 1280×844, desde la misma base ficticia de compra. Ejecuta `finishReceipt` real para recibir 2/3, entrega pública de 2, rendición pública con 1 para devolver y 1 que sigue con el técnico, y recepción administrativa de 1 por el ciclo existente.

En todas las fases comprueba `instalada=0`, consumo global/propio cero, ausencia de `stockRegistro`, `stockRevision` y recibos `rendicionesOT`. No se llama al puente SDK de consumo. La reserva propia permanece 2 hasta la recepción y termina en 1, el general aumenta de 4 a 5 y la reserva ajena de 5 permanece intacta. Queda 1 en compra. El remito original de 2 no cambia ni se duplica. Repetir recepción no agrega comandos/commits ni cambia la base.

Pagos, comisiones, gastos, cuenta de empleados, ítems/costos de venta y orden de compra permanecen idénticos después de la recepción de compra. Costo real 34; deuda/listado/cuenta/historial financiero conservan 26000 centavos. Se observan solo los comandos `delivery`, `custody`, `return`: tres commits adicionales a la compra.

Límites: funciones originales de compra, acciones públicas, ramas HTTP originales, servicios y guard/proyecciones reales; host HTML, autenticación, prueba de activación y almacenamiento en RAM ficticios. La compra usa su transporte de fixture existente. No se envían operaciones a Firebase real ni se prueba un servidor desplegado o reglas remotas. Esta repetición antecede a importar la nueva clasificación State; debe repetirse sobre esa candidata congelada. No acredita la cadena previa de instalar/corregir ni la sustituye.

Evidencia privada: `C:/SisVentas/tmp/ot-uninstalled-return-chain.private.log`, SHA256 `aeb06164c60f15b86ed91a43cfa54bc616f2582a427bd8ed45b4ca807350f9fe`. Capturas y trazas por fase: `C:/SisVentas/tmp/ot-uninstalled-return-chain-20261104/`, variable `SV_UNINSTALLED_RETURN_EVIDENCE`. Las capturas corresponden al host sintético, no a la interfaz completa.

Huellas ensayadas:

| Archivo | SHA256 |
| --- | --- |
| Test nuevo | `dda25f098f4dcb3d3c5aad6c6498b6d8acc18ea4cb87c3db1a711f12d305b194` |
| Helper compartido intacto | `38084f5b2e53770932977c454812b334150c14c32c51ee3add34664aa6391ba8` |
| Ciclo servidor | `77820ef4f532427ec42c22b59077a98500e780c90dedfcf62ea75d9091198de9` |
| Modelo de ciclo servidor | `c935159a25ddc0bfc71e3fdf4e9dfbc7b7647269b49a3533515d469954b66702` |
| Custodia pública | `833d8ad74a107e544c0c3e693671d78ed7bdb39ed9d3e3f7eac3b45fd2413305` |

Sintaxis y diff correctos. Sin suite general ni publicación; pendiente repetición independiente sobre State.
