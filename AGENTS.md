# AGENTS.md — SenaAccess-Repo2 ("SenaAccess WEB")

Backend Laravel 10 + MySQL + SPA React 19 (Vite, Bootstrap 5.3 CDN) de SennAccess. Ruta: `/home/andres/Escritorio/SenaAccess-Repo2-master./SenaAccess-Repo2-master` (la carpeta padre termina en punto; citar siempre entre comillas).

## Comandos y entorno
- Servidor: `php artisan serve --host 0.0.0.0 --port 8000` (o `bash iniciar-servidor.sh`). OJO: artisan serve sirve estáticos de `public/` ANTES que el router; los paneles legacy viven en `public/static-html-backup/` para que `/admin`, `/instructor`, `/aprendiz` caigan en el SPA React.
- BD: MariaDB servicio `mariadb`, base `senaaccess` (root sin password, en `.env`). Migrar: `php artisan migrate`. Seed: `php artisan db:seed --force`.
- Entorno: PHP 8.5.4 (+pdo_mysql, mbstring, curl, xml, gd, zip), Composer en `~/.local/bin/composer`, Node v24. Build SPA: `npm run build`.
- Credenciales (idénticas local y Railway, ver `DatabaseSeeder.php`): `admin@sena.edu.co` con `12345678`; instructores: `juan.pablo@sena.edu.co` (`12345678`), `alejandro/gustavo/raul@sena.edu.co` (`123456`); aprendices: `andres.vargas/laura.medina@sena.edu.co` (`12345678`), `katherin/sebastian/camilo@sena.edu.co` (`123456`). NO existen `instructor@` ni `aprendiz@sena.edu.co`.

## Convenciones
- PKs propias (`id_ambiente`, `id_novedad`, ...) y prefijos de columna (`user_*`, `novedad_*`, `equipo_*`, `ambiente_*`, `sugerencia_*`).
- `roles.rol_name`: mezcla mayúsculas (`admin` minúscula, `Instructor`/`Aprendiz` capitalizados); comparar caso exacto.
- Fechas de ingresos en `America/Bogota`; errores de validación por campo con estado `*Errors` + clase `is-invalid`; toda tabla nueva del SPA lleva `table-cards` + `data-label` en sus `<td>`.
- Rutas backend en `routes/api.php`; SPA en `resources/js/`.

## Retomar trabajo (IMPORTANTE)
- Este proyecto = **"SenaAccess WEB"**.
- En "continuemos"/"retomemos"/"seguimos": NO leas archivos extra y NO re-explores el repo con grep/glob — el estado completo y todo el historial están AQUÍ MISMO (sección `## Historial`, entradas más recientes al final).

## Autoguardar historial (OBLIGATORIO)
Al terminar cada tarea/sesión, agrega al FINAL de `## Historial` una entrada fechada `- YYYY-MM-DD — <qué cambiaste y por qué>`: MUY concreta, directa y clara (1-2 líneas máximo). Nunca borres ni reescribas entradas anteriores.

## Historial
- 2026-08-22 — Fotos perfil: copié a `public/avatars/` (admin/aprendiz/instructor) y seteé `profile_photo_path` relativo vía tinker (ids 1, 12, 17); sin tocar código; Cloudinary solo para subidas reales.
- 2026-08-20 — Buzón sugerencias completo: tabla+controlador (anti-spam 3/día, bandeja admin con filtros/paginación, responder/eliminar solo admin) + componente compartido `Sugerencias.jsx` en los 3 roles.
- 2026-08-20 — Responsive global del SPA: dropdowns navbar por TAP, tablas→tarjetas en móvil (`table-cards`+`data-label`), theme-toggle flotante, modales scrollables; eliminé admin-style.css e instructor-style.css (~4600 líneas muertas).
- 2026-08-20 — Comprobante PDF de equipo: dompdf (`GET /api/my-equipment/{id}/comprobante`, dueño o admin); rediseño profesional; por decisión tuya eliminé la sección firmas → quedaron 4 secciones.
- 2026-08-20 — Salidas en tiempo real: `POST /api/session-exit` (+`/cancel`) con dedup; frontend cuenta pestañas en localStorage y usa pagehide keepalive; F5 no cuenta como salida.
- 2026-08-19 — Novedades: aprendiz SIN nada de novedades; solo admin edita/borra (403 si no); instructor conserva "Reportar".
- 2026-08-19 — Equipos: SOLO admin registra (formulario con selector de dueño); instructor/aprendiz solo ven los suyos en lectura.
- 2026-08-17 — Equipos en Admin como tabla consolidada ordenable + filtro por rol; backend carga `with('user.role')`.
- 2026-08-17 — Navbar centrado real (2º intento OK sin tocar el collapse de Bootstrap; el 1er intento se revirtió desde backup).
- 2026-08-17 — Cuentas con password `123456` (6 correos), resto `12345678`; login hace trim()+strtolower() (arregla 401 por espacios/mayúsculas).
- 2026-08-17 — Visibilidad por rol: novedades filtradas (admin todas, otros propias); endpoints `/admin/*` solo admin; `?per_page=` máx 500.
- 2026-08-16 — Datos en vivo: refetch al cambiar de vista y con focus/visibilitychange en Admin/Instructor/Aprendiz.
- 2026-08-16 — Horarios por día en ambientes (día×jornada únicos) con modal calendario; multi-instructor por pivote `ambiente_instructor`; asignación explícita aprendiz→instructor (`aprendiz_instructor`) con ambiente/jornada.
- 2026-08-16 — Directorio de personas (instructores/aprendices filtrables) reemplazó la UI de dispositivos; luego quedó EQUIPOS como dropdown/historial.
- 2026-08-16 — Propiedad de equipo Prestado/Propio + `POST /api/my-equipment` para cualquier rol autenticado; UI verde unificada (`.badge-soft-*`, `.equipo-detail-card`, `.glass-box-nested`, buscadores con lupa pegada).
- 2026-08-15 — Dashboards servidos por el SPA React (rutas estáticas removidas; ProtectedRoute token+rol).
- 2026-08-15 — Ambientes (tabla+fkc novedades, CRUD admin, select en novedades), invitados QR de 1 uso (60 min) con validación que registra Entrada, dashboard stats KPIs, historial de accesos con filtros/CSV/paginación, devolución de equipos, notificaciones in-app con campanita, errores por campo.
- 2026-08-12 — Novedades accesibles a cualquier rol autenticado; ingresos Entrada (login)/Salida (logout) en America/Bogota; equipos accesibles admin+instructor con accesorios JSON; credenciales de prueba definidas.
- 2026-08-24 — FIX login 500 en Railway: la BD "MySQL" original estaba rota (variables placeholder, password root perdida, nunca conectada al web). Creé BD "MySQL-DK1Y" vía `railway add`, inyecté al servicio SenaAccessWeb DATABASE_URL+APP_KEY+APP_ENV+APP_DEBUG=false+APP_URL+LOG_CHANNEL=stderr, migré+sembré con `railway ssh` al contenedor web (29 tablas); login verificado 200. BD vieja y volumen huérfano eliminados. Seeder idempotente, redeploys seguros.
- 2026-08-25 — Quité la asignación aprendiz↔instructor: eliminé las rutas `/admin/aprendiz-instructores` de routes/api.php, el controlador y el modelo, y toda la UI en Admin.jsx (estado, handlers, modal de asignar instructor, filtro). Se deja la migración/tabla. Build SPA verificado (`npm run build` OK).
- 2026-08-25 — Ficha/programa SOLO para Aprendiz: `updateMyProfile`/`createUser`/`updateUser` validan `user_coursenumber`/`user_program` como `required` únicamente si el rol es Aprendiz (nullable para admin/instructor, se limpian a null). SPA: Instructor.jsx sin ficha en perfil, Admin.jsx perfil propio sin ficha y campos de ficha/programa visibles en el CRUD solo cuando el rol es Aprendiz, listado muestra "Ficha: —". Además inyecté CLOUDINARY_URL/CLOUDINARY_UPLOAD_PRESET en Railway (sin ellas subir foto daba 500). Deploy 34c08d55 verificado (health y login 200).
- 2026-08-25 — Migración `2026_08_25_000001_make_ficha_programa_nullable_in_usuarios_table`: `user_coursenumber` y `user_program` pasan a NULL (SQL crudo, sin doctrine/dbal). Sin esto, guardar el perfil de admin/instructor con ficha null daba 500 ("Column user_coursenumber cannot be null") pese a que Cloudinary ya subía la foto. Aplicada local y en Railway (releaseCommand migrate). Deploy 3b804ba verificado.
- 2026-08-25 — Límite de foto de perfil a max:5120 en updateMyProfile/createUser/updateUser (AdminController); el móvil ahora sube JPEG comprimido ~1024px así que nunca llega al límite. Push 6c137c0 (deploy Railway).
- 2026-09-02 — Módulo ambientes reintroducido (v1.3): quitado QR invitado (`registerGuest`/`validateGuestQr` de AuthController y rutas `register-guest`/`validate-guest-qr`), limpiado `User.php` fillable; nuevas migraciones `ambientes`/`ambiente_instructor`/`ambiente_aprendiz` (totp_secret auto, hora_inicio/fin), modelos `Ambiente.php` y controladores `AmbienteController.php`+`JornadaController.php` (TOTP 30s, `mis-ambientes`/`/jornada/qr/{id}`); rutas `ambientes`/`mis-ambientes`/`admin/ambientes`. Verificado local: admin crea 101 (CCyS) y 202 (Ciudad Jardín), Juan Pablo enseña en ambos, QR vigente.
- 2026-09-02 — Fix 408 + excusas con PIN (v1.4): causas 408 era deploy sin módulo (Railway en 68fdf5b); deploy 25d10f9 + `railway ssh migrate` crea `ambientes` (101/202 con Juan Pablo); nuevo módulo excusas: migración `excusas` (fk_aprendiz/ambiente/instructor, motivo, pin 4 dígitos, expira 60m, estado pendiente/usada/anulada/expirada), modelo `Excusa.php`, controlador `ExcusaController.php` (store valida aprendiz+ambiente+rol, genera PIN sin colisión, validar crea Salida en `ingresos`, expiración lazy, misExcusas/admin index), rutas `instructor/excusas`, `mis-excusas`, `excusas/validar`, `admin/excusas`. Verificado Railway: instructor crea PIN 1232/5416/1992, admin valida 1232 → Salida Ambiente 101, pendiente 5416/1992. Push 15fe027.
- 2026-09-11 — Verificación en dos pasos (2FA) backend: migración `add_two_factor` añade `two_factor_enabled` a `usuarios` y crea tabla `two_factor_challenges` (challenge_id UUID, code_hash, code_expires_at, expires_at, ip, user_agent, estado); modelo `TwoFactorChallenge.php`, Mailable `TwoFactorCodeMail.php` + vista twig `two_factor_code` (Brevo HTTPS existente); `TwoFactorController.php` (activar/desactivar con password, validar-codigo 6 dígitos con throttle, estado/{id} público por challenge, pendientes/auth, aprobar/denegar) y `routes/api.php` (públicas `POST /api/2fa/validar-codigo` y `GET /api/2fa/estado/{id}`; autenticadas `2fa/estado-config, activar, desactivar, pendientes, aprobar`); `AuthController@login`: si `two_factor_enabled` NO emite token, crea reto, manda código por correo + notificación in-app y devuelve `two_factor_required`; `User.php` cast boolean + fillable; PIN excusas `ExcusaController` pasa de 60 min a 15 min (`Carbon::addMinutes(15)`). Todo validado `php -l`; pendiente push/deploy Railway.
