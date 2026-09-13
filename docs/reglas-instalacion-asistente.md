# Reglas de instalación del asistente

Estado: implementación local, sin publicación. Acordadas con el usuario el 13/09/2026.

- Cámara cableada: 20 metros de UTP Hikvision exterior 100 % cobre por cámara; instalación y configuración P-13 (equipo de dos técnicos).
- Cámara TVI: además un juego de balun por cámara y fuente 12 V 2 A.
- Cámara Wi-Fi: 20 metros de paralelo; sin UTP ni balun. Revisar alimentación incluida antes de agregar fuente.
- Cámara identificada PoE: no propone fuente individual. La solución de alimentación PoE requiere revisión.
- Alarma inalámbrica: no agrega cables ni accesorios; instalación por dispositivo P-20. Los kits requieren confirmar cantidad de dispositivos.
- Kit de videoportero (frente y pantalla): 50 metros del mismo UTP, un tendido por pantalla P-5184 y dos instalaciones P-21491 por kit. Kits con otra composición requieren ajustar cantidades.

Las propuestas usan productos activos registrados. Los cables deben estar configurados por metro. Cuando hay varias coincidencias el operador elige; si falta una coincidencia, no se inventa ni se cambia la ficha. Se puede omitir explícitamente una propuesta. No se aprueba ni guarda automáticamente un presupuesto.

El historial libre del chat no constituye una memoria de reglas. Desde v3.6.2, el admin puede guardar reglas estructuradas (categoría, producto y cantidad) en Reglas de instalación. Se leen de Firebase antes de cada preparación; solo el admin escribe en sv_ia_reglas. Una regla sustituye la propuesta del mismo código para esa categoría, sin afectar otras categorías. No se interpretan enseñanzas arbitrarias de texto libre. El dictado usa reconocimiento de voz del navegador, transcribe al campo y requiere enviar el pedido.
