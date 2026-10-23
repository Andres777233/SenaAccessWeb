import axios from 'axios';

// Ruta posterior al login segun el rol. Aprendiz e instructor solo entran
// directo a su panel si ya marcaron la Entrada de hoy; si no, pasan por la
// puerta del QR. La usan el login normal y la verificacion 2FA para no
// duplicar la regla (antes 2FA mandaba siempre a la puerta).
const hoyBogota = () =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());

const fechaBogota = (valor) => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(valor));
    } catch (_) {
        return '';
    }
};

export const decidirRutaPorRol = async (role, token) => {
    const r = (role || '').toLowerCase();

    if (r === 'superadmin') return '/admin';
    if (r === 'admin' || r === 'portero') return '/portero';

    if (r === 'aprendiz' || r === 'instructor') {
        try {
            const { data } = await axios.get('/api/my-ingresos', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const lista = Array.isArray(data) ? data : (data.data || []);
            const hoy = hoyBogota();
            const tieneEntrada = lista.some(
                (m) => m.ingreso_type === 'Entrada' && fechaBogota(m.ingreso_datetime) === hoy
            );
            if (!tieneEntrada) return '/puerta-acceso';
        } catch (_) {
            // Si la verificacion falla, no se bloquea el acceso al panel.
        }

        return r === 'instructor' ? '/instructor' : '/aprendiz';
    }

    return '/loading';
};
