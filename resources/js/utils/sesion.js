import axios from 'axios';

// Normaliza el rol del backend a la lista cerrada del SPA. Acepta los
// nombres viejos (Portero/Administrador) para no romper sesiones guardadas.
export const normalizarRol = (role) => {
    const r = String(role || '').trim().toLowerCase();
    if (['superadmin', 'superadministrador', 'super admin'].includes(r)) return 'superadmin';
    if (['admin', 'administrador', 'administradora', 'portero', 'portería', 'porteria', 'celador'].includes(r)) return 'admin';
    if (r === 'instructor') return 'instructor';
    if (r === 'aprendiz') return 'aprendiz';
    if (['invitado', 'visitante', 'guest'].includes(r)) return 'invitado';
    return '';
};

// Ruta del panel para cada rol. El rol Admin es la porteria operativa
// (antes se llamaba Portero); el Superadmin es el panel completo.
export const rutaPorRol = (role) => {
    switch (normalizarRol(role)) {
        case 'superadmin': return '/admin';
        case 'admin': return '/portero';
        case 'instructor': return '/instructor';
        case 'aprendiz': return '/aprendiz';
        default: return '/login';
    }
};

// La puerta se cumple solo con una Entrada de HOY y sin Salida posterior.
// entrada_hoy evita que una Entrada de ayer cuente como "estoy dentro".
export const estaDentroHoy = (estado) => Boolean(estado && estado.entrada_hoy && estado.dentro);

// Limpia la sesion y los retos locales. No toca correos guardados, tema,
// device_id ni la huella: esos datos son del navegador, no de la sesion.
export const limpiarSesionLocal = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('sena_usuario');
    localStorage.removeItem('2fa_challenge_id');
};

// Ruta posterior al login: los paneles operativos entran directo; aprendiz e
// instructor pasan por la puerta si no tienen una Entrada de hoy sin Salida.
export const decidirRutaPorRol = async (role, token) => {
    const r = normalizarRol(role);
    if (r === 'superadmin' || r === 'admin') return rutaPorRol(r);
    if (r === 'aprendiz' || r === 'instructor') {
        try {
            const { data } = await axios.get('/api/acceso/estado', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (!estaDentroHoy(data)) return '/puerta-acceso';
        } catch (_) {
            // Sin verificacion no se abre el panel: la puerta es la unica
            // pantalla que exige un movimiento confirmado por el servidor.
            return '/puerta-acceso';
        }
        return rutaPorRol(r);
    }
    return '/login';
};

// Corrige el rol guardado si el servidor devuelve otro (sesion vieja o
// cambio de rol hecho por el superadmin). Devuelve false si redirigio.
export const corregirRolDePanel = (usuario, esperado, navigate) => {
    const rolCrudo = typeof usuario?.role === 'string' ? usuario.role : usuario?.role?.rol_name;
    const real = normalizarRol(rolCrudo);
    if (real === esperado) return true;
    if (!real) {
        limpiarSesionLocal();
        navigate('/login', { replace: true });
        return false;
    }
    localStorage.setItem('user_role', rolCrudo || '');
    navigate(rutaPorRol(real), { replace: true });
    return false;
};
