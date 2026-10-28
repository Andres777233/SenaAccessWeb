import './bootstrap';
import '../css/app.css';
import '../css/acceso.css';

import React, { Suspense, lazy, useState, useEffect, Component } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { normalizarRol, rutaPorRol, estaDentroHoy, limpiarSesionLocal } from './utils/sesion';

import Login from './components/Login';
import Verificacion2Fa from './components/Verificacion2Fa';
import Register from './components/Register';
import PasswordRecovery from './components/PasswordRecovery';
import ResetPassword from './components/ResetPassword';
import Loading from './components/Loading';
import LandingPage from './components/LandingPage';
import CustomAlert from './components/CustomAlert';
import ChatbotWidget from './components/ChatbotWidget';
import PuertaAcceso from './components/PuertaAcceso';
import HuellaSimulacion from './components/HuellaSimulacion';
import NotFound from './components/NotFound';
// Paneles pesados por rol: lazy para que la primera carga solo baje el chunk
// de la ruta visitada (antes las 12 rutas viajaban en un solo app-*.js).
const Admin = lazy(() => import('./components/Admin'));
const Aprendiz = lazy(() => import('./components/Aprendiz'));
const Instructor = lazy(() => import('./components/Instructor'));
const Portero = lazy(() => import('./components/Portero'));

// Guard: redirige a /login si no hay token o el rol no coincide con el esperado.
// El rol se lee en cada render (no al montar App) y se normaliza para aceptar
// los nombres viejos de porteria.
const ProtectedRoute = ({ expectedRole, children }) => {
    const token = localStorage.getItem('access_token');
    const role = normalizarRol(localStorage.getItem('user_role'));
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    if (expectedRole && role !== expectedRole) {
        const destino = rutaPorRol(role);
        return <Navigate to={destino === '/login' ? '/' : destino} replace />;
    }
    return children;
};

// Ruta publica del reto 2FA: un reto pendiente manda sobre cualquier token
// viejo que haya quedado en el navegador (antes una sesion de admin enviaba
// a /admin en vez de mostrar la verificacion).
const Verificacion2FaRoute = () => {
    const challenge = localStorage.getItem('2fa_challenge_id');
    if (challenge) {
        return <Verificacion2Fa />;
    }
    const token = localStorage.getItem('access_token');
    const role = normalizarRol(localStorage.getItem('user_role'));
    if (token) {
        const destino = rutaPorRol(role);
        return <Navigate to={destino === '/login' ? '/' : destino} replace />;
    }
    return <Verificacion2Fa />;
};

// La ruta de la puerta se evalúa en un componente: antes el <Navigate> se
// creaba al montar App (sin token) y rebotaba al login justo después del login.
const PuertaAccesoRoute = () => {
    const token = localStorage.getItem('access_token');
    return token ? <PuertaAcceso /> : <Navigate to="/login" replace />;
};

// Aprendiz e instructor no pueden saltarse la puerta abriendo /aprendiz o
// /instructor directamente (o refrescando): si no están dentro, vuelven a la
// puerta. La regla la decide el servidor con entrada_hoy + dentro.
const RequiereEntrada = ({ children }) => {
    const [estado, setEstado] = useState('verificando');

    useEffect(() => {
        let vigente = true;
        axios.get('/api/acceso/estado')
            .then(({ data }) => {
                if (vigente) setEstado(estaDentroHoy(data) ? 'dentro' : 'fuera');
            })
            .catch(() => {
                if (vigente) setEstado('fuera');
            });
        return () => { vigente = false; };
    }, []);

    if (estado === 'verificando') {
        return (
            <div className="app-cargando">
                <div className="spinner-border text-success" role="status" />
                <p className="mb-0">Verificando tu entrada...</p>
            </div>
        );
    }
    if (estado === 'fuera') {
        return <Navigate to="/puerta-acceso" replace />;
    }
    return children;
};

// Mantiene sincronizadas las pestañas: si en otra pestaña se inicia sesión
// con otro rol o se cierra sesión, esta no puede quedarse en el panel viejo.
// También cubre el botón Atrás del navegador cuando restaura desde bfcache.
const SessionSync = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const alCambiarSesion = (evento) => {
            if (evento.key !== null && !['access_token', 'user_role', '2fa_challenge_id'].includes(evento.key)) {
                return;
            }
            const token = localStorage.getItem('access_token');
            if (!token) {
                navigate('/login', { replace: true });
                return;
            }
            const role = normalizarRol(localStorage.getItem('user_role'));
            const panel = window.location.pathname.split('/')[1];
            if (panel === 'admin' && role !== 'superadmin') {
                navigate(rutaPorRol(role), { replace: true });
            } else if (panel === 'aprendiz' && role !== 'aprendiz') {
                navigate(rutaPorRol(role), { replace: true });
            } else if (panel === 'instructor' && role !== 'instructor') {
                navigate(rutaPorRol(role), { replace: true });
            } else if (panel === 'portero' && role !== 'admin') {
                navigate(rutaPorRol(role), { replace: true });
            }
        };
        const alVolverDelCache = (evento) => {
            if (evento.persisted) window.location.reload();
        };
        window.addEventListener('storage', alCambiarSesion);
        window.addEventListener('pageshow', alVolverDelCache);
        return () => {
            window.removeEventListener('storage', alCambiarSesion);
            window.removeEventListener('pageshow', alVolverDelCache);
        };
    }, [navigate]);

    return null;
};

// Componente principal de la aplicación
const LogoutHandler = () => {
    const location = useLocation();
    useEffect(() => {
        if (location.search === '?logout=1') {
            limpiarSesionLocal();
            window.history.replaceState({}, document.title, '/');
        }
    }, [location]);
    return null;
};

// El chatbot no debe tapar la puerta de acceso ni la simulacion de huella.
const ChatbotGate = () => {
    const location = useLocation();
    const oculto = ['/puerta-acceso', '/huella', '/login'].includes(location.pathname);
    return (!oculto && !!localStorage.getItem('access_token')) ? <ChatbotWidget /> : null;
};

// Los paneles son lazy: tras un deploy el chunk viejo puede faltar y React
// deja la pantalla vacia. Si es un error de chunk, recarga una sola vez.
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        const mensaje = String(error?.message || '');
        if (/ChunkLoadError|Loading chunk|dynamically imported module/i.test(mensaje)) {
            const clave = 'recarga_chunk:' + window.location.pathname;
            if (!sessionStorage.getItem(clave)) {
                sessionStorage.setItem(clave, '1');
                window.location.reload();
            }
        }
    }

    render() {
        if (this.state.error) {
            return (
                <div className="auth-page">
                    <main className="auth-main">
                        <div className="glass-box auth-card text-center" style={{ maxWidth: '440px' }}>
                            <span className="material-symbols-outlined text-warning" style={{ fontSize: '48px' }}>refresh</span>
                            <h4 className="fw-bold mt-2">No se pudo cargar la pantalla</h4>
                            <p className="small opacity-75">Actualiza la página para continuar.</p>
                            <button type="button" className="btn btn-glow btn-primary-login w-100 fw-bold py-3 mt-3" onClick={() => window.location.reload()}>
                                RECARGAR
                            </button>
                        </div>
                    </main>
                </div>
            );
        }
        return this.props.children;
    }
}

const App = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    // Efecto para aplicar el tema seleccionado y guardarlo en localStorage
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Los botones de las pantallas de acceso avisan el cambio de tema: este
    // aviso mantiene el boton flotante sincronizado sin recargar la pagina.
    useEffect(() => {
        const alCambiarTema = (evento) => setTheme(evento.detail?.tema || 'dark');
        window.addEventListener('tema-cambiado', alCambiarTema);
        return () => window.removeEventListener('tema-cambiado', alCambiarTema);
    }, []);

    // Funcion para alternar entre temas desde el boton flotante
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <BrowserRouter>
            <LogoutHandler />
            <SessionSync />
            {/* Boton de modo claro/oscuro: flotante a la derecha, debajo de la
                barra. En las pantallas de acceso lo dibuja BotonTema. */}
            <button
                type="button"
                onClick={toggleTheme}
                className="theme-toggle-btn"
                aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
                title={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            >
                <span className="material-symbols-outlined">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
            </button>
            {/* Capas globales (alerta, chatbot, campana/tema): dentro del
                ErrorBoundary para que un fallo aqui no desmonte la app entera
                y deje la pantalla en blanco. */}
            <ErrorBoundary>
                {/* Alerta y Confirmación Personalizada Global */}
                <CustomAlert />

                {/* Chatbot flotante: visible solo con sesión y fuera de las pantallas de acceso */}
                <ChatbotGate />
            </ErrorBoundary>

            <div style={{color: 'var(--text-color)', position: 'fixed', bottom: 10, right: 10, background: 'var(--glass-bg)', padding: '5px', zIndex: 9999, borderRadius: '5px', fontSize: '12px'}}>
            </div>
            <ErrorBoundary>
            <Suspense fallback={<div className="app-cargando"><div className="spinner-border text-success" role="status" /><p className="mb-0">Cargando panel...</p></div>}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/verificacion-2fa" element={<Verificacion2FaRoute />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/password-recovery" element={<PasswordRecovery />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/loading" element={<Loading />} />
                    <Route path="/huella" element={<HuellaSimulacion />} />
                    <Route path="/puerta-acceso" element={<PuertaAccesoRoute />} />
                    <Route path="/admin" element={<ProtectedRoute expectedRole="superadmin"><Admin /></ProtectedRoute>} />
                    <Route path="/aprendiz" element={<ProtectedRoute expectedRole="aprendiz"><RequiereEntrada><Aprendiz /></RequiereEntrada></ProtectedRoute>} />
                    <Route path="/instructor" element={<ProtectedRoute expectedRole="instructor"><RequiereEntrada><Instructor /></RequiereEntrada></ProtectedRoute>} />
                    <Route path="/portero" element={<ProtectedRoute expectedRole="admin"><Portero /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
            </ErrorBoundary>
        </BrowserRouter>
    );
};

const rootElement = document.getElementById('app');
if (rootElement) {
    try {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } catch (err) {
        console.error("Error durante el renderizado de App.jsx", err);
    }
} else {
    console.error("No se encontró el elemento \"app\" en el DOM.");
}
