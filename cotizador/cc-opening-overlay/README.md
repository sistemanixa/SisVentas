# Apertura de Cuenta Corriente: parche acotado de lecturas

El contexto de construcción contiene sólo Dockerfile y attach.cjs. Hereda la
imagen exacta publicada de comisiones y preserva sus lectores económicos.
Valida los hashes de index.js y commercial-ownership.js antes de escribir nada.
No copiar el entrypoint privado ni datos, credenciales o respaldos aquí.

Activa un máximo de 16 consultas de presupuestos vinculados únicamente para
listados completos. El valor predeterminado y las verificaciones de guardado
conservan seis. No agrega consultas: deduplica las mismas referencias y espera
las solicitudes ya emitidas al fallar. No devuelve listas parciales ni utiliza
una copia obsoleta ante un error. Auth, ámbito, resolución de propietarios,
autores, histórico, modelos contables y comandos permanecen iguales.

La fuente del repositorio contiene otros cambios locales anteriores respecto al
archivo del servidor. Por eso este despliegue no copia ese archivo completo:
aplica sólo los puntos de lectura sobre los bytes de la imagen fijada. Una
baseline diferente rechaza la construcción. No configura servicios ni activa
Eliminaciones, Tecnoprices, Accounts o Historial.

La reversión operativa consiste en devolver el tráfico y los accesos a la revisión
anterior conservada, sin restaurar ni reescribir datos comerciales. La candidata
se comprueba sin tráfico antes de activarla. Las pruebas del baseline retenido
requieren SV_CC_SERVER_SOURCE y SV_CC_SERVER_INDEX; una omisión sin esas variables
no se cuenta como aprobada.
