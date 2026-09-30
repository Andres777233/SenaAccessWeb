# react-roles-ui
Aplica a `resources/js/`.

- Roles: Admin/Instructor/Aprendiz con ProtectedRoute; ficha/programa visible y required SOLO si rol Aprendiz (nullable resto → null).
- Tablas: clase `table-cards` + `data-label` en cada `<td>`; refetch al cambiar vista y con focus/visibilitychange.
- Forms: estado `*Errors` por campo + `is-invalid`; login con trim()+lowercase.
- Build: `npm run build` obligatorio antes de dar por hecho.
