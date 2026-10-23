import React from 'react';
import { useLocation } from 'react-router-dom';
import { TemaSwitch } from './ShellV2';

// Interruptor "Tema nuevo / Tema viejo" en las páginas públicas (landing,
// login, registro, recuperación, 2FA y huella). En los paneles el interruptor
// vive en la barra superior, así que aquí se oculta.
const PANELES = ['/admin', '/aprendiz', '/instructor', '/portero'];

const TemaFlotante = () => {
    const { pathname } = useLocation();
    const tieneSesion = !!localStorage.getItem('access_token');
    const enPanel = PANELES.some((ruta) => pathname.startsWith(ruta));

    if ((tieneSesion && enPanel) || pathname === '/puerta-acceso') return null;

    return (
        <div className="tema-flotante">
            <TemaSwitch compacto />
        </div>
    );
};

export default TemaFlotante;
