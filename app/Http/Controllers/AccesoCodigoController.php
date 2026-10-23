<?php

namespace App\Http\Controllers;

use App\Models\CodigoAcceso;
use App\Models\Ingreso;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Entrada asistida: el usuario genera un QR/PIN desde la web y porteria lo
// escanea o digita en el movil. La Entrada se registra a nombre del usuario
// que genero el codigo, nunca del admin que lo valida.
class AccesoCodigoController extends Controller
{
    private function hoyBogota(): string
    {
        return Carbon::now('America/Bogota')->toDateString();
    }

    private function tieneEntradaHoy(int $idUsuario): bool
    {
        return Ingreso::where('fk_id_user', $idUsuario)
            ->where('ingreso_type', 'Entrada')
            ->whereDate('ingreso_datetime', $this->hoyBogota())
            ->exists();
    }

    public function generar(Request $request)
    {
        $user = $request->user();

        if ($this->tieneEntradaHoy($user->id_usuario)) {
            return response()->json(['message' => 'Ya tienes una entrada registrada hoy.'], 422);
        }

        // Un solo codigo vigente por usuario: al generar otro, el anterior muere.
        CodigoAcceso::where('fk_id_usuario', $user->id_usuario)
            ->whereNull('usado_en')
            ->delete();

        $token = Str::random(64);
        $pin = null;

        for ($i = 0; $i < 20; $i++) {
            $candidato = (string) random_int(100000, 999999);
            $ocupado = CodigoAcceso::where('pin', $candidato)
                ->whereNull('usado_en')
                ->where('expira_en', '>', Carbon::now())
                ->exists();

            if (!$ocupado) {
                $pin = $candidato;
                break;
            }
        }

        if (!$pin) {
            return response()->json(['message' => 'No se pudo generar el PIN. Intenta de nuevo.'], 500);
        }

        $codigo = CodigoAcceso::create([
            'fk_id_usuario' => $user->id_usuario,
            'token' => $token,
            'pin' => $pin,
            'tipo' => 'entrada',
            'expira_en' => Carbon::now()->addMinutes(5),
        ]);

        return response()->json([
            'message' => 'Código generado. Preséntalo en portería.',
            'token' => $codigo->token,
            'pin' => $codigo->pin,
            'qr_payload' => 'SENA-ACCESO:' . $codigo->token,
            'expira_en' => $codigo->expira_en->toIso8601String(),
        ], 201);
    }

    public function validarCodigo(Request $request)
    {
        $data = $request->validate([
            'codigo' => 'nullable|string|max:200',
            'pin' => 'nullable|string|max:10',
        ]);

        $texto = trim((string) ($data['codigo'] ?? ''));
        $pin = trim((string) ($data['pin'] ?? ''));

        if ($texto === '' && $pin === '') {
            return response()->json(['message' => 'Escanea el QR o escribe el PIN.'], 422);
        }

        if ($texto !== '' && str_starts_with($texto, 'SENA-ACCESO:')) {
            $texto = substr($texto, strlen('SENA-ACCESO:'));
        }

        $consulta = CodigoAcceso::whereNull('usado_en')
            ->where('expira_en', '>', Carbon::now());

        if ($texto !== '') {
            $consulta->where('token', $texto);
        } else {
            $consulta->where('pin', $pin);
        }

        $codigo = $consulta->with('user.role')->first();

        if (!$codigo) {
            return response()->json(['message' => 'Código inválido, vencido o ya utilizado.'], 422);
        }

        $user = $codigo->user;
        if (!$user) {
            return response()->json(['message' => 'El usuario del código ya no existe.'], 422);
        }

        if ($this->tieneEntradaHoy($user->id_usuario)) {
            return response()->json(['message' => 'Ese usuario ya tiene una entrada registrada hoy.'], 422);
        }

        $ingreso = DB::transaction(function () use ($codigo, $user) {
            $codigo->update(['usado_en' => Carbon::now()]);

            return Ingreso::create([
                'ingreso_datetime' => Carbon::now('America/Bogota'),
                'ingreso_place' => 'CCyS',
                'ingreso_type' => 'Entrada',
                'fk_id_user' => $user->id_usuario,
            ]);
        });

        $nombre = trim(($user->user_name ?? '') . ' ' . ($user->user_lastname ?? ''));

        return response()->json([
            'message' => 'Entrada registrada para ' . ($nombre ?: 'el usuario') . '.',
            'usuario' => [
                'id_usuario' => $user->id_usuario,
                'nombre' => $nombre,
                'rol' => $user->role->rol_name ?? null,
                'identificacion' => $user->user_identification,
            ],
            'ingreso' => $ingreso,
        ], 201);
    }
}
