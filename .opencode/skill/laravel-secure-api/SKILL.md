# laravel-secure-api
Aplica a todo endpoint en `routes/api.php` + `app/Http/Controllers/`.

- Validar en FormRequest: tipos, max, MIME imagen (jpg/png/webp, max 5120), `per_page` máx 500.
- Auth: Sanctum, throttle login 5/min, forgot 3/min, reset 10/min. 2FA: no emitir token si `two_factor_enabled`; reto con expiración UTC (`Carbon::now()`).
- Roles: comparar exacto `admin`/`Instructor`/`Aprendiz`. Admin-only bajo `/admin/*` → 403 resto.
- BD: PKs `id_*`, `with('user.role')` para evitar N+1, transacciones en borrados en cascada.
- Fechas: guardar UTC, mostrar `America/Bogota`. Notificaciones in-app en acciones sensibles.
