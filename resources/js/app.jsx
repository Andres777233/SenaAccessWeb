import './bootstrap';
import '../css/app.css';

import React, { Suspense, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

import Login from './components/Login';
import Register from './components/Register';
import PasswordRecovery from './components/PasswordRecovery';
import ResetPassword from './components/ResetPassword';
import Fingerprint from './components/Fingerprint';
import Loading from './components/Loading';
import LandingPage from './components/LandingPage';
import CustomAlert from './components/CustomAlert';
import Admin from './components/Admin';
import Aprendiz from './components/Aprendiz';
import Instructor from './components/Instructor';

// Guard: redirige a /login si no hay token o el rol no coincide con el esperado.
const ProtectedRoute = ({ expectedRole, children }) => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role')?.toLowerCase();
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    if (expectedRole && role !== expectedRole) {
        return <Navigate to="/" replace />;
    }
    return children;
};

console.log("Iniciando aplicación React...");
// Componente principal de la aplicación
const LogoutHandler = () => {
    const location = useLocation();
    useEffect(() => {
        if (location.search === '?logout=1') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            window.history.replaceState({}, document.title, '/');
        }
    }, [location]);
    return null;
};

const App = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    // Entradas/Salidas en tiempo real:
    // - El login ya registra Entrada y el logout Salida (backend).
    // - Al cerrar la ÚLTIMA pestaña/app se dispara POST /api/session-exit
    //   (fetch keepalive en pagehide, sobrevive al cierre de la página).
    // - Si el "cierre" era un refresh (F5), al recargar se revierte con
    //   POST /api/session-exit/cancel para que no cuente como salida.
    useEffect(() => {
        const TABS_KEY = 'senaaccess_open_tabs';
        const token = localStorage.getItem('access_token');

        const contarTab = (delta) => {
            const n = Math.max(0, (parseInt(localStorage.getItem(TABS_KEY) || '0', 10) || 0) + delta);
            localStorage.setItem(TABS_KEY, String(n));
            return n;
        };

        contarTab(1);

        // Si la carga proviene de un refresh, revertimos la salida falsa registrada al descargar.
        let navType = '';
        try {
            navType = performance.getEntriesByType('navigation')[0]?.type || '';
        } catch (e) { /* navegadores antiguos */ }
        if (navType === 'reload' && token) {
            fetch('/api/session-exit/cancel', {
                method: 'POST',
                keepalive: true,
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            }).catch(() => {});
        }

        const handlePageHide = () => {
            const tk = localStorage.getItem('access_token');
            if (!tk) return;
            // Solo el último tab abierto registra la salida.
            if (contarTab(-1) > 0) return;
            fetch('/api/session-exit', {
                method: 'POST',
                keepalive: true,
                headers: { 'Authorization': `Bearer ${tk}`, 'Accept': 'application/json' }
            }).catch(() => {});
        };

        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
            contarTab(-1);
        };
    }, []);

    // Efecto para aplicar el tema seleccionado y guardarlo en localStorage
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Función para alternar entre temas
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    console.log("Renderizando componente App...");
    return (
        <BrowserRouter>
            <LogoutHandler />
            {/* Botón de Modo Claro/Oscuro */}
            <button 
                onClick={toggleTheme}
                className="theme-toggle-btn"
                aria-label="Toggle theme"
            >
                <span className="material-symbols-outlined">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
            </button>

            {/* Alerta y Confirmación Personalizada Global */}
            <CustomAlert />

            <div style={{color: 'var(--text-color)', position: 'fixed', bottom: 10, right: 10, background: 'var(--glass-bg)', padding: '5px', zIndex: 9999, borderRadius: '5px', fontSize: '12px'}}>
            </div>
            <Suspense fallback={<div className="text-white text-center mt-5">Cargando componentes...</div>}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/password-recovery" element={<PasswordRecovery />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/fingerprint" element={<Fingerprint />} />
                    <Route path="/loading" element={<Loading />} />
                    <Route path="/admin" element={<ProtectedRoute expectedRole="admin"><Admin /></ProtectedRoute>} />
                    <Route path="/aprendiz" element={<ProtectedRoute expectedRole="aprendiz"><Aprendiz /></ProtectedRoute>} />
                    <Route path="/instructor" element={<ProtectedRoute expectedRole="instructor"><Instructor /></ProtectedRoute>} />
                    <Route path="*" element={<div style={{color: 'var(--text-color)'}}>404 - Página no encontrada</div>} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
};

const rootElement = document.getElementById('app');
if (rootElement) {
    console.log("Elemento #app encontrado. Montando...");
    try {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
        console.log("Montado ejecutado sin errores inmediatos.");
    } catch (err) {
        console.error("Error durante el renderizado de App.jsx", err);
    }
} else {
    console.error("No se encontró el elemento \"app\" en el DOM.");
}
