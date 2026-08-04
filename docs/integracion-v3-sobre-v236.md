# Integración V3 sobre SisVentas v2.0.279

## Estado al 03/08/2026

La aplicación que se inicia desde `index.html` sigue siendo
`js/app.v2.0.279.js`. Todos los cambios exitosos publicados hasta esa versión se
conservan. V3 se carga después de la aplicación estable y no reemplaza un
módulo por el solo hecho de estar presente.

La integración abarca los cuatro dominios definidos para esta etapa:

1. Presupuestos.
2. Ventas y pagos.
3. Órdenes de trabajo y adjuntos.
4. Productos, proveedores y actualización de precios.

Cada dominio tiene un adaptador conectado a `V3Bridge`, una comparación sombra
y una compuerta independiente. El comportamiento V3 sólo se habilita cuando el
adaptador está conectado, su informe es apto y un administrador lo activa de
forma explícita. La activación dura únicamente durante la sesión actual.
Al cerrar sesión se revierte todo el puente antes de que ingrese otro usuario.

## Panel administrativo

En Configuración > Mantenimiento, el administrador dispone de la sección
`Auditoría de migración V3`. Desde allí puede:

- ejecutar nuevamente las comparaciones;
- ver por dominio si el adaptador está conectado, apto, activo o bloqueado;
- revisar incidencias sin exponer datos personales;
- exportar el diagnóstico técnico en JSON;
- activar sólo los módulos aptos y conectados;
- volver inmediatamente a la implementación estable v2.

Una comparación que pasa a estado bloqueado revoca la autorización del módulo;
V3 no se reactiva automáticamente después de un error.

## Persistencia controlada

Las escrituras integradas usan `RecordRepository` y un adaptador Firebase con
lista blanca. Las únicas colecciones permitidas son:

- `sisventas/presupuestos`;
- `sisventas/ventas`;
- `sisventas/pagos`;
- `sisventas/ordenes_trabajo`;
- `sisventas/productos`;
- `sisventas/proveedores`.

Toda edición o eliminación exige la `fbKey` técnica. Los números visibles,
nombres y códigos comerciales no pueden utilizarse como identidad de base de
datos. Los fallbacks de v2 permanecen disponibles mientras el módulo no esté
activo.

## Reglas funcionales integradas

- Presupuestos: formulario, listado, detalle, impresión y conversión a venta
  comparten el cálculo canónico de subtotal, descuento, IVA y total.
- Ventas y pagos: deuda, cobranza, cuenta corriente, métricas y reportes
  comparten total cobrado y saldo canónicos, relacionados por claves técnicas.
- Órdenes de trabajo: listado y métricas consumen el mismo modelo. Las fotos son
  tareas cancelables y sólo guardan metadatos después de confirmar la subida.
  Cerrar sesión cancela las subidas pendientes.
- Productos y proveedores: el actualizador usa enlaces compatibles por clave,
  nombre y dominio. La vigencia pertenece a cada enlace. Mano de obra queda
  fuera del actualizador, no conserva proveedor y una asociación pendiente
  bloquea la activación hasta ser limpiada. Los lotes de actualización se
  escriben de forma atómica dentro de su colección para no dejar medio bloque
  aplicado si una operación falla.

## Verificación

La integración cuenta con pruebas unitarias, de cableado contra la aplicación
estable, persistencia, compuertas, recorridos completos y regresión histórica.
El control de cierre requiere:

```powershell
node --test
node --check js/app.v2.0.279.js
git diff --check
```

No corresponde cambiar el archivo activo, publicar ni desplegar esta rama hasta
validar los recorridos con una copia de datos o una sesión administrativa
controlada. El despliegue debe ser una decisión posterior y explícita.
