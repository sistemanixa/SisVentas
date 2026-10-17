# Lector local de códigos

Distribución UMD de `@zxing/browser@0.1.5`, obtenida del paquete npm mediante
`https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js`.
SHA-256: `b5ad3df920738ca7adcb74508d7e6b6a5b9024993fb9a0c702da1ad8964eca07`.

Se sirve desde SisVentas; el navegador no consulta un CDN para escanear.
Se incluye la licencia MIT del adaptador y Apache-2.0 de ZXing/library,
dependencia incorporada en la distribución. No modificar el archivo minificado.

Documentación primaria: https://github.com/zxing-js/browser y
https://github.com/zxing-js/library. `BrowserMultiFormatReader.decode(video)`
decodifica cuadros localmente; SisVentas administra y detiene el stream.
La cámara requiere HTTPS o loopback y autorización del navegador.

Las pruebas rasterizan tres QR y un Code128 ficticios y usan el decoder real.
Los escenarios de permisos/cancelación usan sustitutos de dispositivo, sin
capturar imágenes reales. Las páginas de `test/fixtures` nunca son activos de
publicación; no trasladar su sustituto de cámara al módulo de producción.
