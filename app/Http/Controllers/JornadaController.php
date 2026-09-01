<?php

namespace App\Http\Controllers;

use App\Models\Ambiente;
use Illuminate\Http\Request;

class JornadaController extends Controller
{
    private function base32Decode(string $b32): ?string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $b32 = strtoupper(str_replace(['=', ' ', "\n", "\r"], '', $b32));
        if ($b32 === '') return null;
        $bits = '';
        for ($i = 0; $i < strlen($b32); $i++) {
            $pos = strpos($alphabet, $b32[$i]);
            if ($pos === false) return null;
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
            $out .= chr(bindec(substr($bits, $i, 8)));
        }
        return $out;
    }

    private function totp(string $secretBase32, int $period = 30, int $digits = 6, ?int $time = null): ?string
    {
        $key = $this->base32Decode($secretBase32);
        if ($key === null) return null;
        $time = $time ?? time();
        $counter = intdiv($time, $period);
        $data = pack('J', $counter);
        $hash = hash_hmac('sha1', $data, $key, true);
        $offset = ord($hash[19]) & 0x0f;
        $binary = ((ord($hash[$offset]) & 0x7f) << 24) | ((ord($hash[$offset + 1]) & 0xff) << 16) | ((ord($hash[$offset + 2]) & 0xff) << 8) | (ord($hash[$offset + 3]) & 0xff);
        $otp = $binary % (10 ** $digits);
        return str_pad((string) $otp, $digits, '0', STR_PAD_LEFT);
    }

    public function qr(Request $request, $ambienteId)
    {
        $ambiente = Ambiente::findOrFail($ambienteId);
        // Validar que instructor/admin tenga acceso o que el aprendiz esté en el ambiente?
        // Para proyección el instructor debe estar asignado; admin siempre.
        $user = $request->user();
        $isAdmin = $user->role && $user->role->rol_name === 'admin';
        if (!$isAdmin) {
            $esInstructor = $ambiente->instructores()->where('fk_id_instructor', $user->id_usuario)->exists();
            if (!$esInstructor) {
                return response()->json(['message' => 'No autorizado para este ambiente'], 403);
            }
        }
        $period = 30;
        $secret = $ambiente->totp_secret;
        if (!$secret) {
            $secret = Ambiente::generarSecreto();
            $ambiente->update(['totp_secret' => $secret]);
        }
        $code = $this->totp($secret, $period);
        $expira = $period - (time() % $period);
        $content = "SENA-JORNADA:{$ambiente->id_ambiente}:{$code}:{$period}";
        return response()->json([
            'code' => $code,
            'qr_content' => $content,
            'ambiente_id' => $ambiente->id_ambiente,
            'ambiente_nombre' => $ambiente->ambiente_nombre,
            'expira_en' => now()->addSeconds($expira)->toIso8601String(),
            'periodo_s' => $period,
        ]);
    }

    public function qrActual(Request $request)
    {
        $user = $request->user();
        $ambienteId = $request->query('ambiente_id');
        if ($ambienteId) {
            return $this->qr($request, $ambienteId);
        }
        // Si no se indica, intenta resolver el primer ambiente del instructor
        $ambiente = null;
        if ($user->role && $user->role->rol_name === 'Instructor') {
            $ambiente = Ambiente::whereHas('instructores', fn($q) => $q->where('fk_id_instructor', $user->id_usuario))->first();
        }
        if (!$ambiente) {
            $ambiente = Ambiente::first();
        }
        if (!$ambiente) {
            return response()->json(['message' => 'No hay ambientes configurados'], 404);
        }
        return $this->qr($request, $ambiente->id_ambiente);
    }
}
