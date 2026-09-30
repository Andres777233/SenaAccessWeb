# testing-flujos (WEB)
- Flujos: login normal, login 2FA (requiere reto, no token), excusa PIN 15min 1 uso, ambientes CRUD admin, subida foto (MIME + max).
- Dónde: `tests/Feature/` (nuevos, no solo ExampleTest). Comando: `php artisan test`.
- Exigir: 1 test por endpoint nuevo; assert 403 en cross-rol; assert 422 en validación.
