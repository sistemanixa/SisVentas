# Cierre B · Materials y Soporte

Complementa el constructor fijo inventory-current-rules sobre baseline5a, sin aplicar reglas ni flags remotos. Sólo cambia predicados/condiciones de las cuatro familias existentes; no agrega rutas, familias, callbacks de autoridad ni modelos de negocio duplicados. Source aprobado: descriptor D b1014143, preparación Materials de Root02f y token Struct privado Root042b0547.

## Materials

Kind materials es la única excepción a los tres bits Creating/Administrative/Editing todos false. Exige módulo ordentrabajo, permiso Corregir materiales vigente, configuración/generación, revisión, reset, fence y PhysicalUnchanged como el resto del grant OT. Defaults Corregir materiales: admin, administrativo y vendedor; false explícito deniega aunque Editar o Editar datos administrativos sean true. Los otros Kind no heredan la excepción.

El retiro de capacidades Metadata en Sales conserva únicamente para materials el grant financiero NATIVO anterior, además de exigir svSaleFinancialWriterVersion===1. No se añade un OR de Metadata que conceda venta, dinero ni un padre. El módulo Venta, propiedad y validación del escritor financiero existente continúan siendo necesarios; Corregir materiales no los reemplaza. Claims de Money se mantienen independientes. Root confirmó que no existe una WeakMap FinancialSaleWriter específica: el gateway/Guard actual aplican GenericAccess/CommercialOwnership/commercial-sale-scope y el modelo financiero. El flag WriterVersion se emite por mantenimiento financiero real, no desde JSON del cliente.

Root debe ejecutar MaterialPolicy.validateSource genuino sobre el parche completo antes de emitir el token privado. Los modelos, originales y autoría/fecha servidor siguen en los módulos D/Root. En la prueba se usa actor.role undefined: el rol válido proviene exclusivamente del token Metadata privado emitido por la Policy, no se eleva la autoridad agregando un rol público al actor.

## Soporte: revisión explícita del descriptor

La comparación genérica historial.val() entre árboles proyectados exigía Resolver incluso cuando una reparación FK conservaba el historial idéntico. El método numChildren no existe en Rules. Ambos intentos se descartaron; no se publican ni se usan para aparentar un cierre.

Root autorizó el contrato adicional svOTMetadataResolving BOOL, emitido exclusivamente por la capacidad Struct WeakSet: Kind claim y cap.supportResolving===true. Token hunk 042b0547; Root es dueño de defaultfalse/saneamiento/Store. El descriptor anterior «sin flag nuevo» queda expresamente sustituido por esta decisión concreta, no por inferencia de B.

- Kind claim exige Resolving booleano estricto. True exige Resolver y módulo Soporte vigentes AND el permiso estructural existente; no sustituye ese permiso.
- False conserva reparación FK sin Resolver y exige que los campos escalares de Soporte permanezcan intactos. La preservación del historial arbitrario bajo false la acredita el validador FULLPATCH genuino obligatorio; Rules no pretende comparar profundamente ese objeto.
- Otros Kind exigen Resolving=false; materiales, batch o metadata ordinaria no heredan una resolución.

Un body/actor.claims/objeto copiado no emite el bit ni una capacidad. La prueba falsifica el claim de entrada con true en FK-only y obtiene false del token genuino; alterar su historial es rechazado por validateStructureSource. El caso inverso conserva true del cap real aunque la entrada diga false. Root debe mantener validación async exacta antes de emitir claims y los defaults del protocolo nativo, sin aceptar banderas cliente.

## Evidencia y dependencias

Pruebas nuevas cargan de sólo lectura cinco fuentes exactas Root02f/042b, verificadas por SHA: ot-material-edit-policy, ot-structure-policy, ot-metadata-policy y las dos rutas del mismo ot-related-adapters empaquetado/UI. No se cambian esas fuentes en este chat. Attach/Struct.bindPlan, modelos puros, RecordList, validación privada completa y Physical.claims son los reales. Writer financiero1 del fixture Materials se deriva de Financial.projections.augment sobre cobertura preparada real. No se inventa una capacidad financiera.

Matriz nativa: Materials con los tres bits false y Corregir independiente; FK-only con historial previo y Resolver denegado; resolución con cambio de estado y resolución que sólo añade historial. Rechazos por Corregir false, Writer financiero ausente, módulo Venta ausente, autoridad nativa de venta cerrada, Kind incorrecto, cambio físico, Resolver false, módulo Soporte ausente, permiso estructural false, bit Resolving ausente y bit aplicado a otro Kind. Incluye manipulación de claims de entrada y edición de historial sin resolución, y regresiones de V3/familias/Presence.

Pasada conjunta final: 79 PASS, cero FAIL/canceladas/SKIP, exit0. Incluye compilación actual5a, 20 casos adicionales Materials/Support/claims sobre los 54 anteriores y cinco unitarios de predicados. Sintaxis de seis JS modificados y git diff --check correctos. Emulador propio limpio/detenido. No se ejecutó una puerta global nueva desde este checkout parcial; corresponde al coordinador.

Se conservan todas las expectativas de test/ot-metadata-permission-rules.test.cjs (roles, admin-only, batch mixto y forma de flags). Su fixture declara Creating=false y Resolving=false conforme al contrato y agrega negativos de bits ausentes/no booleanos; no se elimina la exigencia estricta para hacer pasar la puerta.

Las pruebas Materials/Support combinan políticas/modelos genuinos y Rules nativas bajo ancestros deliberadamente adversariales. No se presentan como todos los handlers financieros de Root ejecutados bajo esa misma conexión; Root informó su propio test Gateway Materials real y queda a cargo de la puerta integral. V3 mantiene sus PATCH completos y negativos reales por auth+merge WebSocket. Candidata todavía no activable: requiere configuración/closure/firmas/preparación revisadas y publicación del coordinador. Sin datos reales ni publicación individual.

Ejecución focal: SV_OT_LATEST_DOMAIN_ROOT al checkout aprobado Root, SV_OT_FINAL_POLICY_REVISION=3ae017c87dbe12bcabe9eff4011b0258716d7f78 para la regresión anterior y demás variables de emulador/V3 documentadas en los checkpoints previos. Salida privada tmp/finish-rules-20261125/materials-support-all.private.log. No subir esa salida ni el baseline privado a Git.
