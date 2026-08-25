<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\Passkey;
use App\Models\User;
use App\Models\WebauthnChallenge;
use App\Services\WebAuthnService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use ParagonIE\ConstantTime\Base64UrlSafe;

// Controlador de las ceremonias WebAuthn (passkeys). Registra llaves públicas por
// usuario y permite iniciar sesión con la huella del dispositivo: el servidor
// genera un reto, el teléfono lo firma con su llave privada (desbloqueada por la
// biometría) y aquí se verifica la firma antes de emitir el token de acceso.

class PasskeyController extends Controller
{
    // Paso 1 del registro: devuelve las opciones de creación de la llave y
    // guarda el reto en el servidor (10 minutos de vigencia).
    public function registerOptions(Request $request)
    {
        $user = $request->user();
        WebauthnChallenge::where('user_id', $user->id_usuario)
            ->where('purpose', 'register')
            ->delete();

        $service = new WebAuthnService();
        $options = $service->creationOptions($user);

        WebauthnChallenge::create([
            'user_id' => $user->id_usuario,
            'challenge' => $options['challenge'],
            'purpose' => 'register',
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        return response()->json([
            'options' => $options,
            'challenge' => $options['challenge'],
        ]);
    }

    // Paso 2 del registro: verifica la respuesta firmada y guarda la llave pública.
    public function register(Request $request)
    {
        $request->validate([
            'response' => 'required|string',
        ]);

        $user = $request->user();
        $challengeRow = WebauthnChallenge::where('user_id', $user->id_usuario)
            ->where('purpose', 'register')
            ->latest()
            ->first();

        if (! $challengeRow || $challengeRow->expires_at->isPast()) {
            return response()->json(['message' => 'La solicitud expiró. Intenta de nuevo.'], 400);
        }

        try {
            $record = (new WebAuthnService())->verifyRegistration($user, $challengeRow->challenge, $request->input('response'));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Verificación fallida: ' . $e->getMessage()], 400);
        }

        $credentialId = Base64UrlSafe::encodeUnpadded($record->publicKeyCredentialId);
        $existing = Passkey::where('credential_id', $credentialId)->first();
        $challengeRow->delete();

        if ($existing) {
            return response()->json(['message' => 'La huella ya estaba registrada.'], 200);
        }

        Passkey::create([
            'fk_id_user' => $user->id_usuario,
            'credential_id' => $credentialId,
            'public_key' => Base64UrlSafe::encodeUnpadded($record->credentialPublicKey),
            'aaguid' => (string) $record->aaguid,
            'attestation_type' => $record->attestationType,
            'transports' => json_encode($record->transports),
            'user_handle' => Base64UrlSafe::encodeUnpadded($record->userHandle),
            'counter' => $record->counter,
            'backup_eligible' => $record->backupEligible,
            'backup_status' => $record->backupStatus,
            'uv_initialized' => $record->uvInitialized,
        ]);

        return response()->json(['message' => 'Huella registrada correctamente.'], 201);
    }

    // Paso 1 del login: devuelve las opciones de autenticación (lista de llaves
    // vacía = el usuario elige su passkey) y guarda el reto.
    public function loginOptions(Request $request)
    {
        WebauthnChallenge::whereNull('user_id')
            ->where('purpose', 'login')
            ->delete();

        $service = new WebAuthnService();
        $options = $service->requestOptions();

        WebauthnChallenge::create([
            'user_id' => null,
            'challenge' => $options['challenge'],
            'purpose' => 'login',
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        return response()->json([
            'options' => $options,
            'challenge' => $options['challenge'],
        ]);
    }

    // Paso 2 del login: verifica la firma biométrica y emite el token de acceso
    // (mismo formato de respuesta que POST /api/login).
    public function login(Request $request)
    {
        $request->validate([
            'response' => 'required|string',
        ]);

        $challengeRow = WebauthnChallenge::whereNull('user_id')
            ->where('purpose', 'login')
            ->latest()
            ->first();

        if (! $challengeRow || $challengeRow->expires_at->isPast()) {
            return response()->json(['message' => 'La solicitud expiró. Intenta de nuevo.'], 400);
        }

        try {
            $passkey = (new WebAuthnService())->verifyLogin($challengeRow->challenge, $request->input('response'));
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Verificación fallida: ' . $e->getMessage()], 400);
        }

        $user = User::find($passkey->fk_id_user);
        if (! $user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 401);
        }

        $challengeRow->delete();

        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => 'Entrada',
            'fk_id_user' => $user->id_usuario,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $user,
            'role' => $user->role->rol_name,
            'access_token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    // Lista las passkeys del usuario autenticado (para gestionarlas desde el perfil).
    public function index(Request $request)
    {
        return $request->user()->passkeys;
    }

    // Elimina una passkey propia del usuario autenticado.
    public function destroy(Request $request, $id)
    {
        $passkey = Passkey::where('id', $id)
            ->where('fk_id_user', $request->user()->id_usuario)
            ->first();

        if (! $passkey) {
            return response()->json(['message' => 'Credencial no encontrada.'], 404);
        }

        $passkey->delete();

        return response()->json(['message' => 'Huella eliminada.']);
    }
}