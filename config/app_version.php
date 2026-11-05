<?php

// Versión publicada de la app Android (la consulta GET /api/app/version).
// Al publicar un APK nuevo basta con cambiar version_code/version_name aquí
// (o en las variables de entorno de Railway): las apps instaladas lo consultan
// al abrir y muestran el aviso de actualización.
//
// - `version_code` es la última versión publicada (aviso opcional).
// - `min_version_code` es la mínima aceptada: si la app instalada queda por
//   debajo, el aviso es obligatorio y no se puede cerrar.
// - `apk_url` apunta al APK publicado en la página de descargas (misma firma,
//   por lo que Android lo instala encima sin desinstalar ni perder datos).
return [
    'version_code' => env('APP_MOVIL_VERSION_CODE', 24),
    'version_name' => env('APP_MOVIL_VERSION_NAME', '9.5'),
    'min_version_code' => env('APP_MOVIL_MIN_VERSION_CODE', 21),
    'apk_url' => env('APP_MOVIL_APK_URL', 'https://andres777233.github.io/QR-MOVIL/SenaAccessDef.apk'),
    'mensaje' => env('APP_MOVIL_MENSAJE', 'Hay una nueva versión de Sena Access. Actualiza para seguir usando la app.'),
    'obligatorio' => (bool) env('APP_MOVIL_OBLIGATORIO', false),
];
