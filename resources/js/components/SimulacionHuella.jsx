import React, { useEffect, useRef, useState } from 'react';

// Registro biométrico simulado (dos dedos), como en el diseño de referencia.
// Va dentro del perfil, debajo de "Mi huella" (que sí usa WebAuthn real).
// No registra nada en el servidor: es una demostración visual.
const SimulacionHuella = () => {
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
        if (progreso.izq < 100 || progreso.der < 100 || fase !== 'idle') return undefined;
        setFase('escaneando');
        const t = setTimeout(() => setFase('verificado'), 1200);
        return () => clearTimeout(t);
    }, [progreso, fase]);

    const iniciar = (lado) => {
        if (fase !== 'idle' || activo[lado]) return;
        setActivo((prev) => ({ ...prev, [lado]: true }));

        timers.current[lado] = setInterval(() => {
            setProgreso((prev) => {
                const nuevo = Math.min(100, prev[lado] + 5);
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
        const clases = ['huella-dedo', activo[lado] ? 'activo' : '', valor >= 100 ? 'verificado' : '']
            .filter(Boolean)
            .join(' ');

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
        <div className="glass-box p-4 mt-4 mx-auto" style={{ maxWidth: '640px' }}>
            <div className="text-center mb-3">
                <h5 className="fw-bold mb-1 d-flex align-items-center justify-content-center gap-2">
                    <span className="material-symbols-outlined text-success">fingerprint</span>
                    Registro biométrico
                </h5>
                <p className="small opacity-75 mb-0">
                    Demostración: presiona los dos dedos para completar el escaneo.
                </p>
            </div>

            <div className="huella-dedos">
                {dedo('izq', 'Dedo izquierdo')}
                {dedo('der', 'Dedo derecho')}
            </div>

            {verificado ? (
                <div className="alert alert-success mt-3 mb-0 py-2 text-center small">
                    <span className="material-symbols-outlined small align-middle me-1">task_alt</span>
                    Huellas capturadas exitosamente
                </div>
            ) : (
                <div className="mt-3">
                    <div className="d-flex justify-content-between small opacity-75 mb-1">
                        <span>Progreso del escaneo</span>
                        <span>{total}%</span>
                    </div>
                    <div className="progress huella-barra" role="progressbar" aria-valuenow={total} aria-valuemin="0" aria-valuemax="100">
                        <div className="progress-bar" style={{ width: `${total}%` }} />
                    </div>
                </div>
            )}

            <button type="button" className="btn btn-outline-success w-100 mt-3" onClick={reiniciar}>
                {verificado ? 'Repetir simulación' : 'Reiniciar'}
            </button>
        </div>
    );
};

export default SimulacionHuella;
