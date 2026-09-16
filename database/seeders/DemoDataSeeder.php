<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Ambiente;
use App\Models\Ingreso;
use App\Models\User;
use Illuminate\Support\Carbon;

// Datos de demostración realistas para la app móvil (idempotente):
// ambientes por sede, asignación de instructores/aprendices y registros de
// ingresos del día de hoy (Bogotá) para que la vista Presentes se vea viva.
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // Ambientes de prueba: (nombre, sede, jornada, inicio, fin, capacidad).
        $ambientes = [
            ['CCyS 101', 'Centro Comercio y Servicios', 'Mañana', '07:00', '12:00', 30],
            ['CCyS 102', 'Centro Comercio y Servicios', 'Mañana', '07:00', '12:00', 30],
            ['CCyS 103', 'Centro Comercio y Servicios', 'Tarde', '13:00', '18:00', 28],
            ['Ciudad Jardín 201', 'Ciudad Jardín', 'Tarde', '13:00', '18:00', 25],
            ['Ciudad Jardín 202', 'Ciudad Jardín', 'Mañana', '07:00', '12:00', 25],
            ['Aulas 301', 'Bloque de Aulas', 'Tarde', '13:00', '18:00', 35],
            ['Aulas 302', 'Bloque de Aulas', 'Mañana', '07:00', '12:00', 35],
        ];

        $ids = [];
        foreach ($ambientes as $a) {
            $amb = Ambiente::firstOrCreate(
                ['ambiente_nombre' => $a[0]],
                [
                    'ambiente_ubicacion' => $a[1],
                    'ambiente_jornada' => $a[2],
                    'hora_inicio' => $a[3],
                    'hora_fin' => $a[4],
                    'ambiente_capacidad' => $a[5],
                    'ambiente_estado' => 'Activo',
                    'radio_m' => 30,
                ]
            );
            $ids[$a[0]] = $amb->id_ambiente;
        }

        // Correos de usuarios ya creados por DatabaseSeeder la primera vez.
        $correos = [
            'juan.pablo@sena.edu.co' => 'instr', 'alejandro@sena.edu.co' => 'instr',
            'gustavo@sena.edu.co' => 'instr', 'raul@sena.edu.co' => 'instr',
            'andres.vargas@sena.edu.co' => 'apr', 'laura.medina@sena.edu.co' => 'apr',
            'sebastian@sena.edu.co' => 'apr', 'camilo@sena.edu.co' => 'apr',
            'katherin@sena.edu.co' => 'apr',
        ];
        $usuarios = [];
        foreach ($correos as $email => $_) {
            $usuarios[$email] = User::where('user_email', $email)->first();
        }

        if (count(array_filter($usuarios)) !== count($correos)) {
            throw new \RuntimeException('Faltan usuarios base; ejecuta primero DatabaseSeeder (php artisan db:seed).');
        }

        // Asignaciones de instructores a ambientes.
        $instrAmbiente = [
            'CCyS 101' => ['juan.pablo@sena.edu.co'],
            'CCyS 102' => ['alejandro@sena.edu.co'],
            'CCyS 103' => ['gustavo@sena.edu.co'],
            'Ciudad Jardín 201' => ['raul@sena.edu.co'],
            'Ciudad Jardín 202' => ['juan.pablo@sena.edu.co'],
            'Aulas 301' => ['alejandro@sena.edu.co'],
            'Aulas 302' => ['gustavo@sena.edu.co'],
        ];
        foreach ($instrAmbiente as $nombre => $emails) {
            $amb = Ambiente::find($ids[$nombre]);
            $amb->instructores()->sync(
                array_map(fn ($e) => $usuarios[$e]->id_usuario, $emails)
            );
        }

        // Asignaciones de aprendices a ambientes.
        $aprAmbiente = [
            'CCyS 101' => ['andres.vargas@sena.edu.co', 'laura.medina@sena.edu.co'],
            'CCyS 102' => ['sebastian@sena.edu.co'],
            'CCyS 103' => ['camilo@sena.edu.co', 'katherin@sena.edu.co'],
            'Ciudad Jardín 201' => ['andres.vargas@sena.edu.co', 'camilo@sena.edu.co'],
            'Ciudad Jardín 202' => ['laura.medina@sena.edu.co'],
            'Aulas 301' => ['katherin@sena.edu.co'],
            'Aulas 302' => ['sebastian@sena.edu.co', 'camilo@sena.edu.co'],
        ];
        foreach ($aprAmbiente as $nombre => $emails) {
            $amb = Ambiente::find($ids[$nombre]);
            $amb->aprendices()->sync(
                array_map(fn ($e) => $usuarios[$e]->id_usuario, $emails)
            );
        }

        // Solo tocar registros de hoy: si ya hay ingresos de hoy de estos usuarios
        // se recrean (idempotente sobre los datos demo, no sobre registros reales).
        $emaillist = array_keys($correos);
        $hoy = Carbon::today('America/Bogota');
        $demoIds = array_map(fn ($e) => $usuarios[$e]->id_usuario, $emaillist);
        Ingreso::whereIn('fk_id_user', $demoIds)
            ->whereDate('ingreso_datetime', $hoy->toDateString())
            ->delete();

        // Timeline de hoy para cada usuario demo: [hora, tipo, ambiente, ...].
        $timeline = [
            'andres.vargas@sena.edu.co' => [
                '07:50', 'Entrada', 'CCyS 101', '12:05', 'Salida', 'CCyS 101', '13:20', 'Entrada', 'CCyS 101',
            ],
            'laura.medina@sena.edu.co' => [
                '07:45', 'Entrada', 'CCyS 101', '12:10', 'Salida', 'CCyS 101', '13:15', 'Entrada', 'CCyS 101',
            ],
            'sebastian@sena.edu.co' => [
                '07:55', 'Entrada', 'CCyS 102', '11:50', 'Salida', 'CCyS 102',
            ],
            'camilo@sena.edu.co' => [
                '13:10', 'Entrada', 'Ciudad Jardín 201', '15:00', 'Salida', 'Ciudad Jardín 201',
            ],
            'katherin@sena.edu.co' => [
                '13:00', 'Entrada', 'Aulas 301', '15:30', 'Salida', 'Aulas 301',
            ],
            'juan.pablo@sena.edu.co' => [
                '07:40', 'Entrada', 'CCyS 101', '12:15', 'Salida', 'CCyS 101', '13:00', 'Entrada', 'Aulas 302',
            ],
            'gustavo@sena.edu.co' => [
                '07:30', 'Entrada', 'CCyS 103', '12:00', 'Salida', 'CCyS 103',
            ],
            'alejandro@sena.edu.co' => [
                '07:35', 'Entrada', 'CCyS 102', '11:45', 'Salida', 'CCyS 102', '13:10', 'Entrada', 'Aulas 301',
            ],
            'raul@sena.edu.co' => [
                '13:20', 'Entrada', 'Ciudad Jardín 201',
            ],
        ];

        foreach ($timeline as $email => $filas) {
            for ($i = 0; $i < count($filas); $i += 3) {
                [$hora, $tipo, $ambiente] = [$filas[$i], $filas[$i + 1], $filas[$i + 2]];
                Ingreso::create([
                    'ingreso_datetime' => $hoy->copy()->setTimeFromTimeString($hora),
                    'ingreso_place' => $ambiente,
                    'ingreso_type' => $tipo,
                    'fk_id_user' => $usuarios[$email]->id_usuario,
                ]);
            }
        }

        $this->command->info('DemoDataSeeder: ambientes/asignaciones/ingresos de hoy listos.');
    }
}