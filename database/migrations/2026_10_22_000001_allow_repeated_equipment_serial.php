<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Un equipo devuelto se puede volver a prestar: el serial deja de ser unico
// en toda la tabla y solo se controla que no haya otro prestamo activo.
return new class extends Migration
{
    private const INDICE = 'ingreso_equipos_equipo_serial_unique';

    private function indiceExiste(): bool
    {
        $conn = Schema::getConnection();
        $driver = $conn->getDriverName();

        if ($driver === 'mysql') {
            $fila = $conn->selectOne(
                "SELECT COUNT(*) AS c FROM information_schema.statistics
                 WHERE table_schema = DATABASE()
                   AND table_name = 'ingreso_equipos'
                   AND index_name = ?",
                [self::INDICE]
            );

            return $fila && (int) $fila->c > 0;
        }

        if ($driver === 'sqlite') {
            foreach ($conn->select("PRAGMA index_list('ingreso_equipos')") as $indice) {
                if (($indice->name ?? '') === self::INDICE) {
                    return true;
                }
            }
        }

        return false;
    }

    public function up(): void
    {
        if (Schema::hasTable('ingreso_equipos') && $this->indiceExiste()) {
            Schema::table('ingreso_equipos', function (Blueprint $table) {
                $table->dropUnique(['equipo_serial']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ingreso_equipos') && !$this->indiceExiste()) {
            Schema::table('ingreso_equipos', function (Blueprint $table) {
                $table->unique('equipo_serial');
            });
        }
    }
};
