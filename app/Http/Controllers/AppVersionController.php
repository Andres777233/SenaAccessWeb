<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Versión publicada de la app Android. Las apps instaladas consultan este
 * endpoint al abrir y, si su versionCode es menor a `min_version_code`,
 * muestran (o exigen) la actualización con el enlace de descarga.
 *
 * Los valores viven en config/app_version.php y se pueden cambiar con
 * variables de entorno (APP_MOVIL_MIN_VERSION_CODE, APP_MOVIL_APK_URL...)
 * sin tocar código ni redeployar la app.
 */
class AppVersionController extends Controller
{
    public function mostrar(Request $request)
    {
        $datos = Cache::remember('app_version', now()->addMinutes(5), function () {
            $apkUrl = (string) config('app_version.apk_url', '/SenaAccessV9.2.apk');
            if (!str_starts_with($apkUrl, 'http')) {
                $apkUrl = rtrim(config('app.url'), '/') . '/' . ltrim($apkUrl, '/');
            }

            return [
                'version_code' => (int) config('app_version.version_code', 21),
                'version_name' => (string) config('app_version.version_name', '9.2'),
                'min_version_code' => (int) config('app_version.min_version_code', 21),
                'apk_url' => $apkUrl,
                'mensaje' => (string) config('app_version.mensaje', 'Hay una nueva versión de Sena Access. Actualiza para seguir usando la app.'),
                'obligatorio' => (bool) config('app_version.obligatorio', true),
            ];
        });

        return response()->json($datos);
    }
}
