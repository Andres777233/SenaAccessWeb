<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Las cuentas creadas por /register-guest se guardaban con el rol Aprendiz:
// aparecían como estudiantes, con ficha/programa vacíos, y no en Invitados.
// Se reclasifican las existentes y el alta nueva ya usa el rol Invitado.
return new class extends Migration
{
    public function up(): void
    {
        $invitado = DB::table('roles')->where('rol_name', 'Invitado')->value('id_rol');
        if (!$invitado) {
            return;
        }

        DB::table('usuarios')
            ->where(function ($query) {
                $query->where('user_email', 'like', 'guest_%')
                    ->orWhereNotNull('guest_qr_token');
            })
            ->update(['fk_id_rol' => $invitado]);
    }

    public function down(): void
    {
        $aprendiz = DB::table('roles')->where('rol_name', 'Aprendiz')->value('id_rol');
        if (!$aprendiz) {
            return;
        }

        DB::table('usuarios')
            ->where(function ($query) {
                $query->where('user_email', 'like', 'guest_%')
                    ->orWhereNotNull('guest_qr_token');
            })
            ->update(['fk_id_rol' => $aprendiz]);
    }
};
