import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from './Footer';
import BotonTema from './BotonTema';
import EscanearAcceso from './EscanearAcceso';
import CodigoAcceso from './CodigoAcceso';
import { useEsperarEntrada } from '../utils/useEsperarEntrada';

// Puerta de entrada: tras el login, quien no tenga Entrada de hoy debe
// registrarla antes de entrar a su panel. La pantalla NO tiene botón de
// "ya marqué": consulta el estado cada pocos segundos y, en cuanto portería
// registra la entrada (escaneando el QR o el código del usuario), pasa sola
// al panel, igual que hace la app Android.
const PuertaAcceso = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState('escanear');
    const [entrando, setEntrando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const yaNavego = useRef(false);

    const entrarAlPanel = useCallback(() => {
        if (yaNavego.current) return;
        yaNavego.current = true;
        setEntrando(true);
        const role = (localStorage.getItem('user_role') || '').toLowerCase();
        const destino = (
            role === 'superadmin' ? '/admin'
                : role === 'instructor' ? '/instructor'
                    : role === 'aprendiz' ? '/aprendiz'
                        : (role === 'admin' || role === 'portero') ? '/portero'
                            : '/loading'
        );
        window.setTimeout(() => navigate(destino), 850);
    }, [navigate]);

    const { error, detectada, revisar } = useEsperarEntrada({
        cada: 3000,
        onEntrada: entrarAlPanel,
    });

    // Aviso de que la pantalla ya está escuchando (solo la primera vez).
    useEffect(() => {
        const id = window.setTimeout(() => {
            setMensaje((m) => m || 'Escuchando… en cuanto portería registre tu entrada, esta pantalla te lleva a tu panel.');
        }, 4000);
        return () => window.clearTimeout(id);
    }, []);

    const alRegistrar = () => {
        setMensaje('Entrada registrada. Abriendo tu panel…');
        revisar();
    };

    const role = (localStorage.getItem('user_role') || '').toLowerCase();
    const esRolOperativo = role === 'superadmin' || role === 'admin' || role === 'portero';

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
                <div className="puerta-shell">
                    <BotonTema />

                    {detectada || entrando ? (
                        <div className="glass-box puerta-card text-center">
                            <div className="v2-success">
                                <div className="v2-success-mark">
                                    <span className="material-symbols-outlined">check</span>
                                </div>
                                <h2 className="h4 fw-bold mt-2">Entrada registrada</h2>
                                <p className="small opacity-75 mb-3">Bienvenido. Estamos abriendo tu panel…</p>
                                <div className="spinner-border spinner-border-sm text-success" role="status">
                                    <span className="visually-hidden">Abriendo el panel…</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <header className="puerta-head text-center">
                                <span className="material-symbols-outlined puerta-icon">door_front</span>
                                <h1 className="h3 fw-bold mb-1">Registra tu entrada</h1>
                                <p className="opacity-75 small mb-0">
                                    Escanea el QR de portería o muestra tu código. No tienes que pulsar nada más:
                                    al quedar registrada, esta pantalla te lleva a tu panel.
                                </p>
                            </header>

                            {esRolOperativo && (
                                <div className="alert alert-success small text-center py-2">
                                    Tu rol no necesita marcar entrada. <button type="button" className="btn btn-sm btn-link p-0 align-baseline" onClick={entrarAlPanel}>Ir a mi panel</button>
                                </div>
                            )}

                            {/* Selector solo en celular: en escritorio se ven las dos tarjetas */}
                            <div className="d-flex d-lg-none justify-content-center mb-3">
                                <div className="v2-segmented" role="tablist" aria-label="Cómo registrar tu entrada">
                                    <button type="button" role="tab" aria-selected={tab === 'escanear'} className={tab === 'escanear' ? 'is-on' : ''} onClick={() => setTab('escanear')}>
                                        Escanear QR
                                    </button>
                                    <button type="button" role="tab" aria-selected={tab === 'codigo'} className={tab === 'codigo' ? 'is-on' : ''} onClick={() => setTab('codigo')}>
                                        Mi código
                                    </button>
                                </div>
                            </div>

                            <div className="row g-3 justify-content-center puerta-columnas">
                                <div className={`col-12 col-lg-6 ${tab === 'escanear' ? '' : 'd-none d-lg-block'}`}>
                                    <EscanearAcceso contexto="puerta" onRegistrado={alRegistrar} ocultarCabecera />
                                </div>
                                <div className={`col-12 col-lg-6 ${tab === 'codigo' ? '' : 'd-none d-lg-block'}`}>
                                    <CodigoAcceso contexto="puerta" onRegistrado={alRegistrar} />
                                </div>
                            </div>

                            <div className="puerta-estado mt-3">
                                <span className="v2-pulse" aria-hidden="true" />
                                <span className="small">
                                    {error && !mensaje ? error : (mensaje || 'Verificando tu entrada…')}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default PuertaAcceso;
