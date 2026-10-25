<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// Los paneles (Admin, Instructor, Aprendiz) ahora se sirven desde el SPA React
// (ver /admin, /instructor, /aprendiz en resources/js/app.jsx).
// Se removieron las rutas estáticas de public/ (legacy).

// Descarga directa del APK actual (antes del catch-all del SPA).
// Los APK viejos (V2 a V4.1) se retiraron del repo para no acumular egress.
Route::redirect('/SenaAccessV9.0.apk', '/SenaAccessV9.1.apk', 301);
Route::get('/SenaAccessV9.1.apk', function () {
    return response()->download(public_path('SenaAccessV9.1.apk'));
});

// Catch-all: React SPA maneja todas las rutas (incluyendo login y paneles)
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*'); 
