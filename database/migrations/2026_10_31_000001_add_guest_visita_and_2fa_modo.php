<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Visitas de invitado con plazo de 6 horas y QR de salida propio, y modo de
 * verificación en dos pasos por cuenta.
 *
 * - guest_entrada_at / guest_salida_at: marcas reales de la visita.
 * - guest_exit_token: QR que se genera al registrar la entrada y que portería
 *   escanea para marcar la salida.
 * - two_factor_modo: 'siempre' (pide código en cada inicio de sesión) o
 *   'dispositivo' (solo en teléfonos/navegadores nuevos, comportamiento viejo).
 *
 * Idempotente: el releaseCommand corre migrate en cada deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            if (!Schema::hasColumn('usuarios', 'guest_entrada_at')) {
                $table->timestamp('guest_entrada_at')->nullable();
            }
            if (!Schema::hasColumn('usuarios', 'guest_salida_at')) {
                $table->timestamp('guest_salida_at')->nullable();
            }
            if (!Schema::hasColumn('usuarios', 'guest_exit_token')) {
                $table->string('guest_exit_token', 64)->nullable();
            }
            if (!Schema::hasColumn('usuarios', 'guest_exit_expires_at')) {
                $table->timestamp('guest_exit_expires_at')->nullable();
            }
            if (!Schema::hasColumn('usuarios', 'guest_exit_used')) {
                $table->boolean('guest_exit_used')->default(false);
            }
            if (!Schema::hasColumn('usuarios', 'two_factor_modo')) {
                $table->string('two_factor_modo', 20)->default('dispositivo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            foreach ([
                'guest_entrada_at',
                'guest_salida_at',
                'guest_exit_token',
                'guest_exit_expires_at',
                'guest_exit_used',
                'two_factor_modo',
            ] as $columna) {
                if (Schema::hasColumn('usuarios', $columna)) {
                    $table->dropColumn($columna);
                }
            }
        });
    }
};
