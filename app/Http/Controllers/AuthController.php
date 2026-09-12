<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\TokenRecovery;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use \Laravel\Sanctum\PersonalAccessToken;

use App\Models\Ingreso;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Mail\RecoveryCodeMail;

class AuthController extends Controller
{
    /**
     * Registra un movimiento (Entrada/Salida) del usuario en la tabla ingresos.
     */
    public function registrarMovimiento(int $idUsuario, string $tipo): Ingreso
    {
        return Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => $tipo,
            'fk_id_user' => $idUsuario,
        ]);
    }

    /**
     * Código de recuperación legible de 8 caracteres sin caracteres ambiguos
     * (evita O/0, I/1, l). Se envía en texto plano por correo, pero en la base
     * de datos solo se guarda su hash bcrypt para que un robo de la tabla no
     * comprometa las cuentas.
     */
    private function generarCodigo(): string
    {
        $alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $codigo = '';
        for ($i = 0; $i < 8; $i++) {
            $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }
        return $codigo;
    }

    public function register(Request $request)
    {
        //VALIDADOR: DATOS NECESARIOS PARA EL REGISTRO
        // El correo solo se acepta si termina en @gmail.com, @hotmail.com o
        // @soy.sena.edu.co (evita correos falsos de otros dominios).
        $validator = Validator::make($request->all(), [
            'user_identification' => 'required|string|max:20|unique:usuarios',
            'user_name' => 'required|string|max:50',
            'user_lastname' => 'required|string|max:50',
            'user_email' => [
                'required', 'string', 'email', 'max:100', 'unique:usuarios',
                function ($attribute, $value, $fail) {
                    $dominios = ['@gmail.com', '@hotmail.com', '@soy.sena.edu.co'];
                    foreach ($dominios as $d) {
                        if (str_ends_with(strtolower($value), $d)) return;
                    }
                    $fail('El correo debe ser @gmail.com, @hotmail.com o @soy.sena.edu.co.');
                },
            ],
            'user_password' => 'required|string|min:8|confirmed',
            'user_coursenumber' => 'required|integer',
            'user_program' => 'required|string|max:100',
            'user_documento_tipo' => 'required|in:CC,CE,TI,PAS',
            'user_telefono' => 'nullable|string|max:20',
        ]);
        //SI LOS DATOS ESTAN INCOMPLETOS NO CONTINUA EL PROCESO 
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // ROL PREDETERMINADO APRENDIZ 
        $role = Role::where('rol_name', 'Aprendiz')->first();

        $user = User::create([
            'user_identification' => $request->user_identification,
            'user_name' => $request->user_name,
            'user_lastname' => $request->user_lastname,
            'user_email' => $request->user_email,
            'user_password' => Hash::make($request->user_password),
            'user_coursenumber' => $request->user_coursenumber,
            'user_program' => $request->user_program,
            'user_documento_tipo' => $request->user_documento_tipo,
            'user_telefono' => $request->user_telefono,
            'fk_id_rol' => $role->id_rol,
        ]);

        // Dispara el evento Registered -> SendEmailVerificationNotification:
        // al usuario se le envía el enlace de verificación de correo.
        event(new Registered($user));

        return response()->json(['message' => 'Usuario registrado exitosamente', 'user' => $user], 201);
    }

    public function login(Request $request)
    {
        // Normaliza el correo y la contraseña (quita espacios accidentales y normaliza mayúsculas)
        $request->merge([
            'user_email' => strtolower(trim($request->input('user_email'))),
            'user_password' => trim($request->input('user_password')),
        ]);

        $credentials = $request->validate([
            'user_email' => 'required|email',
            'user_password' => 'required',
            'device_id' => 'nullable|string|max:64',
        ]);

        $user = User::where('user_email', $credentials['user_email'])->first();

        if (!$user || !Hash::check($credentials['user_password'], $user->user_password)) {
            return response()->json(['message' => 'Credenciales incorrectas'], 401);
        }

        // Verificación en dos pasos: solo si está activa Y el dispositivo no es
        // el original ya verificado. Una vez el dueño aprueba un teléfono, ese
        // device_id queda confiable y el login manual o con huella entra directo.
        // Solo un dispositivo nuevo (u otro teléfono) genera reto + correo.
        if ($user->two_factor_enabled) {
            $deviceId = $request->input('device_id');
            $esConfiable = $deviceId && $user->trusted_device_id && hash_equals($user->trusted_device_id, $deviceId);
            if (!$esConfiable) {
                return app(TwoFactorController::class)->iniciarReto($user, $request);
            }
        }

        // Crear registro de ingreso
        $this->registrarMovimiento($user->id_usuario, 'Entrada');

        $token = $user->createToken('auth_token')->plainTextToken;

        // email_verified_at indica en la respuesta si el correo fue verificado;
        // la app puede mostrarlo (pill "correo verificado") o sugerir verificarlo.
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

    public function logout(Request $request)
    {
        $user = $request->user();

        // Registrar salida
        $this->registrarMovimiento($user->id_usuario, 'Salida');

        /** @var \Laravel\Sanctum\PersonalAccessToken $token */
        $token = $user->currentAccessToken();
        if ($token) {
            $token->delete();
        }
        return response()->json(['message' => 'Sesión cerrada']);
    }

    /**
     * Registra la Salida cuando el usuario cierra la app/pestaña sin pasar por logout.
     * El frontend la invoca con fetch keepalive en el evento pagehide (solo al cerrar
     * la última pestaña). Con dedup: si el último movimiento ya es Salida, no duplica.
     * Guarda el id de la Salida en cache 90s para poder revertirla si era un refresh.
     */
    public function sessionExit(Request $request)
    {
        $user = $request->user();

        $ultimo = Ingreso::where('fk_id_user', $user->id_usuario)
            ->orderByDesc('id_ingreso')
            ->first();

        if ($ultimo && $ultimo->ingreso_type === 'Salida') {
            return response()->json(['message' => 'La salida ya estaba registrada'], 200);
        }

        $salida = $this->registrarMovimiento($user->id_usuario, 'Salida');

        Cache::put("session_exit_pendiente:{$user->id_usuario}", $salida->id_ingreso, now()->addSeconds(90));

        return response()->json(['message' => 'Salida registrada'], 201);
    }

    /**
     * Revierte la Salida registrada por un cierre si resultó ser un refresh (F5):
     * el frontend la llama al cargar la SPA cuando navigation.type === 'reload'.
     */
    public function cancelSessionExit(Request $request)
    {
        $user = $request->user();
        $key = "session_exit_pendiente:{$user->id_usuario}";
        $idSalida = Cache::get($key);

        if (!$idSalida) {
            return response()->json(['message' => 'No hay salida pendiente de revertir'], 200);
        }

        $ultimo = Ingreso::where('fk_id_user', $user->id_usuario)
            ->orderByDesc('id_ingreso')
            ->first();

        // Solo se revierte si sigue siendo el último movimiento del usuario.
        if ($ultimo && $ultimo->id_ingreso === (int) $idSalida && $ultimo->ingreso_type === 'Salida') {
            Ingreso::where('id_ingreso', $idSalida)->delete();
        }

        Cache::forget($key);

        return response()->json(['message' => 'Salida revertida'], 200);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('user_email', strtolower(trim($request->email)))->first();

        if (!$user) {
            return response()->json(['message' => 'Si el correo existe, se ha enviado un enlace.'], 200);
        }

        // Invalida tokens anteriores pendientes para que solo valga el último código.
        DB::table('token_recovery')
            ->where('fk_id_usuario', $user->id_usuario)
            ->where('token_used', false)
            ->update(['token_used' => true]);

        // Generar código de recuperación de 8 caracteres legible (sin 0/O/1/I/l)
        $token = $this->generarCodigo();

        // Guardar en la tabla token_recovery SOLO su hash bcrypt: si alguien roba
        // la base de datos no puede usar los códigos para cambiar contraseñas.
        TokenRecovery::create([
            'token_code' => Hash::make($token),
            'token_exp' => Carbon::now('America/Bogota')->addMinutes(15),
            'token_used' => false,
            'fk_id_usuario' => $user->id_usuario,
        ]);

        // Enviar correo electrónico con el código de recuperación (texto plano solo en el email).
        // El envío nunca debe colgar ni romper la petición: si falla (clave de correo inválida,
        // dominio no verificado, etc.) se registra el error y se responde igual al usuario.
        try {
            Mail::to($user->user_email)->send(new RecoveryCodeMail($token));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error enviando codigo de recuperacion a {$user->user_email}: " . $e->getMessage());
        }

        return response()->json(['message' => 'Se ha enviado el código a tu correo.'], 200);
    }

    public function resetPassword(Request $request) //FUNCION PARA RESETEAR LA CONTRASEÑA
    {
        $request->validate([
            'code' => 'required|string', //VALIDA QUE EL CODIGO EXISTA
            'password' => 'required|string|min:8|confirmed', //VALIDA QUE LA CONTRASEÑA EXISTA
        ]);

        // El código guardado es un hash bcrypt: se compara con Hash::check.
        $tokenRecord = TokenRecovery::where('token_used', false) //VALIDA QUE EL TOKEN NO SE HAYA USADO
            ->where('token_exp', '>=', Carbon::now('America/Bogota')) //VALIDA QUE EL TOKEN NO HAYA EXPIRADO
            ->get()
            ->first(function ($t) use ($request) {
                return Hash::check($request->code, $t->token_code);
            });

        if (!$tokenRecord) {
            return response()->json(['message' => 'El código es inválido o ha expirado.'], 400);
        }

        $user = User::where('id_usuario', $tokenRecord->fk_id_usuario)->first(); //OBTIENE EL USUARIO
        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        $user->user_password = Hash::make($request->password); //ACTUALIZA LA CONTRASEÑA DEL USUARIO
        $user->save(); //GUARDA LOS CAMBIOS EN LA BASE DE DATOS

        // Invalida todos los tokens pendientes del usuario (el último ya se usó):
        // evita reutilizar un mismo correo para generar varios códigos válidos.
        DB::table('token_recovery')
            ->where('fk_id_usuario', $user->id_usuario)
            ->update([
                'token_used' => true,
                'updated_at' => Carbon::now('America/Bogota'),
            ]);

        return response()->json(['message' => 'Contraseña actualizada correctamente.'], 200);
    }

    /**
     * Confirma la verificación del correo mediante enlace firmado temporal
     * (expira en 60 min). El hash es sha1 del correo y la firma la añade la ruta 'signed'.
     */
    public function verifyEmail(Request $request, $id, $hash)
    {
        $user = User::findOrFail($id);

        if (!hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return response()->json(['message' => 'Enlace de verificación inválido.'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'El correo ya estaba verificado.'], 200);
        }

        $user->markEmailAsVerified();

        return response()->json(['message' => 'Correo verificado correctamente.'], 200);
    }

    /**
     * Reenvía el enlace de verificación al usuario autenticado.
     */
    public function resendVerification(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'El correo ya estaba verificado.'], 200);
        }

        // El reenvío tampoco puede fallar la petición: se intenta y se registra el error.
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error reenviando verificacion a {$user->user_email}: " . $e->getMessage());
        }

        return response()->json(['message' => 'Se reenvió el enlace de verificación a tu correo.'], 200);
    }
}