<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create Roles
        $adminRole = Role::firstOrCreate(['rol_name' => 'admin']);
        $instructorRole = Role::firstOrCreate(['rol_name' => 'Instructor']);
        $aprendizRole = Role::firstOrCreate(['rol_name' => 'Aprendiz']);
        Role::firstOrCreate(['rol_name' => 'Invitado']);

        // Credenciales de prueba documentadas en AGENTS.md (password: 12345678)
        // 6 cuentas para login con password: 123456 (instructores + aprendices)
        $clave123456 = [
            'alejandro@sena.edu.co',
            'raul@sena.edu.co',
            'gustavo@sena.edu.co',
            'katherin@sena.edu.co',
            'sebastian@sena.edu.co',
            'camilo@sena.edu.co',
        ];

        $users = [
            [
                'user_identification' => '0000000001',
                'user_name' => 'Admin',
                'user_lastname' => 'System',
                'user_email' => 'admin@sena.edu.co',
                'user_coursenumber' => 0,
                'user_program' => 'Administración',
                'fk_id_rol' => $adminRole->id_rol,
            ],
            // Aprendices adicionales
            [
                'user_identification' => '1000000001',
                'user_name' => 'Andres',
                'user_lastname' => 'Vargas',
                'user_email' => 'andres.vargas@sena.edu.co',
                'user_coursenumber' => 2675891,
                'user_program' => 'Análisis y Desarrollo de Software',
                'fk_id_rol' => $aprendizRole->id_rol,
            ],
            [
                'user_identification' => '1000000002',
                'user_name' => 'Laura',
                'user_lastname' => 'Medina',
                'user_email' => 'laura.medina@sena.edu.co',
                'user_coursenumber' => 2675891,
                'user_program' => 'Análisis y Desarrollo de Software',
                'fk_id_rol' => $aprendizRole->id_rol,
            ],
            [
                'user_identification' => '1000000003',
                'user_name' => 'Sebastian',
                'user_lastname' => 'Arcos',
                'user_email' => 'sebastian@sena.edu.co',
                'user_coursenumber' => 2675891,
                'user_program' => 'Análisis y Desarrollo de Software',
                'fk_id_rol' => $aprendizRole->id_rol,
            ],
            [
                'user_identification' => '1000000004',
                'user_name' => 'Camilo',
                'user_lastname' => 'Montegranario',
                'user_email' => 'camilo@sena.edu.co',
                'user_coursenumber' => 2675891,
                'user_program' => 'Análisis y Desarrollo de Software',
                'fk_id_rol' => $aprendizRole->id_rol,
            ],
            [
                'user_identification' => '1000000005',
                'user_name' => 'Katherin',
                'user_lastname' => 'Fernandeza',
                'user_email' => 'katherin@sena.edu.co',
                'user_coursenumber' => 2675891,
                'user_program' => 'Análisis y Desarrollo de Software',
                'fk_id_rol' => $aprendizRole->id_rol,
            ],
            // Instructores adicionales
            [
                'user_identification' => '1000000006',
                'user_name' => 'Juan',
                'user_lastname' => 'Pablo',
                'user_email' => 'juan.pablo@sena.edu.co',
                'user_coursenumber' => 0,
                'user_program' => 'Formación',
                'fk_id_rol' => $instructorRole->id_rol,
            ],
            [
                'user_identification' => '1000000007',
                'user_name' => 'Alejandro',
                'user_lastname' => 'Sena',
                'user_email' => 'alejandro@sena.edu.co',
                'user_coursenumber' => 0,
                'user_program' => 'Formación',
                'fk_id_rol' => $instructorRole->id_rol,
            ],
            [
                'user_identification' => '1000000008',
                'user_name' => 'Gustavo',
                'user_lastname' => 'Sena',
                'user_email' => 'gustavo@sena.edu.co',
                'user_coursenumber' => 0,
                'user_program' => 'Formación',
                'fk_id_rol' => $instructorRole->id_rol,
            ],
            [
                'user_identification' => '1000000009',
                'user_name' => 'Raul',
                'user_lastname' => 'Sena',
                'user_email' => 'raul@sena.edu.co',
                'user_coursenumber' => 0,
                'user_program' => 'Formación',
                'fk_id_rol' => $instructorRole->id_rol,
            ],
        ];

        foreach ($users as $data) {
            $password = in_array($data['user_email'], $clave123456, true) ? '123456' : '12345678';
            User::updateOrCreate(
                ['user_email' => $data['user_email']],
                $data + ['user_password' => Hash::make($password)]
            );
        }
    }
}
