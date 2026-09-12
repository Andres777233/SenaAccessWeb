<?php

namespace App\Http\Controllers;

use App\Mail\TwoFactorCodeMail;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use App\Services\NotificacionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class TwoFactorController extends Controller
{
    // Ventana de validez del reto (el usuario va a otro dispositivo y aprueba).
    public const RETO_MINUTOS = 10;

    // Vigencia del código de 6 dígitos enviado por correo (fallback).
    public const CODIGO_MINUTOS = 10;

    /**
     * Crea un reto de segundo factor cuando el usuario tiene 2FA activado.
     * Es llamado desde AuthController@login: NO se emite token hasta que el
     * reto se resuelva (aprobado por otro dispositivo o código del correo).
     */
    public function iniciarReto(User $user, Request $request)
    {
        $codigo = (string) random_int(100000, 999999);

        $reto = TwoFactorChallenge::create([
            'challenge_id' => (string) Str::uuid(),
            'fk_id_usuario' => $user->id_usuario,
            'estado' => 'pendiente',
            'code_hash' => Hash::make($codigo),
            'code_expires_at' => Carbon::now('America/Bogota')->addMinutes(self::CODIGO_MINUTOS),
            'expires_at' => Carbon::now('America/Bogota')->addMinutes(self::RETO_MINUTOS),
            'ip' => $request->ip(),
            'user_agent' => Str::limit($request->userAgent() ?? 'desconocido', 255),
        ]);

        // Fallback: código de 6 dígitos al correo. El envío no puede colgar el login.
        try {
            Mail::to($user->user_email)->send(new TwoFactorCodeMail($codigo));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error enviando codigo 2FA a {$user->user_email}: " . $e->getMessage());
        }

        // Aviso in-app: el otro dispositivo (con sesión) lo ve y puede aprobar/denegar.
        try {
            app(NotificacionService::class)->crearParaUsuario(
                $user->id_usuario,
                'Intento de acceso detectado',
                'Alguien intentó iniciar sesión en tu cuenta ' . Str::limit($request->userAgent() ?? 'desconocido', 80) . '. Si eres tú, aprueba el acceso.',
                'seguridad'
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error notificando 2FA: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'Verificación en dos pasos requerida.',
            'two_factor_required' => true,
            'two_factor_id' => $reto->challenge_id,
            'two_factor_method' => 'in_app_or_email',
            'code_sent' => $reto->code_hash !== null,
        ], 200);
    }

    /**
     * Estado de la configuración de 2FA del usuario autenticado (perfil).
     */
    public function estadoConfig(Request $request)
    {
        return response()->json([
            'two_factor_enabled' => (bool) $request->user()->two_factor_enabled,
        ], 200);
    }

    /**
     * Activa la verificación en dos pasos para la cuenta autenticada.
     */
    public function activar(Request $request)
    {
        $user = $request->user();

        $user->forceFill(['two_factor_enabled' => true])->save();

        return response()->json(['message' => 'Verificación en dos pasos activada.', 'two_factor_enabled' => true], 200);
    }

    /**
     * Desactiva la verificación en dos pasos. Exige la contraseña actual
     * (es una acción sensible en la cuenta).
     */
    public function desactivar(Request $request)
    {
        $validated = $request->validate([
            'user_password' => 'required|string',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['user_password'], $user->user_password)) {
            return response()->json(['message' => 'Contraseña incorrecta.'], 422);
        }

        $user->forceFill(['two_factor_enabled' => false])->save();

        // Invalida los retos pendientes: ya no deben aprobarse/validarse.
        TwoFactorChallenge::where('fk_id_usuario', $user->id_usuario)
            ->where('estado', 'pendiente')
            ->update(['estado' => 'rechazado', 'resolved_at' => Carbon::now('America/Bogota')]);

        return response()->json(['message' => 'Verificación en dos pasos desactivada.', 'two_factor_enabled' => false], 200);
    }

    /**
     * Valida el código de 6 dígitos enviado por correo (fallback). Público:
     * el dispositivo en el intento de login aún no tiene sesión.
     */
    public function validarCodigo(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        if (!$reto || $reto->estado !== 'pendiente') {
            return response()->json(['message' => 'El intento de acceso ya fue resuelto o no existe.'], 400);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now('America/Bogota')]);
            return response()->json(['message' => 'El intento de acceso expiró. Vuelve a intentarlo.'], 400);
        }

        if (!$reto->code_hash || !$reto->code_expires_at || $reto->code_expires_at->isPast()) {
            return response()->json(['message' => 'El código ya expiró. Vuelve a iniciar sesión.'], 400);
        }

        if (!Hash::check($validated['code'], $reto->code_hash)) {
            return response()->json(['message' => 'Código incorrecto.'], 422);
        }

        return $this->resolverAprobado($reto);
    }

    /**
     * Devuelve el estado de un reto. Público: el dispositivo en intento de login
     * hace polling aquí mientras espera que el otro dispositivo apruebe/deniegue.
     * Solo cuando queda aprobado se fabrica y entrega el token de acceso.
     */
    public function estado(Request $request, string $challengeId)
    {
        $reto = TwoFactorChallenge::where('challenge_id', $challengeId)->first();

        if (!$reto) {
            return response()->json(['message' => 'El intento de acceso no existe.'], 404);
        }

        if ($reto->estado === 'pendiente' && $reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now('America/Bogota')]);
        }

        if ($reto->estado === 'pendiente') {
            return response()->json(['two_factor_id' => $reto->challenge_id, 'estado' => 'pendiente']);
        }

        if ($reto->estado === 'rechazado') {
            return response()->json(['message' => 'El intento fue rechazado.', 'two_factor_id' => $reto->challenge_id, 'estado' => 'rechazado']);
        }

        if ($reto->estado === 'expirado') {
            return response()->json(['message' => 'El intento de acceso expiró.', 'two_factor_id' => $reto->challenge_id, 'estado' => 'expirado']);
        }

        // Aprobado: emitir (o reusar) el token y devolver el mismo LoginResponse que /api/login.
        return $this->respuestaLogin($reto);
    }

    /**
     * Retos pendientes del usuario autenticado: es lo que hace polling el
     * dispositivo con sesión para mostrar la tarjeta "¿Eres tú?".
     */
    public function pendientes(Request $request)
    {
        $reto = TwoFactorChallenge::where('fk_id_usuario', $request->user()->id_usuario)
            ->where('estado', 'pendiente')
            ->where('expires_at', '>', Carbon::now('America/Bogota'))
            ->orderByDesc('id')
            ->first();

        if (!$reto) {
            return response()->json(['pending' => false]);
        }

        return response()->json([
            'pending' => true,
            'challenge' => [
                'challenge_id' => $reto->challenge_id,
                'ip' => $reto->ip,
                'user_agent' => $reto->user_agent,
                'created_at' => $reto->created_at?->toIso8601String(),
                'expires_at' => $reto->expires_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * El usuario con sesión aprueba o deniega un reto de su propia cuenta.
     * Solo puede responder retos que pertenezcan a su usuario.
     */
    public function aprobar(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'decision' => 'required|in:aprobar,denegar',
        ]);

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        if (!$reto || $reto->fk_id_usuario !== $request->user()->id_usuario) {
            return response()->json(['message' => 'Este intento de acceso no te pertenece.'], 403);
        }

        if ($reto->estado !== 'pendiente') {
            return response()->json(['message' => 'Este intento ya fue resuelto.'], 400);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now('America/Bogota')]);
            return response()->json(['message' => 'El intento de acceso ya expiró.'], 400);
        }

        $reto->update([
            'estado' => $validated['decision'] === 'aprobar' ? 'aprobado' : 'rechazado',
            'resolved_at' => Carbon::now('America/Bogota'),
        ]);

        if ($validated['decision'] === 'denegar') {
            return response()->json(['message' => 'Acceso denegado.'], 200);
        }

        return response()->json(['message' => 'Acceso aprobado.'], 200);
    }

    /**
     * Fabrica el LoginResponse completo. Solo se emite un token por reto.
     */
    private function resolverAprobado(TwoFactorChallenge $reto)
    {
        $reto->update([
            'estado' => 'aprobado',
            'resolved_at' => Carbon::now('America/Bogota'),
        ]);

        return $this->respuestaLogin($reto);
    }

    private function respuestaLogin(TwoFactorChallenge $reto)
    {
        $user = User::with('role')->find($reto->fk_id_usuario);

        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        if (!$reto->access_token) {
            $token = $user->createToken('auth_token')->plainTextToken;
            $reto->forceFill(['access_token' => $token])->save();
            // Registra la Entrada solo cuando el acceso se completa con éxito,
            // para no inflar "presentes" con intentos no resueltos.
            try {
                app(AuthController::class)->registrarMovimiento($user->id_usuario, 'Entrada');
            } catch (\Throwable $e) {
                // Registro de ingreso best-effort: no rompe el login.
            }
        }

        $user->refresh();

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $user,
            'role' => $user->role->rol_name,
            'access_token' => $reto->access_token,
            'token_type' => 'Bearer',
            'email_verified_at' => $user->email_verified_at,
        ]);
    }
}