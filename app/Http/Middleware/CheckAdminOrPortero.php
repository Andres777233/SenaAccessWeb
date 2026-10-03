<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminOrPortero
{
    // Portería operativa: admin conserva acceso total y el portero entra solo
    // a equipos, historial de accesos y validación de excusas.
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || !in_array(strtolower($user->role?->rol_name ?? ''), ['admin', 'portero'])) {
            return response()->json(['message' => 'No tienes permisos de portería'], 403);
        }

        return $next($request);
    }
}
