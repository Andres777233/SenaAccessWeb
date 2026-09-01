<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AmbienteController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\ExcusaController;
use App\Http\Controllers\JornadaController;
use App\Http\Controllers\NovedadController;
use App\Http\Controllers\NotificacionController;
use App\Http\Controllers\PasskeyController;
use App\Http\Controllers\SugerenciaController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Healthcheck público para Railway (no requiere auth)
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// Rutas de autenticación con Sanctum
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// Salida en tiempo real: el frontend la dispara al cerrar la última pestaña/app
// (fetch keepalive en pagehide) y puede revertirla si el cierre era un refresh.
Route::post('/session-exit', [AuthController::class, 'sessionExit'])->middleware('auth:sanctum');
Route::post('/session-exit/cancel', [AuthController::class, 'cancelSessionExit'])->middleware('auth:sanctum');

// WebAuthn (passkeys): registro requiere sesión; login es público y devuelve
// el mismo formato que POST /api/login.
Route::post('/webauthn/login/options', [PasskeyController::class, 'loginOptions']);
Route::post('/webauthn/login', [PasskeyController::class, 'login']);
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/webauthn/register/options', [PasskeyController::class, 'registerOptions']);
    Route::post('/webauthn/register', [PasskeyController::class, 'register']);
    Route::get('/webauthn/passkeys', [PasskeyController::class, 'index']);
    Route::delete('/webauthn/passkeys/{id}', [PasskeyController::class, 'destroy']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user()->load('role');
    });

    // Rutas de usuario general (Aprendiz)
    Route::get('/my-ingresos', [AdminController::class, 'getMyIngresos']);
    Route::get('/my-stats', [AdminController::class, 'myStats']);
    Route::get('/my-equipment', [EquipmentController::class, 'getMyEquipment']);
    Route::get('/my-equipment/{id}/comprobante', [EquipmentController::class, 'comprobante']);
    Route::post('/my-equipment', [EquipmentController::class, 'store']);
    Route::put('/my-profile', [AdminController::class, 'updateMyProfile']);

    // Rutas compartidas entre Admin e Instructor
    Route::middleware('admin_or_instructor')->prefix('admin')->group(function () {
        Route::get('/users', [AdminController::class, 'index']);
        Route::get('/roles', [AdminController::class, 'getRoles']);
        
        // Rutas admin para crear usuarios 
        Route::middleware('admin')->group(function () {
            Route::post('/users', [AdminController::class, 'createUser']);
            Route::put('/users/{id}', [AdminController::class, 'updateUser']);
            Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
        });

        // El historial global de accesos y las estadísticas del centro son SOLO admin:
        // el instructor únicamente consulta su propio historial (/my-ingresos).
        Route::middleware('admin')->group(function () {
            Route::get('/ingresos', [AdminController::class, 'getIngresos']);
            Route::get('/ingresos/export', [AdminController::class, 'exportIngresos']);
            Route::get('/stats', [AdminController::class, 'stats']);
            Route::get('/presentes', [AdminController::class, 'presentes']);
        });

        // Rutas para gestionar equipos: SOLO el admin registra y marca devoluciones;
        // ver el inventario completo y eliminar también solo admin.
        Route::post('/equipment', [EquipmentController::class, 'store'])->middleware('admin');
        Route::post('/equipment/{id}/return', [EquipmentController::class, 'markReturn'])->middleware('admin');
        Route::middleware('admin')->group(function () {
            Route::get('/equipment', [EquipmentController::class, 'index']);
            Route::delete('/equipment/{id}', [EquipmentController::class, 'deleteEquipment']);
        });
    });

    // Rutas de novedades para cualquier rol autenticado (lectura). El aprendiz
    // también consulta GET /novedades desde su dashboard.
    Route::get('/my-novedades', [NovedadController::class, 'getMyNovedades']); //OBTIENE LAS NOVEDADES DEL USUARIO
    Route::apiResource('novedades', NovedadController::class);

    // Rutas de notificaciones in-app
    Route::get('/notifications', [NotificacionController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificacionController::class, 'unreadCount']);
    Route::put('/notifications/{id}/read', [NotificacionController::class, 'markRead']);
    Route::put('/notifications/read-all', [NotificacionController::class, 'markAllRead']);

    // Buzón de sugerencias: cualquier rol envía y consulta las propias;
    // el admin gestiona la bandeja completa (index rol-aware) y responde/elimina.
    Route::get('/my-sugerencias', [SugerenciaController::class, 'getMySugerencias']);
    Route::post('/sugerencias', [SugerenciaController::class, 'store']);
    Route::get('/sugerencias', [SugerenciaController::class, 'index']);
    Route::middleware('admin')->group(function () {
        Route::put('/admin/sugerencias/{id}/responder', [SugerenciaController::class, 'respond']);
        Route::delete('/admin/sugerencias/{id}', [SugerenciaController::class, 'destroy']);
    });

    // Ambientes (admin crea, instructor gestiona sus ambientes/aprendices).
    Route::get('/ambientes', [AmbienteController::class, 'index']);
    Route::get('/mis-ambientes', [AmbienteController::class, 'misAmbientes']);
    Route::get('/mis-ambientes/{id}/aprendices', [AmbienteController::class, 'misAprendices']);
    Route::post('/mis-ambientes/{id}/aprendices', [AmbienteController::class, 'misAddAprendiz']);
    Route::delete('/mis-ambientes/{id}/aprendices/{userId}', [AmbienteController::class, 'misRemoveAprendiz']);

    // Gestión de ambientes (solo admin).
    Route::middleware('admin')->group(function () {
        Route::post('/admin/ambientes', [AmbienteController::class, 'store']);
        Route::put('/admin/ambientes/{id}', [AmbienteController::class, 'update']);
        Route::delete('/admin/ambientes/{id}', [AmbienteController::class, 'destroy']);
        Route::post('/admin/ambientes/{id}/instructores', [AmbienteController::class, 'syncInstructores']);
        Route::get('/admin/ambientes/{id}/aprendices', [AmbienteController::class, 'getAprendices']);
        Route::post('/admin/ambientes/{id}/aprendices', [AmbienteController::class, 'addAprendiz']);
        Route::delete('/admin/ambientes/{id}/aprendices/{userId}', [AmbienteController::class, 'removeAprendiz']);
    });

    // Jornada / QR dinámico (instructor proyecta, aprendiz valida).
    Route::get('/jornada/qr/{ambiente}', [JornadaController::class, 'qr']);
    Route::get('/jornada/qr-actual', [JornadaController::class, 'qrActual']);

    // Excusas con PIN: instructor crea (elige aprendiz+ambiente+motivo → genera PIN), admin valida en salida.
    Route::post('/instructor/excusas', [ExcusaController::class, 'store']);
    Route::get('/instructor/excusas', [ExcusaController::class, 'misComoInstructor']);
    Route::delete('/instructor/excusas/{id}', [ExcusaController::class, 'anular']);
    Route::get('/mis-excusas', [ExcusaController::class, 'misExcusas']);
    Route::post('/excusas/validar', [ExcusaController::class, 'validar']);
    Route::middleware('admin')->group(function () {
        Route::get('/admin/excusas', [ExcusaController::class, 'indexAdmin']);
    });

    // Rutas específicas del Instructor
    Route::middleware('auth:sanctum')->group(function () {
        // Solo el instructor puede ver sus propios comprobantes
    });
});
