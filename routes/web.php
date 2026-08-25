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

// Catch-all: React SPA maneja todas las rutas (incluyendo login y paneles)
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*'); 
