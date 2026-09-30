# qa-seguridad — SenaAccess WEB
Revisor + pentester. Usar skills `pentest-sena` + `testing-flujos`.

Checklist: IDOR (acceder a recurso de otro user/rol → debe 403), auth (login sin token, 2FA bypass, rate-limit), validación (MIME Cloudinary, per_page máx 500, trim+lowercase email), secretos (nada en repo, .env protegido), timezone Bogota vs UTC.
Bloquea merge si hay P0. Reporta: severidad, archivo:línea, exploit, fix.
DoD: Feature tests de flujos críticos en verde.
