import { useEffect, useState } from 'react';

// Interruptor de sistema visual: "v2" (tema nuevo) o "clasico" (tema viejo).
// El tema vive en localStorage y se aplica con la clase body.tema-v2, asi el
// CSS anterior queda intacto y se puede volver al instante sin recargar.
const CLAVE = 'ui_tema';
export const TEMA_V2 = 'v2';
export const TEMA_CLASICO = 'clasico';
const EVENTO = 'tema-ui-cambiado';

export const leerTema = () => {
    try {
        return localStorage.getItem(CLAVE) === TEMA_V2 ? TEMA_V2 : TEMA_CLASICO;
    } catch (_) {
        return TEMA_CLASICO;
    }
};

export const aplicarTema = (tema) => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('tema-v2', tema === TEMA_V2);
};

export const cambiarTema = (tema) => {
    const nuevo = tema === TEMA_V2 ? TEMA_V2 : TEMA_CLASICO;
    try {
        localStorage.setItem(CLAVE, nuevo);
    } catch (_) {
        /* modo privado: el tema solo dura la sesion */
    }
    aplicarTema(nuevo);
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: nuevo }));
    return nuevo;
};

export const alternarTema = () => cambiarTema(leerTema() === TEMA_V2 ? TEMA_CLASICO : TEMA_V2);

// Hook compartido: cualquier componente puede saber si esta activo el tema
// nuevo y re-renderizarse cuando el usuario cambia desde la barra o el menu.
export const useTema = () => {
    const [tema, setTema] = useState(leerTema);

    useEffect(() => {
        aplicarTema(tema);
        const alCambiar = (evento) => setTema(evento.detail === TEMA_V2 ? TEMA_V2 : TEMA_CLASICO);
        window.addEventListener(EVENTO, alCambiar);
        return () => window.removeEventListener(EVENTO, alCambiar);
    }, [tema]);

    return { tema, esV2: tema === TEMA_V2, cambiarTema, alternarTema };
};
