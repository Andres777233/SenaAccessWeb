<?php

namespace App\Http\Controllers;

use App\Mail\TwoFactorCodeMail;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use App\Services\NotificacionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class TwoFactorController extends Controller
{
    // Ventana de validez del reto (el usuario va a otro dispositivo y aprueba).
    public const RETO_MINUTOS = 10;

    // Vigencia del código de 6 dígitos enviado por correo (fallback).
    public const CODIGO_MINUTOS = 10;

    // Segundos mínimos entre dos reenvíos del mismo reto.
    public const REENVIO_SEGUNDOS = 60;

    // Modos de verificación: 'siempre' = código en cada inicio de sesión;
    // 'dispositivo' = solo en teléfonos/navegadores nuevos (confiables).
    public const MODO_SIEMPRE = 'siempre';
    public const MODO_DISPOSITIVO = 'dispositivo';

    // Pista del correo sin exponerlo completo: j***@sena.edu.co
    private function pistaCorreo(?string $email): string
    {
        $email = (string) $email;
        $pos = strpos($email, '@');
        if ($pos === false || $pos === 0) {
            return '';
        }
        return substr($email, 0, 1) . '***' . substr($email, $pos);
    }

    // Envía el correo con el código y los botones firmados del reto.
    private function enviarCodigo(User $user, TwoFactorChallenge $reto, string $codigo): void
    {
        try {
            $base = rtrim(config('app.url'), '/');
            $firma = fn (string $dec) => hash_hmac('sha256', $reto->challenge_id . '|' . $dec, config('app.key'));
            $aprobarUrl = $base . '/api/2fa/decidir?challenge_id=' . $reto->challenge_id . '&dec=aprobar&sig=' . $firma('aprobar');
            $denegarUrl = $base . '/api/2fa/decidir?challenge_id=' . $reto->challenge_id . '&dec=denegar&sig=' . $firma('denegar');
            Mail::to($user->user_email)->send(new TwoFactorCodeMail(
                $codigo,
                $aprobarUrl,
                $denegarUrl,
                $reto->challenge_id,
                trim(($user->user_name ?? '') . ' ' . ($user->user_lastname ?? ''))
            ));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error enviando codigo 2FA a {$user->user_email}: " . $e->getMessage());
        }
    }

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
            'code_expires_at' => Carbon::now()->addMinutes(self::CODIGO_MINUTOS),
            'expires_at' => Carbon::now()->addMinutes(self::RETO_MINUTOS),
            'ip' => $request->ip(),
            'user_agent' => Str::limit($request->userAgent() ?? 'desconocido', 255),
            'device_id' => $request->input('device_id'),
        ]);

        // Código de 6 dígitos al correo + botones "¿Eres tú?" tipo Google.
        // El envío no puede colgar el login.
        $this->enviarCodigo($user, $reto, $codigo);
        // Marca de tiempo del envío: controla la ventana de reenvío.
        Cache::put('2fa_reenvio:' . $reto->challenge_id, Carbon::now()->timestamp, now()->addMinutes(self::RETO_MINUTOS));

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
            // Ayudas para la pantalla de verificación (web y móvil).
            'email_hint' => $this->pistaCorreo($user->user_email),
            'code_expires_at' => $reto->code_expires_at?->toIso8601String(),
            'segundos_para_reenvio' => self::REENVIO_SEGUNDOS,
        ], 200);
    }

    /**
     * Estado de la configuración de 2FA del usuario autenticado (perfil).
     */
    public function estadoConfig(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
            'modo' => $user->two_factor_modo ?: self::MODO_DISPOSITIVO,
            'dispositivo_confiable' => (bool) $user->trusted_device_id,
        ], 200);
    }

    /**
     * Activa la verificación en dos pasos para la cuenta autenticada.
     */
    public function activar(Request $request)
    {
        $validated = $request->validate([
            'user_password' => 'required|string',
            'modo' => 'nullable|in:siempre,dispositivo',
        ]);

        $user = $request->user();

        // Activar 2FA es sensible: si un token ajeno cae en malas manos, no
        // debe poder bloquear la cuenta sin conocer la clave actual.
        if (!Hash::check($validated['user_password'], $user->user_password)) {
            return response()->json(['message' => 'Contraseña incorrecta.'], 422);
        }

        // Por defecto se pide el código en CADA inicio de sesión: así la
        // verificación se nota. 'dispositivo' mantiene el comportamiento de
        // confiar en el teléfono/navegador ya verificado.
        $modo = $validated['modo'] ?? self::MODO_SIEMPRE;

        $user->forceFill(['two_factor_enabled' => true, 'two_factor_modo' => $modo])->save();

        return response()->json([
            'message' => $modo === self::MODO_SIEMPRE
                ? 'Verificación en dos pasos activada: se pedirá el código en cada inicio de sesión.'
                : 'Verificación en dos pasos activada: este dispositivo quedará como confiable.',
            'two_factor_enabled' => true,
            'modo' => $modo,
        ], 200);
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
            ->update(['estado' => 'rechazado', 'resolved_at' => Carbon::now()]);

        return response()->json(['message' => 'Verificación en dos pasos desactivada.', 'two_factor_enabled' => false], 200);
    }

    /**
     * Reenvía el código de 6 dígitos del reto (público: lo pide la pantalla de
     * verificación que aún no tiene sesión). Un reenvío por minuto y por reto.
     */
    public function reenviar(Request $request)
    {
        $validated = $request->validate(['challenge_id' => 'required|string']);

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        if (!$reto || $reto->estado !== 'pendiente') {
            return response()->json(['message' => 'El intento de acceso ya fue resuelto o no existe.'], 400);
        }
        if ($reto->expires_at->isPast()) {
            return response()->json(['message' => 'El intento de acceso expiró. Vuelve a iniciar sesión.'], 400);
        }

        $llave = '2fa_reenvio:' . $reto->challenge_id;
        $ultimo = (int) Cache::get($llave, 0);
        $espera = self::REENVIO_SEGUNDOS - (Carbon::now()->timestamp - $ultimo);
        if ($ultimo && $espera > 0) {
            return response()->json([
                'message' => "Espera {$espera} segundos para pedir otro código.",
                'segundos_para_reenvio' => $espera,
            ], 429);
        }

        $usuario = User::find($reto->fk_id_usuario);
        if (!$usuario) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        $codigo = (string) random_int(100000, 999999);
        $reto->code_hash = Hash::make($codigo);
        $reto->code_expires_at = Carbon::now()->addMinutes(self::CODIGO_MINUTOS);
        $reto->save();

        $this->enviarCodigo($usuario, $reto, $codigo);
        Cache::put($llave, Carbon::now()->timestamp, now()->addMinutes(self::RETO_MINUTOS));
        Cache::forget('2fa_intentos:' . $reto->challenge_id);

        return response()->json([
            'message' => 'Código reenviado.',
            'email_hint' => $this->pistaCorreo($usuario->user_email),
            'code_expires_at' => $reto->code_expires_at?->toIso8601String(),
            'segundos_para_reenvio' => self::REENVIO_SEGUNDOS,
        ], 200);
    }

    /**
     * Olvida el dispositivo confiable: el próximo inicio de sesión en este
     * teléfono/navegador volverá a pedir el código.
     */
    public function olvidarDispositivo(Request $request)
    {
        $user = $request->user();
        $user->forceFill(['trusted_device_id' => null])->save();

        return response()->json([
            'message' => 'Dispositivo olvidado: el próximo inicio de sesión pedirá el código.',
            'dispositivo_confiable' => false,
        ], 200);
    }

    /**
     * Cambia el modo de verificación (cada inicio de sesión o solo en
     * dispositivos nuevos). Exige la contraseña actual.
     */
    public function cambiarModo(Request $request)
    {
        $validated = $request->validate([
            'user_password' => 'required|string',
            'modo' => 'required|in:siempre,dispositivo',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['user_password'], $user->user_password)) {
            return response()->json(['message' => 'Contraseña incorrecta.'], 422);
        }

        $user->forceFill(['two_factor_modo' => $validated['modo']])->save();

        return response()->json([
            'message' => $validated['modo'] === self::MODO_SIEMPRE
                ? 'Listo: se pedirá el código en cada inicio de sesión.'
                : 'Listo: este dispositivo quedará como confiable.',
            'modo' => $validated['modo'],
        ], 200);
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
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            return response()->json(['message' => 'El intento de acceso expiró. Vuelve a intentarlo.'], 400);
        }

        if (!$reto->code_hash || !$reto->code_expires_at || $reto->code_expires_at->isPast()) {
            return response()->json(['message' => 'El código ya expiró. Vuelve a iniciar sesión.'], 400);
        }

        if (!Hash::check($validated['code'], $reto->code_hash)) {
            // Limite por reto: sin esto, el throttle por IP se puede esquivar
            // rotando codigos y el de 6 digitos seria fuerza bruta viable.
            $llave = '2fa_intentos:' . $reto->challenge_id;
            $intentos = (int) Cache::get($llave, 0) + 1;
            Cache::put($llave, $intentos, now()->addMinutes(self::RETO_MINUTOS));

            if ($intentos >= 5) {
                $reto->update(['estado' => 'rechazado', 'resolved_at' => Carbon::now()]);
                return response()->json(['message' => 'Demasiados intentos. Vuelve a iniciar sesión.'], 429);
            }

            return response()->json(['message' => 'Código incorrecto.'], 422);
        }

        Cache::forget('2fa_intentos:' . $reto->challenge_id);

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
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
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
            ->where('expires_at', '>', Carbon::now())
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
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            return response()->json(['message' => 'El intento de acceso ya expiró.'], 400);
        }

        $reto->update([
            'estado' => $validated['decision'] === 'aprobar' ? 'aprobado' : 'rechazado',
            'resolved_at' => Carbon::now(),
        ]);

        if ($validated['decision'] === 'denegar') {
            $this->notificarBloqueo($reto);
            return response()->json(['message' => 'Acceso denegado.'], 200);
        }

        // El dueño confirmó que es él: ese teléfono queda confiable y no vuelve
        // a pedirle código en este dispositivo (solo en otros nuevos).
        $this->confiarDispositivo($reto);

        return response()->json(['message' => 'Acceso aprobado.'], 200);
    }

    /**
     * Botones "¿Eres tú?" del correo 2FA (tipo Google). Público pero firmado
     * con APP_KEY: sin la firma correcta el enlace es inválido (403). Resuelve
     * el reto a aprobado/rechazado y muestra una página de confirmación.
     */
    public function decidir(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'dec' => 'required|in:aprobar,denegar',
            'sig' => 'required|string',
        ]);

        $firma = hash_hmac('sha256', $validated['challenge_id'] . '|' . $validated['dec'], config('app.key'));
        if (!hash_equals($firma, $validated['sig'])) {
            abort(403, 'Enlace inválido o caducado.');
        }

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        $resultado = $validated['dec'] === 'aprobar' ? 'aprobado' : 'rechazado';

        if (!$reto || $reto->estado !== 'pendiente') {
            $mensaje = 'Este intento de acceso ya fue respondido o no existe.';
            return $this->paginaDecision($mensaje, '#666666', $validated['challenge_id']);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            $mensaje = 'Este intento de acceso ya expiró. Pide a la persona que vuelva a intentarlo.';
            return $this->paginaDecision($mensaje, '#b55400', $validated['challenge_id']);
        }

        $reto->update(['estado' => $resultado, 'resolved_at' => Carbon::now()]);

        if ($validated['dec'] === 'aprobar') {
            $mensaje = '¡Acceso aprobado! Ya puedes volver al dispositivo y continuar.';
            $this->confiarDispositivo($reto);
            return $this->paginaDecision($mensaje, '#00875A', $validated['challenge_id']);
        }

        $this->notificarBloqueo($reto);
        $mensaje = 'Acceso denegado. La persona que intentó entrar ya fue bloqueada.';
        return $this->paginaDecision($mensaje, '#BE0000', $validated['challenge_id']);
    }

    private function paginaDecision(string $mensaje, string $color, ?string $challengeId = null): \Illuminate\Http\Response
    {
        $botonApp = '';
        if (!empty($challengeId)) {
            $id = htmlspecialchars($challengeId, ENT_QUOTES, 'UTF-8');
            $botonApp = '<div style="margin-top:22px;"><a href="senaaccess://2fa?challenge_id=' . $id . '" '
                . 'style="display:block;background:#02D914;color:#000;font-weight:700;font-size:14px;letter-spacing:1px;'
                . 'text-decoration:none;border-radius:10px;padding:13px;">ABRIR LA APP Y CONTINUAR</a>'
                . '<div style="font-size:12px;color:#666;margin-top:10px;">Si estás en computador, abre el correo en tu celular y toca el botón.</div></div>';
        }
        return response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SENA Access</title></head>'
            . '<body style="margin:0;font-family:Inter,Arial,sans-serif;background:#f4f4f4;display:flex;align-items:center;justify-content:center;min-height:100vh;">'
            . '<div style="background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);max-width:440px;padding:40px;text-align:center;">'
            . '<div style="color:#00875A;font-size:26px;font-weight:700;margin-bottom:18px;">SENA Access</div>'
            . '<div style="font-size:15px;line-height:1.5;color:#333;">' . htmlspecialchars($mensaje) . '</div>'
            . $botonApp
            . '</div></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8']
        );
    }

    /**
     * Avisa al dueño cuando alguien deniega un intento: lugar (IP), fecha, hora
     * y dispositivo que intentó entrar. Best-effort: nunca rompe la respuesta.
     */
    private function notificarBloqueo(TwoFactorChallenge $reto): void
    {
        try {
            $fecha = $reto->created_at
                ? $reto->created_at->copy()->setTimezone('America/Bogota')->format('d/m/Y H:i')
                : 'fecha desconocida';
            $ip = $reto->ip ?: 'IP desconocida';
            $disp = $reto->user_agent ? Str::limit($reto->user_agent, 100) : 'dispositivo desconocido';
            app(NotificacionService::class)->crearParaUsuario(
                $reto->fk_id_usuario,
                'Intento de acceso bloqueado',
                "Bloqueaste un intento de acceso a tu cuenta. Lugar (IP): {$ip}. Fecha y hora: {$fecha} (Bogotá). Dispositivo: {$disp}. Si no fuiste tú, cambia tu contraseña.",
                'seguridad'
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo notificar bloqueo 2FA: ' . $e->getMessage());
        }
    }

    /**
     * Marca el teléfono del reto como confiable para que el dueño no vuelva a
     * ver el 2FA en ese dispositivo (manual o huella). Solo otros teléfonos
     * generan reto nuevo.
     */
    private function confiarDispositivo(TwoFactorChallenge $reto): void
    {
        if (empty($reto->device_id)) {
            return;
        }
        try {
            $usuario = User::find($reto->fk_id_usuario);
            if ($usuario && $usuario->trusted_device_id !== $reto->device_id) {
                $usuario->forceFill(['trusted_device_id' => $reto->device_id])->save();
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo confiar dispositivo 2FA: ' . $e->getMessage());
        }
    }

    /**
     * Fabrica el LoginResponse completo. Solo se emite un token por reto.
     */
    private function resolverAprobado(TwoFactorChallenge $reto)
    {
        $reto->update([
            'estado' => 'aprobado',
            'resolved_at' => Carbon::now(),
        ]);

        return $this->respuestaLogin($reto);
    }

    private function respuestaLogin(TwoFactorChallenge $reto)
    {
        $user = User::with('role')->find($reto->fk_id_usuario);

        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        if (($user->estado_cuenta ?? 'aprobada') === 'pendiente') {
            return response()->json(['message' => 'Tu cuenta esta en espera de aprobacion.'], 403);
        }

        if (($user->estado_cuenta ?? '') === 'rechazada') {
            return response()->json(['message' => 'Tu solicitud de cuenta fue rechazada.'], 403);
        }

        // Reto aprobado = dueño verificado: confía en este teléfono de una vez.
        $this->confiarDispositivo($reto);

        // Un token nuevo por reto, revocando el anterior si el cliente vuelve
        // a consultar el estado. El token NUNCA se guarda en claro en la BD.
        $nombreToken = '2fa_' . $reto->challenge_id;
        $user->tokens()->where('name', $nombreToken)->delete();
        $token = $user->createToken($nombreToken)->plainTextToken;
        // Sin Entrada automática: la marca el QR de portería (puerta de entrada).

        $user->refresh();

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $user,
            'role' => $user->role->rol_name,
            'access_token' => $token,
            'token_type' => 'Bearer',
            'email_verified_at' => $user->email_verified_at,
        ]);
    }
}