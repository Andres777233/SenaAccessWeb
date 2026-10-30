<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rol Funcionario: personal administrativo del centro (no aprendiz ni
 * instructor). Entra y sale con el QR de portería, tiene carnet digital y
 * equipos corporativos asignados; no maneja ficha de formación ni excusas.
 *
 * Idempotente: el releaseCommand corre `migrate --seed` en cada deploy y el
 * seeder también lo crea.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!DB::table('roles')->where('rol_name', 'Funcionario')->exists()) {
            DB::table('roles')->insert([
                'rol_name' => 'Funcionario',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $id = DB::table('roles')->where('rol_name', 'Funcionario')->value('id_rol');
        if (!$id) {
            return;
        }
        // No se borra si hay cuentas usándolo: dejaría usuarios sin rol.
        if (DB::table('usuarios')->where('fk_id_rol', $id)->exists()) {
            return;
        }
        DB::table('roles')->where('id_rol', $id)->delete();
    }
};
