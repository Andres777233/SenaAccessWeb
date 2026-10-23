import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import BotonTema from './BotonTema';

// Simulacion visual de la huella: dos dedos que se "escanean" al pulsarlos.
// No inicia sesion ni usa WebAuthn; es una pantalla de demostracion.
const HuellaSimulacion = () => {
    const [progreso, setProgreso] = useState({ izq: 0, der: 0 });
    const [activo, setActivo] = useState({ izq: false, der: false });
    const [fase, setFase] = useState('idle'); // idle | escaneando | verificado
    const timers = useRef({ izq: null, der: null });

    const detener = () => {
        clearInterval(timers.current.izq);
        clearInterval(timers.current.der);
        timers.current = { izq: null, der: null };
    };

    useEffect(() => () => detener(), []);

    useEffect(() => {
        if (progreso.izq < 100 || progreso.der < 100 || fase !== 'idle') return;
        setFase('escaneando');
        const t = setTimeout(() => setFase('verificado'), 1300);
        return () => clearTimeout(t);
    }, [progreso, fase]);

    const iniciar = (lado) => {
        if (fase !== 'idle' || activo[lado]) return;
        setActivo((prev) => ({ ...prev, [lado]: true }));

        timers.current[lado] = setInterval(() => {
            setProgreso((prev) => {
                const nuevo = Math.min(100, prev[lado] + 4);
                if (nuevo >= 100) {
                    clearInterval(timers.current[lado]);
                    timers.current[lado] = null;
                    setActivo((a) => ({ ...a, [lado]: false }));
                }
                return { ...prev, [lado]: nuevo };
            });
        }, 45);
    };

    const reiniciar = () => {
        detener();
        setProgreso({ izq: 0, der: 0 });
        setActivo({ izq: false, der: false });
        setFase('idle');
    };

    const total = Math.round((progreso.izq + progreso.der) / 2);
    const verificado = fase === 'verificado';

    const dedo = (lado, etiqueta) => {
        const valor = progreso[lado];
        const clases = [
            'huella-dedo',
            activo[lado] ? 'activo' : '',
            valor >= 100 ? 'verificado' : '',
        ].filter(Boolean).join(' ');

        return (
            <button
                type="button"
                className={clases}
                onClick={() => iniciar(lado)}
                aria-label={`Escanear ${etiqueta.toLowerCase()}`}
                disabled={fase !== 'idle'}
            >
                <span className="material-symbols-outlined" aria-hidden="true">fingerprint</span>
                <span className="huella-label">{etiqueta}</span>
                <span className="huella-progreso" aria-hidden="true">
                    <span style={{ width: `${valor}%` }} />
                </span>
                <span className="huella-estado">
                    {valor >= 100 ? 'Listo' : activo[lado] ? 'Escaneando...' : 'Presiona'}
                </span>
            </button>
        );
    };

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
                <div className="glass-box huella-card text-center">
                    <BotonTema />

                    <p className="eyebrow-2fa">Acceso biométrico</p>
                    <h2 className="fw-bold mb-1">Verificación de huella</h2>
                    <p className="small opacity-75 mb-0">
                        Apoya tus dos dedos en la pantalla y mantén hasta completar el escaneo.
                    </p>

                    <div className="huella-dedos">
                        {dedo('izq', 'Dedo izquierdo')}
                        {dedo('der', 'Dedo derecho')}
                    </div>

                    {fase === 'escaneando' && (
                        <div className="huella-scan-box" aria-live="polite">
                            <span className="huella-scan-line" aria-hidden="true" />
                            <span className="small text-success fw-bold">Escaneando huellas...</span>
                        </div>
                    )}

                    {verificado ? (
                        <div className="huella-resultado" role="status">
                            <span className="material-symbols-outlined text-success" style={{ fontSize: '52px' }}>
                                verified
                            </span>
                            <h4 className="fw-bold mt-2 mb-1">Huella verificada</h4>
                            <p className="small opacity-75">Simulación completada correctamente.</p>
                        </div>
                    ) : (
                        <div className="mt-4" aria-live="polite">
                            <div className="d-flex justify-content-between small opacity-75 mb-1">
                                <span>Progreso del escaneo</span>
                                <span>{total}%</span>
                            </div>
                            <div className="progress huella-barra" role="progressbar" aria-valuenow={total} aria-valuemin="0" aria-valuemax="100">
                                <div className="progress-bar" style={{ width: `${total}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="d-grid gap-2 mt-4">
                        {verificado ? (
                            <button type="button" className="btn btn-glow btn-primary-login w-100 fw-bold py-3 btn-press" onClick={reiniciar}>
                                REPETIR SIMULACIÓN
                            </button>
                        ) : (
                            <button type="button" className="btn btn-glow w-100 fw-bold py-3 btn-press" onClick={reiniciar}>
                                REINICIAR
                            </button>
                        )}
                        <Link to="/login" className="btn btn-glow w-100 py-3 text-decoration-none d-flex align-items-center justify-content-center gap-2">
                            <span className="material-symbols-outlined">arrow_back</span>
                            VOLVER AL LOGIN
                        </Link>
                    </div>

                    <p className="small opacity-50 mt-3 mb-0">
                        Demostración visual: no inicia sesión.
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default HuellaSimulacion;
