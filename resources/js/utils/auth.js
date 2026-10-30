// Sesión POR PESTAÑA.
//
// Antes el token y el rol vivían en localStorage, que es común a todas las
// pestañas del dominio: abrir un segundo rol (p. ej. instructor) sobrescribía
// el token de la primera pestaña (aprendiz) y la dejaba fuera del panel.
//
// Ahora cada pestaña guarda su propia sesión en sessionStorage y localStorage
// solo conserva la ULTIMA sesión iniciada, para que una pestaña nueva la
// herede (el uso normal de una sola sesión sigue igual que siempre).
const CLAVE_PESTANA = 'sena_auth';
const CLAVE_ULTIMA = 'sena_auth_ultima';
const CLAVE_RETO_2FA = '2fa_challenge_id';
// Cache del usuario del panel: también por pestaña, si no el panel de un rol
// pintaria el nombre del usuario logueado en la otra pestaña.
const CLAVE_USUARIO = 'sena_usuario';
// Claves del esquema anterior: se migran al leer y se limpian al guardar.
const LEGADO_TOKEN = 'access_token';
const LEGADO_ROL = 'user_role';

const leer = (storage, clave) => {
    try {
        const crudo = storage.getItem(clave);
        return crudo ? JSON.parse(crudo) : null;
    } catch (_) {
        return null;
    }
};

const escribir = (storage, clave, valor) => {
    try {
        storage.setItem(clave, JSON.stringify(valor));
    } catch (_) {
        /* almacenamiento lleno o bloqueado: la app sigue funcionando */
    }
};

const normalizar = (sesion) =>
    sesion && sesion.token ? { token: sesion.token, role: sesion.role || '' } : null;

// Devuelve { token, role } de ESTA pestaña (o lo hereda de la última sesión).
export const getSesion = () => {
    const propia = normalizar(leer(sessionStorage, CLAVE_PESTANA));
    if (propia) return propia;

    const heredada =
        normalizar(leer(localStorage, CLAVE_ULTIMA)) ||
        normalizar({
            token: localStorage.getItem(LEGADO_TOKEN),
            role: localStorage.getItem(LEGADO_ROL),
        });

    if (heredada) {
        escribir(sessionStorage, CLAVE_PESTANA, heredada);
        return heredada;
    }
    return null;
};

export const getToken = () => getSesion()?.token || null;

// Rol en minúsculas, como lo comparan las rutas y los menús.
export const getRol = () => (getSesion()?.role || '').toLowerCase();

// Guarda la sesión de esta pestaña y deja la copia para las pestañas nuevas.
export const guardarSesion = (token, role) => {
    const sesion = { token: token || '', role: role || '' };
    escribir(sessionStorage, CLAVE_PESTANA, sesion);
    escribir(localStorage, CLAVE_ULTIMA, sesion);
    localStorage.removeItem(LEGADO_TOKEN);
    localStorage.removeItem(LEGADO_ROL);
    return sesion;
};

// Cierra SOLO la sesión de esta pestaña (las demás pestañas siguen abiertas).
export const cerrarSesion = () => {
    sessionStorage.removeItem(CLAVE_PESTANA);
    sessionStorage.removeItem(CLAVE_RETO_2FA);
    sessionStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_ULTIMA);
    localStorage.removeItem(LEGADO_TOKEN);
    localStorage.removeItem(LEGADO_ROL);
    // Cache de usuario del esquema anterior (compartida entre pestañas).
    localStorage.removeItem(CLAVE_USUARIO);
};

// Evita que una respuesta 401 de una petición vieja (otra sesión/pestaña)
// derribe la sesión actual.
export const esTokenActual = (token) => !!token && token === getToken();

// Reto 2FA en curso: también por pestaña, para que un login en otra pestaña
// no pise el reto de esta.
export const getReto2Fa = () => sessionStorage.getItem(CLAVE_RETO_2FA) || '';

export const guardarReto2Fa = (id) => sessionStorage.setItem(CLAVE_RETO_2FA, id || '');

export const borrarReto2Fa = () => sessionStorage.removeItem(CLAVE_RETO_2FA);

// Usuario del panel cacheado por pestaña (antes vivía en localStorage y una
// segunda pestaña con otro rol mostraba el nombre equivocado).
export const guardarUsuario = (usuario) => {
    try {
        sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
    } catch (_) {
        /* sin espacio: el panel igual refetchea /api/user */
    }
};

export const getUsuario = () => {
    try {
        return JSON.parse(sessionStorage.getItem(CLAVE_USUARIO) || 'null');
    } catch (_) {
        return null;
    }
};

export const borrarUsuario = () => {
    sessionStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_USUARIO);
};
