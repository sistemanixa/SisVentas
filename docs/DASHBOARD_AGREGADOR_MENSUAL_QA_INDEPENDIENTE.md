# Revisión independiente: agregador y mensual

04/11/2026. Alcance acotado a cobertura ausente, dataEpoch, grants y B0/B1 de `859afaf9`. Sin edición funcional, staging, puerta general, datos reales ni publicación. HEAD observado al iniciar: `2782ae8d`; los dos módulos revisados coinciden exactamente con los blobs de `859afaf9` antes y después de las pruebas:

| Módulo | Blob Git | SHA256 local |
| --- | --- | --- |
| dashboard-activity-aggregate-proposal.js | 228cd4959ffa89074439f851a415f0f313145e6e | 22f1650841c86e847a6315c5196f70ea91e667dbdf3d27a669563587d6fa71e1 |
| dashboard-budget-month-port-proposal.js | 12c433aef3052f2f206d50a39147e917797d3c18 | ed0405f2f2c47df2562daf56afa1897c4c4b4d09d2caba4287dc127b7a41efec |

## Resultado

**44 PASS, 0 FAIL, 0 SKIP**: 24 controles nuevos en `test/dashboard-aggregate-month-independent.test.cjs`, más los 13 casos existentes del agregador y siete de dataEpoch/dominio/grants. No se encontraron fallas reproducibles dentro de este alcance. Se conservaron intactas las expectativas existentes.

- Cabecera mensual sin generación, revisión, policyHash, ready o directCompatible: rechazo antes de leer el bucket. Ausencia legítima sin miembros devuelve cero; retirar el certificado impide ese cero. Eliminar conteos y prueba de un mes poblado sigue rechazando por miembros existentes.
- Cambio de dataEpoch o de cualquiera de los cuatro grants en sitio, manteniendo firma de permisos y User: retira la lectura mensual tras la cabecera. Los cuatro cambios de grants durante el tramo comercial también retiran el agregado.
- Cambio de dataEpoch o grants mientras espera el token: retiro sin iniciar HTTP. Cambio de dataEpoch durante json(): se decodifica el cuerpo, pero no se devuelve el resultado retirado.
- B1 con otro payload aunque generación/revisión sean idénticas: rechazo. B0 sin revisión: rechazo antes de iniciar mes o comerciales. Se repitieron además los controles existentes de escritor real entre B0/B1, revisiones comerciales distintas y bucket mensual cambiado sin nueva cabecera.

Comando focal: `node --test test/dashboard-aggregate-month-independent.test.cjs test/dashboard-activity-aggregate-proposal.test.cjs test/dashboard-activity-aggregate-data-epoch.test.cjs`. Sintaxis del test correcta. Log privado `C:/SisVentas/tmp/dashboard-aggregate-month-independent.private.log`, SHA256 `a6ecae0e4c79c22b4f658d87fbf0d70202f635108ee1b24147981f007a782c76`. Test nuevo SHA256 `8d9b9806048186cf3ca148e65b9e8a3e369c97ef2bac4aa5a451038e737ff58b`.

## Límites para la integración

Se usan lectores, proyectores y guard reales mediante el fixture existente en memoria. Las pruebas de createFresh interceptan fetch y token: no acceden a Internet ni acreditan reglas desplegadas o transporte RTDB nativo. La prueba nativa existente sigue fijada al SDK de `4dec3f66`; no se ejecutó ni se atribuye a esta integración.

B0/B1 depende de lectores verificados y escritores que respeten el protocolo de revisión; no acredita un snapshot atómico frente a bypass privilegiado. El rechazo tras json() no cancela la transferencia ni evita decodificar un cuerpo ya recibido. El contrato actual del agregador sólo acepta all/own/null; no se verificó una incorporación de assigned. Sin Readiness real, HTML o recorrido visual en este bloque. No certifica Mis ventas por creador, originales completos ni centro global de notificaciones. El contexto compartido y el commit quedan a cargo del coordinador.
