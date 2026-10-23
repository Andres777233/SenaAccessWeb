import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTema, TEMA_V2, TEMA_CLASICO } from '../../utils/tema';


// Interruptor de sistema visual reutilizable (barra, hoja "Más" y páginas públicas).
export const TemaSwitch = ({ compacto = false }) => {
    const { esV2, cambiarTema } = useTema();
    return (
        <div className="v2-tema" role="group" aria-label="Sistema visual">
            <button
                type="button"
                className={esV2 ? 'is-on' : ''}
                aria-pressed={esV2}
                onClick={() => cambiarTema(TEMA_V2)}
            >
                {compacto ? 'Nuevo' : 'Tema nuevo'}
            </button>
            <button
                type="button"
                className={!esV2 ? 'is-on' : ''}
                aria-pressed={!esV2}
                onClick={() => cambiarTema(TEMA_CLASICO)}
            >
                {compacto ? 'Clásico' : 'Tema viejo'}
            </button>
        </div>
    );
};

const iniciales = (user) => `${user?.user_name?.[0] || ''}${user?.user_lastname?.[0] || ''}`.toUpperCase() || 'U';

// Etiquetas cortas para el dock del celular (una sola línea por destino).
const ETIQUETA_DOCK = {
    dashboard: 'Inicio',
    ambientes: 'Salones',
    novedad_historial: 'Novedades',
    novedad_form: 'Reportar',
    escanear_acceso: 'Acceso',
    qr_carnet: 'Carnet',
    historial: 'Historial',
    users: 'Usuarios',
    equipos: 'Equipos',
    validar_qr: 'Validar',
    mis_equipos: 'Equipos',
    comprobantes: 'Equipos',
    permisos: 'Permisos',
    excusas: 'Excusas',
    acceso_qr: 'QR',
    escanear_carnet: 'Carnet',
    presentes: 'Presentes',
    directorio: 'Directorio',
    historial_equipos: 'Equipos',
    equipo_entry: 'Registrar',
};

// Cáscara del tema nuevo: barra superior de escritorio + dock inferior en
// celular + hoja "Más". Sustituye al navbar clásico cuando body.tema-v2 está
// activo (Navbar.jsx decide cuál montar).
const ShellV2 = ({ currentUser, view, setView, userFilter, setUserFilter, links = [], primaryViews = [] }) => {
    const navigate = useNavigate();
    const { esV2, cambiarTema } = useTema();
    const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains('light-mode'));
    const [notifOpen, setNotifOpen] = useState(false);
    const [menuAbierto, setMenuAbierto] = useState(null);
    const [hoja, setHoja] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const notifRef = useRef(null);
    const notifMovilRef = useRef(null);
    const navRef = useRef(null);

    const rol = currentUser?.role?.rol_name || 'Usuario';
    const rolKey = rol.toLowerCase();

    const plano = links
        .filter((l) => !l.dropdown)
        .map((l) => ({ ...l, grupo: null }));

    const hijosDropdown = links
        .filter((l) => l.dropdown)
        .flatMap((l) => (l.items || [])
            .filter((i) => !i.divider)
            .map((i) => ({ ...i, grupo: l.label })));

    const todos = [...plano, ...hijosDropdown];

    // Primarias: las que indique el panel; si no, las primeras cuatro.
    const primariasIds = primaryViews.length ? primaryViews : plano.slice(0, 4).map((l) => l.view);

    const primarias = primariasIds
        .map((v) => todos.find((l) => l.view === v))
        .filter(Boolean);

    const primariasViews = new Set(primariasIds);
    // Los hijos de un menú primario (p. ej. Novedades) no se repiten en "Más".
    const hijosDePrimarias = links
        .filter((l) => l.dropdown && primariasViews.has(l.view))
        .flatMap((l) => (l.items || []).map((i) => i.view));

    // Todo lo que no es primario ni la acción principal vive en "Más".
    const secundarias = todos.filter(
        (l) => !primariasViews.has(l.view) && !hijosDePrimarias.includes(l.view)
    );

    // Acción principal del rol: un solo botón lleno por pantalla.
    const cta = ({
        superadmin: { label: 'Escanear carnet', icon: 'qr_code_scanner', view: 'escanear_carnet' },
        admin: { label: 'Validar QR', icon: 'qr_code_scanner', view: 'validar_qr' },
        portero: { label: 'Validar QR', icon: 'qr_code_scanner', view: 'validar_qr' },
        instructor: { label: 'Marcar acceso', icon: 'qr_code_scanner', view: 'escanear_acceso' },
        aprendiz: { label: 'Marcar acceso', icon: 'qr_code_scanner', view: 'escanear_acceso' },
    })[rolKey];

    // Menú de escritorio: primarias visibles + "Más" con el resto. Así la barra
    // nunca se desborda ni se monta sobre las acciones del perfil.
    const enBarra = links.filter((l) => primariasViews.has(l.view) && l.view !== cta?.view);
    const menuSecundario = secundarias.filter((l) => l.view !== cta?.view);
    const navItems = menuSecundario.length
        ? [...enBarra, { label: 'Más', icon: 'apps', dropdown: true, items: menuSecundario }]
        : enBarra;

    const fetchNotifications = async () => {
        try {
            const [listResponse, countResponse] = await Promise.all([
                axios.get('/api/notifications'),
                axios.get('/api/notifications/unread-count'),
            ]);
            setNotifications(listResponse.data);
            setUnread(countResponse.data.unread || 0);
        } catch (_) {
            /* sin sesión o sin red: la campana queda vacía */
        }
    };

    useEffect(() => {
        fetchNotifications();
        const id = setInterval(fetchNotifications, 60000);
        return () => clearInterval(id);
    }, []);

    // Cierra menús al hacer clic fuera o con Escape.
    useEffect(() => {
        const alClic = (e) => {
            const dentro = (ref) => !!(ref.current && ref.current.contains(e.target));
            if (!dentro(notifRef) && !dentro(notifMovilRef)) setNotifOpen(false);
            if (navRef.current && !navRef.current.contains(e.target)) setMenuAbierto(null);
        };
        const alTeclear = (e) => {
            if (e.key === 'Escape') {
                setNotifOpen(false);
                setMenuAbierto(null);
                setHoja(false);
            }
        };
        document.addEventListener('mousedown', alClic);
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('mousedown', alClic);
            document.removeEventListener('keydown', alTeclear);
        };
    }, []);

    const toggleTema = () => {
        const claro = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', claro);
        localStorage.setItem('theme', claro ? 'light' : 'dark');
        setTemaClaro(claro);
        window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: claro ? 'light' : 'dark' } }));
    };

    const irA = (link) => {
        if (!link) return;
        if (link.onClick) link.onClick();
        if (link.view) setView(link.view);
        if (link.filter && setUserFilter) setUserFilter(link.filter);
        setMenuAbierto(null);
        setHoja(false);
    };

    const handleMarkRead = async (id) => {
        try {
            await axios.put(`/api/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => (n.id_notificacion === id ? { ...n, is_read: true } : n)));
            setUnread((prev) => Math.max(0, prev - 1));
        } catch (_) { /* se reintenta en el siguiente refresco */ }
    };

    const handleMarkAllRead = async () => {
        try {
            await axios.put('/api/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnread(0);
        } catch (_) { /* idem */ }
    };

    const handleLogout = async () => {
        try {
            await axios.post('/api/logout');
        } catch (_) {
            /* la sesión local se limpia igual */
        }
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        navigate('/');
    };

    const activo = (link) => link.view && link.view === view;
    const padreActivo = (link) => (link.items || []).some((i) => i.view && i.view === view);
    const foto = currentUser?.profile_photo_path;

    return (
        <>
            <header className="v2-topbar">
                <div className="v2-topbar-inner">
                    <button type="button" className="v2-brand" onClick={() => setView('dashboard')} title="Ir al inicio">
                        <img src="/Icons/logoSena.png" alt="SENA" />
                        <span className="v2-brand-text">
                            <span className="v2-brand-name">SENA <b>Access</b></span>
                            <span className="v2-role">{rol} · Panel</span>
                        </span>
                    </button>

                    <div className="v2-sep d-none d-lg-block" aria-hidden="true" />

                    <nav className="v2-nav" aria-label="Principal" ref={navRef}>
                        {navItems.map((link, index) => {
                            if (link.dropdown) {
                                const abierto = menuAbierto === index;
                                return (
                                    <div className="v2-nav-group" key={`g-${index}`}>
                                        <button
                                            type="button"
                                            className={`v2-nav-item ${padreActivo(link) ? 'is-active' : ''}`}
                                            aria-expanded={abierto}
                                            onClick={() => setMenuAbierto(abierto ? null : index)}
                                        >
                                            <span className="material-symbols-outlined">{link.icon}</span>
                                            {link.label}
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', opacity: 0.6 }}>expand_more</span>
                                        </button>
                                        {abierto && (
                                            <div className="v2-pop" role="menu">
                                                {(link.items || []).filter((i) => !i.divider).map((item, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        role="menuitem"
                                                        className="v2-pop-item"
                                                        onClick={() => irA(item)}
                                                    >
                                                        <span className="material-symbols-outlined">{item.icon}</span>
                                                        {item.label}
                                                    </button>
                                                ))}
                                                {link.label === 'Más' && (
                                                    <>
                                                        <div className="v2-pop-sep" role="separator" />
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="v2-pop-item"
                                                            onClick={() => cambiarTema(TEMA_V2)}
                                                        >
                                                            <span className="material-symbols-outlined">{esV2 ? 'check' : 'palette'}</span>
                                                            Tema nuevo
                                                        </button>
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="v2-pop-item"
                                                            onClick={() => cambiarTema(TEMA_CLASICO)}
                                                        >
                                                            <span className="material-symbols-outlined">{esV2 ? 'palette' : 'check'}</span>
                                                            Tema viejo
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return (
                                <button
                                    type="button"
                                    key={`l-${index}`}
                                    className={`v2-nav-item ${activo(link) ? 'is-active' : ''}`}
                                    onClick={() => irA(link)}
                                    aria-current={activo(link) ? 'page' : undefined}
                                >
                                    <span className="material-symbols-outlined">{link.icon}</span>
                                    {link.label}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="v2-actions">
                        <div className="v2-sep" aria-hidden="true" />

                        <TemaSwitch compacto />

                        <button
                            type="button"
                            className="v2-icon-btn"
                            onClick={toggleTema}
                            data-tema-claro="1"
                            title={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
                            aria-label={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
                        >
                            <span className="material-symbols-outlined">{temaClaro ? 'dark_mode' : 'light_mode'}</span>
                        </button>

                        <div style={{ position: 'relative' }} ref={notifRef}>
                            <button
                                type="button"
                                className="v2-icon-btn"
                                title="Notificaciones"
                                aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
                                onClick={() => {
                                    fetchNotifications();
                                    setNotifOpen((v) => !v);
                                }}
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                {unread > 0 && <span className="v2-count">{unread > 9 ? '9+' : unread}</span>}
                            </button>
                            {notifOpen && (
                                <div className="v2-notif" role="dialog" aria-label="Notificaciones">
                                    <div className="v2-notif-head">
                                        <strong>Notificaciones</strong>
                                        {unread > 0 && (
                                            <button type="button" className="v2-btn v2-btn--quiet v2-btn--sm" onClick={handleMarkAllRead}>
                                                Marcar todas
                                            </button>
                                        )}
                                    </div>
                                    {notifications.length > 0 ? notifications.map((n) => (
                                        <button
                                            type="button"
                                            key={n.id_notificacion}
                                            className={`v2-notif-item ${n.is_read ? '' : 'is-new'}`}
                                            onClick={() => handleMarkRead(n.id_notificacion)}
                                        >
                                            <strong>{n.notification_title}</strong>
                                            <span>{n.notification_body}</span>
                                            <time>{new Date(n.created_at).toLocaleString()}</time>
                                        </button>
                                    )) : (
                                        <div className="v2-empty">
                                            <span className="material-symbols-outlined">notifications_off</span>
                                            No tienes notificaciones
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {cta && view !== cta.view && (
                            <button type="button" className="v2-btn v2-btn--primary v2-btn--sm v2-cta" onClick={() => setView(cta.view)} title={cta.label} aria-label={cta.label}>
                                <span className="material-symbols-outlined">{cta.icon}</span>
                                <span className="v2-cta-label">{cta.label}</span>
                            </button>
                        )}

                        <button type="button" className="v2-user" onClick={() => setView('profile')} title="Mi perfil">
                            <span className="v2-avatar">
                                {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : iniciales(currentUser)}
                            </span>
                            <span className="v2-user-meta">
                                <span className="v2-user-name">{currentUser?.user_name} {currentUser?.user_lastname}</span>
                                <span className="v2-user-role">{rol}</span>
                            </span>
                        </button>

                        <button type="button" className="v2-icon-btn v2-icon-btn--danger" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>

                    {/* Barra compacta de celular */}
                    <div className="v2-topbar-mobile">
                        <div style={{ position: 'relative' }} ref={notifMovilRef}>
                            <button
                                type="button"
                                className="v2-icon-btn"
                                aria-label="Notificaciones"
                                onClick={() => {
                                    fetchNotifications();
                                    setNotifOpen((v) => !v);
                                }}
                            >
                                <span className="material-symbols-outlined">notifications</span>
                                {unread > 0 && <span className="v2-count">{unread > 9 ? '9+' : unread}</span>}
                            </button>
                            {notifOpen && (
                                <div className="v2-notif" role="dialog" aria-label="Notificaciones">
                                    <div className="v2-notif-head">
                                        <strong>Notificaciones</strong>
                                        {unread > 0 && (
                                            <button type="button" className="v2-btn v2-btn--quiet v2-btn--sm" onClick={handleMarkAllRead}>
                                                Marcar todas
                                            </button>
                                        )}
                                    </div>
                                    {notifications.length > 0 ? notifications.map((n) => (
                                        <button
                                            type="button"
                                            key={n.id_notificacion}
                                            className={`v2-notif-item ${n.is_read ? '' : 'is-new'}`}
                                            onClick={() => handleMarkRead(n.id_notificacion)}
                                        >
                                            <strong>{n.notification_title}</strong>
                                            <span>{n.notification_body}</span>
                                            <time>{new Date(n.created_at).toLocaleString()}</time>
                                        </button>
                                    )) : (
                                        <div className="v2-empty">
                                            <span className="material-symbols-outlined">notifications_off</span>
                                            Sin notificaciones
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button type="button" className="v2-icon-btn" onClick={() => setView('profile')} aria-label="Mi perfil">
                            <span className="v2-avatar" style={{ width: 28, height: 28 }}>
                                {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : iniciales(currentUser)}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Dock: cuatro destinos + Más */}
            <nav className="v2-dock" aria-label="Navegación principal en el celular">
                {primarias.map((link, index) => (
                    <button
                        type="button"
                        key={`d-${index}`}
                        className={`v2-dock-item ${activo(link) ? 'is-active' : ''}`}
                        onClick={() => irA(link)}
                        aria-current={activo(link) ? 'page' : undefined}
                    >
                        <span className="material-symbols-outlined">{link.icon}</span>
                        {ETIQUETA_DOCK[link.view] || link.label}
                    </button>
                ))}
                <button type="button" className="v2-dock-item" onClick={() => setHoja(true)} aria-label="Más opciones">
                    <span className="material-symbols-outlined">apps</span>
                    Más
                </button>
            </nav>

            {hoja && (
                <div className="v2-sheet-scrim" onClick={() => setHoja(false)}>
                    <div className="v2-sheet" role="dialog" aria-modal="true" aria-label="Más opciones" onClick={(e) => e.stopPropagation()}>
                        <div className="v2-sheet-handle" />
                        <div className="v2-sheet-title">Mi cuenta</div>
                        <button type="button" className="v2-sheet-item" onClick={() => setView('profile')}>
                            <span className="material-symbols-outlined">person</span>
                            Mi perfil
                            <span className="material-symbols-outlined v2-sheet-chev">chevron_right</span>
                        </button>

                        <div className="v2-sheet-title">Ir a</div>
                        {secundarias.map((link, index) => (
                            <button
                                type="button"
                                key={`s-${index}`}
                                className={`v2-sheet-item ${activo(link) ? 'is-active' : ''}`}
                                onClick={() => irA(link)}
                            >
                                <span className="material-symbols-outlined">{link.icon}</span>
                                {link.label}
                                {link.grupo && <span className="v2-muted" style={{ fontSize: '0.7rem', marginLeft: 2 }}>· {link.grupo}</span>}
                                <span className="material-symbols-outlined v2-sheet-chev">chevron_right</span>
                            </button>
                        ))}

                        <div className="v2-sheet-tema">
                            <span>Sistema visual</span>
                            <TemaSwitch compacto />
                        </div>
                        <button
                            type="button"
                            className="v2-sheet-item"
                            onClick={() => {
                                setHoja(false);
                                window.setTimeout(() => window.dispatchEvent(new CustomEvent('abrir-chatbot')), 220);
                            }}
                        >
                            <span className="material-symbols-outlined">smart_toy</span>
                            Asistente
                            <span className="material-symbols-outlined v2-sheet-chev">chevron_right</span>
                        </button>
                        <button type="button" className="v2-sheet-item" onClick={toggleTema}>
                            <span className="material-symbols-outlined">{temaClaro ? 'dark_mode' : 'light_mode'}</span>
                            {temaClaro ? 'Modo oscuro' : 'Modo claro'}
                        </button>
                        <button type="button" className="v2-sheet-item" onClick={handleLogout} style={{ color: '#ff9b9b' }}>
                            <span className="material-symbols-outlined" style={{ color: '#ff9b9b' }}>logout</span>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ShellV2;
