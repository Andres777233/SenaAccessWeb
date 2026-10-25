import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificacionesMenu from './NotificacionesMenu';

// Navbar del panel con el diseño del repositorio de referencia: una sola fila,
// marca + badge del rol, enlaces en mayusculas, y a la derecha la campana, el
// perfil y salir. El cambio de tema vive en el boton flotante de la esquina.
const Navbar = ({ currentUser, view, setView, userFilter, setUserFilter, links = [] }) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await axios.post('/api/logout');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('sena_usuario');
            navigate('/');
        } catch (error) {
            console.error('Error al cerrar sesión', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('sena_usuario');
            navigate('/');
        }
    };

    // En celular el menú colapsado debe cerrarse al elegir una vista
    // (antes quedaba abierto tapando la pantalla).
    const cerrarMenu = () => {
        if (window.innerWidth >= 992) return;
        const menu = document.getElementById('navbarMain');
        if (!menu) return;
        try {
            if (window.bootstrap?.Collapse) {
                window.bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false }).hide();
            } else {
                menu.classList.remove('show');
            }
        } catch (_) {
            menu.classList.remove('show');
        }
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-custom">
            <div className="container-fluid p-0">
                {/* Botón colapsable para móviles */}
                <button className="navbar-toggler border-success border-opacity-25" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
                    <span className="material-symbols-outlined text-success">menu</span>
                </button>

                {/* Logo compacto visible solo con el menú colapsado (móvil/tablet) */}
                <div className="d-lg-none d-flex align-items-center gap-2 ms-2">
                    <img src="/Icons/logoSena.png" alt="SENA" style={{ height: '30px' }} />
                    <span className="fw-bold text-nowrap" style={{ letterSpacing: '1px', fontSize: '0.92rem' }}>
                        SENA <span className="text-success">ACCESS</span>
                    </span>
                </div>

                {/* Salir siempre visible: el de adentro queda oculto con el menú colapsado */}
                <button className="btn-logout-minimal d-lg-none ms-auto" onClick={handleLogout} title="Cerrar Sesión">
                    <span className="material-symbols-outlined">logout</span>
                </button>

                <div className="collapse navbar-collapse" id="navbarMain">
                    {/* Marca (en escritorio) */}
                    <div className="navbar-brand-wrap d-none d-lg-flex align-items-center gap-3">
                        <img src="/Icons/logoSena.png" alt="SENA" style={{ height: '40px' }} />
                        <div>
                            <h5 className="mb-0 fw-bold" style={{ letterSpacing: '1px' }}>SENA <span className="text-success neon-text">ACCESS</span></h5>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-10" style={{ fontSize: '0.6rem' }}>
                                {currentUser?.role?.rol_name?.toUpperCase() || 'USER'} PANEL
                            </span>
                        </div>
                    </div>

                    {/* Enlaces de Navegación Dinámicos */}
                    <ul className={`navbar-nav me-auto mb-2 mb-lg-0 gap-2 ${links.length > 6 ? 'nav-compacto' : ''}`}>
                        {links.map((link, index) => {
                            if (link.dropdown) {
                                const hijoActivo = (link.items || []).some(item => item.view && item.view === view);
                                return (
                                    <li key={index} className="nav-item dropdown">
                                        <button
                                            className={`nav-item-link dropdown-toggle ${hijoActivo ? 'active' : ''}`}
                                            type="button"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                        >
                                            <span className="material-symbols-outlined small me-1">{link.icon}</span> {link.label}
                                        </button>
                                        <ul className="dropdown-menu glass-box border-success border-opacity-25 shadow-lg">
                                            {link.items.map((item, idx) => (
                                                <li key={idx}>
                                                    {item.divider ? (
                                                        <hr className="dropdown-divider border-success border-opacity-10" />
                                                    ) : (
                                                        <button
                                                            className="dropdown-item py-2 d-flex align-items-center gap-2"
                                                            onClick={() => {
                                                                if (item.onClick) item.onClick();
                                                                if (item.view) setView(item.view);
                                                                if (item.filter && setUserFilter) setUserFilter(item.filter);
                                                                cerrarMenu();
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined small">{item.icon}</span> {item.label}
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                );
                            }
                            return (
                                <li key={index} className="nav-item">
                                    <button
                                        className={`nav-item-link ${view === link.view ? 'active' : ''}`}
                                        onClick={() => {
                                            setView(link.view);
                                            if (link.filter && setUserFilter) setUserFilter(link.filter);
                                            cerrarMenu();
                                        }}
                                    >
                                        <span className="material-symbols-outlined small me-1">{link.icon}</span> {link.label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Derecha: campana, perfil y salir */}
                    <div className="navbar-actions d-flex align-items-center justify-content-lg-end gap-2 pt-2 pt-lg-0 border-top border-success border-opacity-10">
                        <NotificacionesMenu />

                        <div className="vr d-none d-lg-block opacity-25" style={{ height: '30px' }}></div>

                        <div
                            className="profile-nav-trigger d-flex align-items-center gap-2 cursor-pointer p-1 px-2 rounded-pill hover-bg"
                            onClick={() => { setView('profile'); cerrarMenu(); }}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <div className="text-end d-md-block">
                                <p className="mb-0 fw-bold small text-truncate" style={{ maxWidth: '150px' }}>{currentUser?.user_name}</p>
                                <p className="mb-0 opacity-50" style={{ fontSize: '0.65rem' }}>{currentUser?.role?.rol_name}</p>
                            </div>
                            <div className="rounded-circle bg-success d-flex align-items-center justify-content-center shadow-sm border border-2 border-success border-opacity-25 overflow-hidden" style={{ width: '38px', height: '38px', fontSize: '0.9rem', fontWeight: 'bold', color: '#000' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{currentUser?.user_name?.[0]}{currentUser?.user_lastname?.[0]}</>
                                )}
                            </div>
                        </div>

                        <div className="vr d-none d-lg-block opacity-25" style={{ height: '30px' }}></div>

                        <button className="btn-logout-minimal d-none d-lg-flex" onClick={handleLogout} title="Cerrar Sesión">
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
