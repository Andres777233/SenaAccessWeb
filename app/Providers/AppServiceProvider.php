<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Los rate limits se anclan al CORREO/código (no a la IP): detrás del proxy
        // de Railway la IP del cliente varía por petición y un límite por IP nunca
        // se acumularía. Limitar por cuenta/código es además más seguro contra fuerza
        // bruta dirigida a un mismo correo.
        RateLimiter::for('login', function (Request $request) {
            $key = strtolower(trim($request->input('user_email', '')));
            return Limit::perMinute(5)->by($key ?: $request->ip());
        });

        RateLimiter::for('forgot-password', function (Request $request) {
            $key = strtolower(trim($request->input('email', '')));
            return Limit::perMinute(3)->by($key ?: $request->ip());
        });

        RateLimiter::for('reset-password', function (Request $request) {
            $key = trim($request->input('code', ''));
            return Limit::perMinute(10)->by($key ?: $request->ip());
        });

        RateLimiter::for('verification', function (Request $request) {
            $userId = $request->user()?->id_usuario;
            return Limit::perMinute(3)->by($userId ?: $request->ip());
        });
    }
}