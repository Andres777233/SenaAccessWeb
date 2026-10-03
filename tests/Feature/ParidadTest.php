<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Paridad móvil/WEB: contratos que la app Android espera del backend.
// Sin RefreshDatabase (phpunit.xml no configura BD de test): usa la BD local
// de forma no destructiva (emails/identificaciones únicos test+...) y borra
// todo rastro en tearDown. Si no hay BD, cada test se marca como skipped.
class ParidadTest extends TestCase
{
    private array $uidsCreados = [];

    protected function setUp(): void
    {
        parent::setUp();
        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Sin BD local disponible: ' . $e->getMessage());
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->uidsCreados as $uid) {
            DB::table('personal_access_tokens')->where('tokenable_id', $uid)->delete();
            DB::table('two_factor_challenges')->where('fk_id_usuario', $uid)->delete();
            DB::table('ingreso_equipos')->where('fk_id_usuario', $uid)->delete();
            DB::table('ingresos')->where('fk_id_user', $uid)->delete();
            DB::table('notificaciones')->where('fk_id_usuario', $uid)->delete();
            DB::table('usuarios')->where('id_usuario', $uid)->delete();
        }
        $this->uidsCreados = [];
        parent::tearDown();
    }

    private function crearUsuario(string $rol, array $extra = []): User
    {
        $uniq = uniqid();
        $user = User::create(array_merge([
            'user_identification' => 'PAR' . substr($uniq, -10),
            'user_name' => 'Paridad',
            'user_lastname' => 'Test',
            'user_email' => 'paridad+' . $uniq . '@gmail.com',
            'user_password' => Hash::make('Clave1234'),
            'user_documento_tipo' => 'CC',
            'fk_id_rol' => Role::where('rol_name', $rol)->value('id_rol'),
        ], $extra));
        $this->uidsCreados[] = $user->id_usuario;
        return $user->fresh();
    }

    public function test_login_ok_emite_token(): void
    {
        $user = $this->crearUsuario('Aprendiz', ['two_factor_enabled' => false]);

        $r = $this->postJson('/api/login', [
            'user_email' => $user->user_email,
            'user_password' => 'Clave1234',
        ]);

        $r->assertOk()
            ->assertJsonPath('user.user_email', $user->user_email)
            ->assertJsonStructure(['access_token', 'token_type', 'role']);
        $this->assertArrayNotHasKey('two_factor_required', $r->json());
    }

    public function test_login_device_desconocido_con_2fa_no_emite_token(): void
    {
        $user = $this->crearUsuario('Aprendiz', [
            'two_factor_enabled' => true,
            'trusted_device_id' => 'device-original',
        ]);

        $r = $this->postJson('/api/login', [
            'user_email' => $user->user_email,
            'user_password' => 'Clave1234',
            'device_id' => 'device-nuevo-desconocido',
        ]);

        $r->assertOk()->assertJsonPath('two_factor_required', true);
        $r->assertJsonStructure(['two_factor_id']);
        $this->assertArrayNotHasKey('access_token', $r->json());
    }

    public function test_validar_codigo_con_code_corto_da_422(): void
    {
        $r = $this->postJson('/api/2fa/validar-codigo', [
            'challenge_id' => 'no-existe',
            'code' => '123',
        ]);

        $r->assertStatus(422)->assertJsonValidationErrors(['code']);
    }

    public function test_aprendiz_no_puede_crear_ambientes(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));

        $this->postJson('/api/admin/ambientes', ['ambiente_nombre' => 'X'])
            ->assertStatus(403);
    }

    public function test_aprendiz_no_puede_crear_excusas(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));

        $this->postJson('/api/instructor/excusas', [
            'fk_id_aprendiz' => 1,
            'fk_id_ambiente' => 1,
            'motivo' => 'Prueba',
        ])->assertStatus(403);
    }

    public function test_presentes_solo_admin(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));
        $this->getJson('/api/admin/presentes')->assertStatus(403);

        Sanctum::actingAs($this->crearUsuario('Instructor'));
        $this->getJson('/api/admin/presentes')->assertStatus(403);

        Sanctum::actingAs($this->crearUsuario('admin'));
        $r = $this->getJson('/api/admin/presentes');
        $r->assertOk();
        $this->assertIsArray($r->json());
        foreach ($r->json() as $fila) {
            $this->assertArrayHasKey('id_usuario', $fila);
            $this->assertArrayHasKey('ambiente', $fila);
        }
    }

    public function test_instructor_no_puede_crear_usuarios(): void
    {
        Sanctum::actingAs($this->crearUsuario('Instructor'));

        $this->postJson('/api/admin/users', ['user_name' => 'X'])
            ->assertStatus(403);
    }

    public function test_aprendiz_no_puede_devolver_ni_borrar_equipos(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));

        $this->postJson('/api/admin/equipment/999999/return')->assertStatus(403);
        $this->deleteJson('/api/admin/equipment/999999')->assertStatus(403);
    }

    public function test_register_guest_ok_y_validate_con_token_falso(): void
    {
        $doc = 'GUEST' . substr(uniqid(), -8);
        $r = $this->postJson('/api/register-guest', [
            'user_identification' => $doc,
            'user_name' => 'Visita',
            'user_lastname' => 'Prueba',
        ]);

        $r->assertStatus(201)->assertJsonStructure(['qr_token', 'qr_expires_at']);
        $this->uidsCreados[] = $r->json('user.id_usuario');

        $this->postJson('/api/validate-guest-qr', ['qr_token' => 'token-falso-inexistente'])
            ->assertStatus(404);
    }

    public function test_health_devuelve_200(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_usuario_ajeno_no_puede_aprobar_reto(): void
    {
        $dueno = $this->crearUsuario('Aprendiz', ['two_factor_enabled' => true]);
        $ajeno = $this->crearUsuario('Aprendiz');

        Sanctum::actingAs($dueno);
        $login = $this->postJson('/api/login', [
            'user_email' => $dueno->user_email,
            'user_password' => 'Clave1234',
            'device_id' => 'pentest-device-nuevo',
        ]);
        $login->assertOk()->assertJsonPath('two_factor_required', true);
        $cid = $login->json('two_factor_id');
        $this->assertNotEmpty($cid);

        Sanctum::actingAs($ajeno);
        $this->postJson('/api/2fa/aprobar', ['challenge_id' => $cid, 'decision' => 'aprobar'])
            ->assertStatus(403);

        Sanctum::actingAs($dueno);
        $this->postJson('/api/2fa/aprobar', ['challenge_id' => $cid, 'decision' => 'quizas'])
            ->assertStatus(422);

        $this->postJson('/api/2fa/aprobar', ['challenge_id' => $cid, 'decision' => 'aprobar'])
            ->assertOk();

        $this->postJson('/api/2fa/aprobar', ['challenge_id' => $cid, 'decision' => 'aprobar'])
            ->assertStatus(400);

        $this->postJson('/api/2fa/validar-codigo', ['challenge_id' => $cid, 'code' => '000000'])
            ->assertStatus(400);

        $this->postJson('/api/2fa/desactivar', [])->assertStatus(422);
    }

    public function test_pin_excusa_un_solo_uso_y_formato(): void
    {
        $instructor = $this->crearUsuario('Instructor');
        $aprendiz = $this->crearUsuario('Aprendiz');
        $ambiente = \App\Models\Ambiente::create(['ambiente_nombre' => 'Pentest ' . uniqid()]);
        $ambiente->instructores()->sync([$instructor->id_usuario]);

        try {
            Sanctum::actingAs($instructor);
            $creada = $this->postJson('/api/instructor/excusas', [
                'fk_id_aprendiz' => $aprendiz->id_usuario,
                'fk_id_ambiente' => $ambiente->id_ambiente,
                'motivo' => 'Pentest pin',
            ]);
            $creada->assertStatus(201);
            $pin = $creada->json('pin');
            $this->assertNotEmpty($pin);

            $this->postJson('/api/excusas/validar', ['pin' => $pin])->assertOk();
            $this->postJson('/api/excusas/validar', ['pin' => $pin])
                ->assertStatus(400)->assertJsonPath('message', 'PIN ya utilizado.');
            $this->postJson('/api/excusas/validar', ['pin' => 'abcd'])
                ->assertStatus(400)->assertJsonPath('message', 'PIN inválido.');
        } finally {
            \App\Models\Excusa::where('fk_id_instructor', $instructor->id_usuario)->delete();
            $ambiente->instructores()->detach();
            $ambiente->delete();
        }
    }

    public function test_my_profile_no_permite_escalar_rol(): void
    {
        $user = $this->crearUsuario('Aprendiz');
        Sanctum::actingAs($user);

        $r = $this->putJson('/api/my-profile', [
            'user_identification' => $user->user_identification,
            'user_name' => 'Paridad',
            'user_lastname' => 'Test',
            'user_email' => $user->user_email,
            'user_coursenumber' => 123,
            'user_program' => 'Test',
            'fk_id_rol' => 1,
            'two_factor_enabled' => true,
        ]);
        $r->assertOk();
        $this->assertSame('Aprendiz', $r->json('role.rol_name'));
        $this->assertFalse((bool) $user->fresh()->two_factor_enabled);
    }

    public function test_create_user_ignora_campos_sensibles(): void
    {
        Sanctum::actingAs($this->crearUsuario('admin'));
        $uniq = uniqid();

        $r = $this->postJson('/api/admin/users', [
            'user_identification' => 'PMA' . substr($uniq, -10),
            'user_name' => 'Paridad',
            'user_lastname' => 'Mass',
            'user_email' => 'paridad+mass' . $uniq . '@gmail.com',
            'user_password' => 'Clave1234',
            'user_coursenumber' => 123,
            'user_program' => 'Test',
            'user_documento_tipo' => 'CC',
            'fk_id_rol' => Role::where('rol_name', 'Aprendiz')->value('id_rol'),
            'two_factor_enabled' => true,
            'trusted_device_id' => 'evil-device',
        ]);
        $r->assertStatus(201);
        $creado = User::find($r->json('id_usuario'));
        $this->uidsCreados[] = $creado->id_usuario;
        $this->assertFalse((bool) $creado->two_factor_enabled);
        $this->assertNull($creado->trusted_device_id);
    }

    public function test_guest_duplicado_y_token_requerido(): void
    {
        $doc = 'PGUEST' . substr(uniqid(), -8);
        $this->postJson('/api/register-guest', [
            'user_identification' => $doc,
            'user_name' => 'Visita',
            'user_lastname' => 'Prueba',
        ])->assertStatus(201);
        $this->uidsCreados[] = User::where('user_identification', $doc)->value('id_usuario');

        $this->postJson('/api/register-guest', [
            'user_identification' => $doc,
            'user_name' => 'Visita',
            'user_lastname' => 'Prueba',
        ])->assertStatus(422);

        $this->postJson('/api/validate-guest-qr', [])->assertStatus(422);
    }

    public function test_export_solo_admin_y_parametros_tolerantes(): void
    {
        Sanctum::actingAs($this->crearUsuario('Instructor'));
        $this->getJson('/api/admin/ingresos/export?formato=csv')->assertStatus(403);

        Sanctum::actingAs($this->crearUsuario('admin'));
        $r = $this->getJson('/api/admin/ingresos/export?formato=exe');
        $r->assertOk();
        $this->assertStringContainsString('text/csv', $r->headers->get('Content-Type'));

        $r2 = $this->getJson('/api/admin/ingresos/export?cols=usuario,columna_inexistente');
        $r2->assertOk();
        $this->assertStringContainsString('Usuario', $r2->streamedContent() ?? '');
    }

    public function test_instructor_ajeno_no_opera_mi_ambiente(): void
    {
        $instructor = $this->crearUsuario('Instructor');
        $ajeno = $this->crearUsuario('Instructor');
        $ambiente = \App\Models\Ambiente::create(['ambiente_nombre' => 'Pentest ' . uniqid()]);
        $ambiente->instructores()->sync([$instructor->id_usuario]);

        try {
            Sanctum::actingAs($ajeno);
            $this->getJson('/api/mis-ambientes/' . $ambiente->id_ambiente . '/aprendices')
                ->assertStatus(403);
            $this->deleteJson('/api/mis-ambientes/' . $ambiente->id_ambiente . '/aprendices/1')
                ->assertStatus(403);
        } finally {
            $ambiente->instructores()->detach();
            $ambiente->delete();
        }
    }

    public function test_novedad_show_solo_dueno_o_admin(): void
    {
        $a = $this->crearUsuario('Instructor');
        $b = $this->crearUsuario('Instructor');
        $nov = \App\Models\Novedad::create([
            'novedad_ambiente' => 'Pentest',
            'novedad_title' => 'Aviso',
            'novedad_body' => 'Contenido',
            'novedad_datetime' => now(),
            'fk_id_usuario' => $a->id_usuario,
        ]);

        try {
            Sanctum::actingAs($b);
            $this->getJson('/api/novedades/' . $nov->id_novedad)->assertStatus(403);
            Sanctum::actingAs($a);
            $this->getJson('/api/novedades/' . $nov->id_novedad)->assertOk();
            Sanctum::actingAs($this->crearUsuario('admin'));
            $this->getJson('/api/novedades/' . $nov->id_novedad)->assertOk();
        } finally {
            $nov->delete();
        }
    }

    public function test_my_profile_exige_dominio_y_resetea_verificacion(): void
    {
        $u = $this->crearUsuario('Aprendiz', [
            'user_coursenumber' => 123,
            'user_program' => 'Prog',
            'email_verified_at' => now(),
        ]);
        Sanctum::actingAs($u);
        $base = [
            'user_identification' => $u->user_identification,
            'user_name' => 'Paridad',
            'user_lastname' => 'Test',
            'user_coursenumber' => 123,
            'user_program' => 'Prog',
        ];

        $this->putJson('/api/my-profile', $base + ['user_email' => 'paridad@evil.com'])
            ->assertStatus(422);

        $nuevo = 'paridad+' . uniqid() . '@gmail.com';
        $this->putJson('/api/my-profile', $base + ['user_email' => $nuevo])->assertOk();
        $this->assertNull(User::find($u->id_usuario)->email_verified_at);
    }

    public function test_guest_colision_identificacion_no_da_500(): void
    {
        $uniq = substr(uniqid(), -6);
        $r1 = $this->postJson('/api/register-guest', [
            'user_identification' => 'AB-' . $uniq,
            'user_name' => 'Uno',
            'user_lastname' => 'Prueba',
        ]);
        $r1->assertStatus(201);
        $r2 = $this->postJson('/api/register-guest', [
            'user_identification' => 'AB' . $uniq,
            'user_name' => 'Dos',
            'user_lastname' => 'Prueba',
        ]);
        $r2->assertStatus(201);
        $this->assertNotEquals($r1->json('user.user_email'), $r2->json('user.user_email'));
        $this->uidsCreados[] = $r1->json('user.id_usuario');
        $this->uidsCreados[] = $r2->json('user.id_usuario');
    }

    public function test_export_csv_neutraliza_formulas(): void
    {
        $u = $this->crearUsuario('Aprendiz', ['user_name' => '=CMD']);
        \App\Models\Ingreso::create([
            'fk_id_user' => $u->id_usuario,
            'ingreso_datetime' => now(),
            'ingreso_place' => 'Portería',
            'ingreso_type' => 'Entrada',
        ]);
        Sanctum::actingAs($this->crearUsuario('admin'));
        $r = $this->getJson('/api/admin/ingresos/export?formato=csv&cols=usuario');
        $r->assertOk();
        $this->assertStringContainsString("'=CMD", $r->streamedContent() ?? '');
    }

    public function test_portero_accede_presentes_e_historial(): void
    {
        Sanctum::actingAs($this->crearUsuario('Portero'));

        $r = $this->getJson('/api/admin/presentes');
        $r->assertOk();
        $this->assertIsArray($r->json());

        $this->getJson('/api/admin/ingresos')->assertOk();
        $this->getJson('/api/admin/stats')->assertOk();
        $this->getJson('/api/admin/excusas')->assertOk();
    }

    public function test_portero_registra_y_devuelve_equipo(): void
    {
        Sanctum::actingAs($this->crearUsuario('Portero'));

        $r = $this->postJson('/api/admin/equipment', [
            'equipo_type' => 'Portátil',
            'equipo_brand' => 'Test',
            'equipo_color' => 'Negro',
            'equipo_serial' => 'PAREQ' . substr(uniqid(), -8),
        ]);
        $r->assertStatus(201);
        $id = $r->json('data.id_ingreso_equipo') ?? $r->json('data.id');
        $this->assertNotNull($id);

        $this->postJson("/api/admin/equipment/{$id}/return")->assertOk();
        // Segunda devolución: ya está devuelto.
        $this->postJson("/api/admin/equipment/{$id}/return")->assertStatus(422);

        Sanctum::actingAs($this->crearUsuario('Aprendiz'));
        $this->postJson('/api/admin/equipment', [
            'equipo_type' => 'Portátil',
            'equipo_brand' => 'Test',
            'equipo_color' => 'Negro',
            'equipo_serial' => 'PAREQ' . substr(uniqid(), -8),
        ])->assertStatus(403);
    }

    public function test_validar_pin_solo_roles_operativos(): void
    {
        // PIN inexistente: los roles operativos pasan la autorización (400) y el resto no (403).
        Sanctum::actingAs($this->crearUsuario('Portero'));
        $this->postJson('/api/excusas/validar', ['pin' => '0000'])->assertStatus(400);

        Sanctum::actingAs($this->crearUsuario('Instructor'));
        $this->postJson('/api/excusas/validar', ['pin' => '0000'])->assertStatus(400);

        Sanctum::actingAs($this->crearUsuario('Aprendiz'));
        $this->postJson('/api/excusas/validar', ['pin' => '0000'])->assertStatus(403);
    }

    public function test_portero_no_gestiona_usuarios_ni_ambientes(): void
    {
        Sanctum::actingAs($this->crearUsuario('Portero'));

        $this->postJson('/api/admin/users', ['user_email' => 'x@y.com'])->assertStatus(403);
        $this->postJson('/api/admin/ambientes', ['ambiente_nombre' => 'X'])->assertStatus(403);
    }
}
