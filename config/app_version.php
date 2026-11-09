<?php

// Versión publicada de la app Android (la consulta GET /api/app/version).
//
// Los valores van aquí, versionados: al publicar un APK nuevo se actualiza
// este archivo y el aviso aparece solo en las apps instaladas (no hace falta
// tocar variables de entorno en Railway).
//
// - `version_code` es la última versión publicada (aviso opcional).
// - `min_version_code` es la mínima aceptada: si la app instalada queda por
//   debajo, el aviso es obligatorio y no se puede cerrar.
// - `apk_url` apunta al APK publicado en la página de descargas. Como está
//   firmado con la misma llave, Android lo instala ENCIMA sin desinstalar ni
//   perder datos.
return [
    'version_code' => 25,
    'version_name' => '9.6',
    'min_version_code' => 21,
    'apk_url' => 'https://andres777233.github.io/QR-MOVIL/SenaAccessFinal.apk',
    'mensaje' => 'Hay una nueva versión de Sena Access. Actualiza para seguir usando la app.',
    'obligatorio' => false,
];
