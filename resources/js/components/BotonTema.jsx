import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Boton de tema claro/oscuro para las paginas publicas (acceso, registro,
// recuperacion, 2FA, huella, 404). Se dibuja con un portal en <body> para que
// quede siempre en la esquina superior derecha de la PANTALLA: la tarjeta
// (.glass-box) usa backdrop-filter y eso atrapa a los hijos position:fixed.
// Con fijo={false} se dibuja en linea, como en la cabecera de la puerta.
const BotonTema = ({ fijo = true }) => {
    const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains('light-mode'));

    useEffect(() => {
        const alCambiar = (evento) => setTemaClaro(evento.detail?.tema === 'light');
        window.addEventListener('tema-cambiado', alCambiar);
        return () => window.removeEventListener('tema-cambiado', alCambiar);
    }, []);

    const toggleTema = () => {
        const claro = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', claro);
        localStorage.setItem('theme', claro ? 'light' : 'dark');
        setTemaClaro(claro);
        window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: claro ? 'light' : 'dark' } }));
    };

    const boton = (
        <button
            type="button"
            className="auth-theme-btn"
            onClick={toggleTema}
            title={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
            aria-label={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
            <span className="material-symbols-outlined">
                {temaClaro ? 'dark_mode' : 'light_mode'}
            </span>
        </button>
    );

    if (!fijo) return boton;
    return createPortal(boton, document.body);
};

export default BotonTema;
