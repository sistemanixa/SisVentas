# Gastos personales: traspaso a Codex

Esta rama contiene instrucciones y una copia del diseño aprobado, con datos
ficticios. No implementa todavía el módulo en SisVentas ni cambia producción.

1. Leer AGENTS.md y docs/CONTEXTO_ACTUAL.md de la copia de trabajo vigente.
2. Leer docs/gastos-personales/IMPLEMENTACION.md.
3. Abrir docs/gastos-personales/prototipo-demo.html servido localmente para
   revisar diseño y flujos. No cargar datos reales en esta demo pública.
4. Implementar en una rama aislada sobre main actualizado, preservando los
   cambios existentes del titular. No es necesario cambiar a esta rama para
   consultar sus tres archivos mediante git show.
5. No migrar las cifras ficticias de la demo a producción. Los resúmenes reales
   y datos privados se obtendrán aparte, sin subirlos a Git.

El módulo tendrá un acceso «Gastos personales» junto a Gastos, un espacio propio,
retorno a SisVentas, misma sesión y protección exclusiva del titular en servidor.
No mezclar estas finanzas con gastos laborales, Caja, Tesorería ni comisiones.

No hay un ZIP privado publicado en esta rama: se sustituyó por una referencia
pública sin información financiera. Los archivos originales permanecen privados.
