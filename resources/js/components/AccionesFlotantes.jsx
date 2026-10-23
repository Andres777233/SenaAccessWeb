import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Acciones flotantes del panel: campana de notificaciones y cambio de tema.
// Van arriba a la derecha, debajo de la barra, como en el diseño de referencia;
// así el navbar queda limpio (marca, menú, perfil y salir).
const AccionesFlotantes = () => {
    const [abierto, setAbierto] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains('light-mode'));

    const fetchNotifications = async () => {
        try {
            const [lista, conteo] = await Promise.all([
                axios.get('/api/notifications'),
                axios.get('/api/notifications/unread-count'),
            ]);
            setNotifications(lista.data);
            setUnread(conteo.data.unread || 0);
        } catch (_) {
            /* sin sesión o sin red: la campana queda vacía */
        }
    };

    useEffect(() => {
        fetchNotifications();
        const id = setInterval(fetchNotifications, 60000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const alTema = (evento) => setTemaClaro(evento.detail?.tema === 'light');
        window.addEventListener('tema-cambiado', alTema);
        return () => window.removeEventListener('tema-cambiado', alTema);
    }, []);

    // Cierra el panel al hacer clic fuera.
    useEffect(() => {
        if (!abierto) return undefined;
        const alClic = (e) => {
            if (!e.target.closest('.acciones-flotantes')) setAbierto(false);
        };
        document.addEventListener('mousedown', alClic);
        return () => document.removeEventListener('mousedown', alClic);
    }, [abierto]);

    const toggleTema = () => {
        const claro = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', claro);
        localStorage.setItem('theme', claro ? 'light' : 'dark');
        setTemaClaro(claro);
        window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: claro ? 'light' : 'dark' } }));
    };

    const marcarLeida = async (id) => {
        try {
            await axios.put(`/api/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => (n.id_notificacion === id ? { ...n, is_read: true } : n)));
            setUnread((prev) => Math.max(0, prev - 1));
        } catch (_) { /* se reintenta en el siguiente refresco */ }
    };

    const marcarTodas = async () => {
        try {
            await axios.put('/api/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnread(0);
        } catch (_) { /* idem */ }
    };

    return (
        <div className="acciones-flotantes">
            <div className="accion-flotante-wrap">
                <button
                    type="button"
                    className="accion-flotante"
                    onClick={() => { fetchNotifications(); setAbierto((v) => !v); }}
                    title="Notificaciones"
                    aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
                    aria-expanded={abierto}
                >
                    <span className="material-symbols-outlined">notifications</span>
                    {unread > 0 && <span className="accion-flotante-badge">{unread > 9 ? '9+' : unread}</span>}
                </button>

                {abierto && (
                    <div className="accion-flotante-panel" role="dialog" aria-label="Notificaciones">
                        <div className="accion-flotante-head">
                            <strong>Notificaciones</strong>
                            {unread > 0 && (
                                <button type="button" className="btn btn-sm btn-outline-success py-0" onClick={marcarTodas}>
                                    Marcar todas
                                </button>
                            )}
                        </div>
                        {notifications.length === 0 ? (
                            <p className="small text-center opacity-50 mb-0 py-3">No tienes notificaciones</p>
                        ) : notifications.map((n) => (
                            <button
                                type="button"
                                key={n.id_notificacion}
                                className={`accion-flotante-item ${n.is_read ? '' : 'is-new'}`}
                                onClick={() => marcarLeida(n.id_notificacion)}
                            >
                                <span className="accion-flotante-item-titulo">{n.notification_title}</span>
                                <span className="accion-flotante-item-texto">{n.notification_body}</span>
                                <span className="accion-flotante-item-fecha">{new Date(n.created_at).toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                className="accion-flotante"
                onClick={toggleTema}
                title={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
                aria-label={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
            >
                <span className="material-symbols-outlined">{temaClaro ? 'dark_mode' : 'light_mode'}</span>
            </button>
        </div>
    );
};

export default AccionesFlotantes;
