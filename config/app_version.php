<?php

// Versión publicada de la app Android (la consulta GET /api/app/version).
// Para publicar una actualización: subir el APK a public/ y fijar aquí (o en
// las variables de entorno de Railway) version_code/min_version_code.
return [
    'version_code' => env('APP_MOVIL_VERSION_CODE', 21),
    'version_name' => env('APP_MOVIL_VERSION_NAME', '9.2'),
    // Si la app instalada trae un versionCode menor, se le exige actualizar.
    'min_version_code' => env('APP_MOVIL_MIN_VERSION_CODE', 21),
    'apk_url' => env('APP_MOVIL_APK_URL', '/SenaAccessV9.2.apk'),
    'mensaje' => env('APP_MOVIL_MENSAJE', 'Hay una nueva versión de Sena Access. Actualiza para seguir usando la app.'),
    'obligatorio' => (bool) env('APP_MOVIL_OBLIGATORIO', true),
];
