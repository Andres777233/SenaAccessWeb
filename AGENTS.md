# AGENTS.md — SenaAccess-Repo2 ("SenaAccess WEB")

Backend Laravel 10 + MySQL + SPA React 19 (Vite, Bootstrap 5.3 CDN) de SennAccess. Ruta: `/home/andres/Escritorio/SenaAccess-Repo2-master./SenaAccess-Repo2-master` (la carpeta padre termina en punto; citar siempre entre comillas).

## Comandos y entorno
- Servidor: `php artisan serve --host 0.0.0.0 --port 8000` (o `bash iniciar-servidor.sh`). OJO: artisan serve sirve estáticos de `public/` ANTES que el router; los paneles legacy viven en `public/static-html-backup/` para que `/admin`, `/instructor`, `/aprendiz` caigan en el SPA React.
- BD: MariaDB servicio `mariadb`, base `senaaccess` (root sin password, en `.env`). Migrar: `php artisan migrate`. Seed: `php artisan db:seed --force`.
- Entorno: PHP 8.5.4 (+pdo_mysql, mbstring, curl, xml, gd, zip), Composer en `~/.local/bin/composer`, Node v24. Build SPA: `npm run build`.
- Credenciales prueba: `admin@sena.edu.co`, `instructor@sena.edu.co`, `aprendiz@sena.edu.co` con `12345678`; cuentas reales (`alejandro`, `raul`, `gustavo`, `katherin`, `sebastian`, `camilo`, `andres.vargas`, `laura.medina` @sena.edu.co) con `123456`.

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
