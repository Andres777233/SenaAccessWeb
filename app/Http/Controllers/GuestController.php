<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Visitas de invitado: entrada con QR de un solo uso, plazo de 6 horas y un
 * segundo QR (generado al registrar la entrada) que portería escanea para
 * marcar la salida. El invitado solo ve el QR: no tiene panel ni historial.
 *
 * El QR de entrada caduca a las 6 horas de haberse generado y el de salida
 * vence en ese mismo plazo. Si la visita no registra salida, el sistema la
 * cierra automáticamente al vencer el plazo (así nadie queda "dentro" para
 * siempre en presentes).
 */
class GuestController extends Controller
{
    // Vigencia de la visita (entrada y salida comparten el mismo plazo).
    public const HORAS_VIGENCIA = 6;

    // Registra movimiento en el historial de ingresos.
    private function movimiento(User $invitado, string $tipo, string $lugar = 'CCyS'): Ingreso
    {
        return Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => $lugar,
            'ingreso_type' => $tipo,
            'fk_id_user' => $invitado->id_usuario,
        ]);
    }

    // Payload público de la visita: lo consulta la pantalla del invitado
    // (web y móvil) para cambiar sola del QR de entrada al de salida.
    private function estadoVisita(User $invitado): array
    {
        $ahora = Carbon::now();
        $limite = $invitado->guest_qr_expires_at;

        // Visita sin salida y con el plazo vencido: se cierra automáticamente.
        if ($invitado->guest_entrada_at && !$invitado->guest_salida_at && $limite && $limite->lt($ahora)) {
            $this->movimiento($invitado, 'Salida', 'Salida automática (plazo ' . self::HORAS_VIGENCIA . ' h)');
            $invitado->guest_salida_at = $limite;
            $invitado->guest_exit_used = true;
            $invitado->save();
        }

        $estado = 'pendiente';
        if ($invitado->guest_salida_at) {
            $estado = 'salida';
        } elseif ($invitado->guest_qr_used && $invitado->guest_entrada_at) {
            $estado = 'dentro';
        } elseif ($limite && $limite->lt($ahora)) {
            $estado = 'expirado';
        }

        return [
            'estado' => $estado,
            'nombre' => trim(($invitado->user_name ?? '') . ' ' . ($invitado->user_lastname ?? '')),
            'qr_token' => $invitado->guest_qr_token,
            'qr_expires_at' => $invitado->guest_qr_expires_at?->toIso8601String(),
            'qr_salida' => $invitado->guest_exit_used ? null : $invitado->guest_exit_token,
            'qr_salida_expires_at' => $invitado->guest_exit_expires_at?->toIso8601String(),
            'entrada_at' => $invitado->guest_entrada_at?->toIso8601String(),
            'salida_at' => $invitado->guest_salida_at?->toIso8601String(),
            'horas_vigencia' => self::HORAS_VIGENCIA,
        ];
    }

    // GET /api/guest/estado/{qrToken}: público (el invitado no tiene sesión).
    public function estado(string $qrToken)
    {
        $invitado = User::where('guest_qr_token', $qrToken)
            ->orWhere('guest_exit_token', $qrToken)
            ->first();

        if (!$invitado) {
            return response()->json(['message' => 'Visita no encontrada.'], 404);
        }

        return response()->json($this->estadoVisita($invitado));
    }

    // Registra la ENTRADA del invitado (portería/admin) y genera su QR de salida.
    public function validarEntrada(Request $request)
    {
        $data = $request->validate(['qr_token' => 'required|string|max:64']);

        $invitado = User::where('guest_qr_token', $data['qr_token'])->first();
        if (!$invitado) {
            return response()->json(['message' => 'Código de invitado no válido.'], 404);
        }
        if ($invitado->guest_qr_used) {
            return response()->json(['message' => 'Este QR de entrada ya fue utilizado.', 'duplicado' => true], 422);
        }
        if ($invitado->guest_qr_expires_at && $invitado->guest_qr_expires_at->lt(Carbon::now())) {
            return response()->json(['message' => 'Este QR caducó. Genera uno nuevo.'], 422);
        }

        $invitado->guest_qr_used = true;
        $invitado->guest_entrada_at = Carbon::now();
        // El QR de salida sirve hasta el mismo plazo de la visita.
        $invitado->guest_exit_token = Str::random(64);
        $invitado->guest_exit_expires_at = $invitado->guest_qr_expires_at
            ?? Carbon::now()->addHours(self::HORAS_VIGENCIA);
        $invitado->guest_exit_used = false;
        $invitado->save();

        $this->movimiento($invitado, 'Entrada');

        return response()->json([
            'message' => 'Entrada registrada. El invitado ya tiene su QR de salida.',
            'user' => $invitado->makeHidden(['guest_qr_token', 'guest_exit_token']),
            'qr_salida' => $invitado->guest_exit_token,
            'qr_salida_expires_at' => $invitado->guest_exit_expires_at?->toIso8601String(),
            'estado' => $this->estadoVisita($invitado->fresh()),
        ], 200);
    }

    // Registra la SALIDA del invitado escaneando el QR que se generó al entrar.
    public function validarSalida(Request $request)
    {
        $data = $request->validate(['qr_token' => 'required|string|max:64']);

        $invitado = User::where('guest_exit_token', $data['qr_token'])->first();
        if (!$invitado) {
            return response()->json(['message' => 'Ese código no es un QR de salida de invitado.'], 404);
        }
        if ($invitado->guest_exit_used || $invitado->guest_salida_at) {
            return response()->json(['message' => 'La salida de este invitado ya fue registrada.', 'duplicado' => true], 422);
        }
        if ($invitado->guest_exit_expires_at && $invitado->guest_exit_expires_at->lt(Carbon::now())) {
            // Plazo cumplido: se cierra la visita y se avisa que ya venció.
            $this->estadoVisita($invitado);
            return response()->json(['message' => 'El plazo de la visita venció. La salida quedó registrada automáticamente.'], 422);
        }

        $invitado->guest_exit_used = true;
        $invitado->guest_salida_at = Carbon::now();
        $invitado->save();

        $this->movimiento($invitado, 'Salida');

        return response()->json([
            'message' => 'Salida registrada. ¡Hasta pronto!',
            'estado' => $this->estadoVisita($invitado->fresh()),
        ], 200);
    }

    // Un solo escáner en portería: detecta si el código es de entrada o salida.
    public function validar(Request $request)
    {
        $token = (string) $request->input('qr_token', '');

        if (User::where('guest_exit_token', $token)->exists()) {
            return $this->validarSalida($request);
        }

        return $this->validarEntrada($request);
    }
}
