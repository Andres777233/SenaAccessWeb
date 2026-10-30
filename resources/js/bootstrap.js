/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */
// Importamos axios y lo asignamos a la ventana global para que esté disponible en toda la aplicación
import axios from 'axios';
import { getToken, cerrarSesion, esTokenActual } from './utils/auth';
window.axios = axios;

// Configuramos axios para que incluya el encabezado 'X-Requested-With' en todas las solicitudes
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.withCredentials = true;

// agregamos un interceptor para incluir el token de autenticación en el encabezado Authorization de cada solicitud, si el token está presente en el almacenamiento de la pestaña
window.axios.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Sesión vencida o revocada: limpia la sesión de ESTA pestaña y vuelve al login.
// Solo cierra si el token rechazado es el de esta pestaña: antes un 401 de una
// petición vieja (otra sesión abierta en el mismo navegador) cerraba todo.
window.axios.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error && error.response && error.response.status === 401) {
        const usado = String(error.config?.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
        if (!usado || esTokenActual(usado)) {
            cerrarSesion();
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
    }
    return Promise.reject(error);
});

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

// import Echo from 'laravel-echo';

// import Pusher from 'pusher-js';
// window.Pusher = Pusher;

// window.Echo = new Echo({
//     broadcaster: 'pusher',
//     key: import.meta.env.VITE_PUSHER_APP_KEY,
//     cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1',
//     wsHost: import.meta.env.VITE_PUSHER_HOST ? import.meta.env.VITE_PUSHER_HOST : `ws-${import.meta.env.VITE_PUSHER_APP_CLUSTER}.pusher.com`,
//     wsPort: import.meta.env.VITE_PUSHER_PORT ?? 80,
//     wssPort: import.meta.env.VITE_PUSHER_PORT ?? 443,
//     forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
//     enabledTransports: ['ws', 'wss'],
// });
