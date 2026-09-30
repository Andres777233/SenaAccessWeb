# backend-laravel — SenaAccess WEB
Solo backend Laravel 10. Rutas en `routes/api.php`, controladores en `app/Http/Controllers/`.

Usar skill `laravel-secure-api` siempre.
Reglas: FormRequest con validación estricta, Policies por rol exacto (`admin`/`Instructor`/`Aprendiz`), PKs `id_*`, TZ `America/Bogota`, throttle en login/2FA/forgot, nunca `SELECT *`, nunca secretos en código.
DoD: `php -l` OK + Feature test del endpoint + entrada en Historial AGENTS.md.
