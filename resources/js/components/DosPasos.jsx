import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { showAlert } from './CustomAlert';

// Bloque "Verificación en dos pasos" reutilizado en los perfiles de Admin, Instructor y Aprendiz.
const DosPasos = () => {
    const [activado, setActivado] = useState(null);
    // Modo: 'siempre' (código en cada inicio) o 'dispositivo' (confiar aquí).
    const [modo, setModo] = useState('dispositivo');
    const [confiable, setConfiable] = useState(false);
    const [modoElegido, setModoElegido] = useState('siempre');
    const [cargando, setCargando] = useState(true);
    const [accionClave, setAccionClave] = useState(null); // 'activar' | 'desactivar' | null
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [pendiente, setPendiente] = useState(null);
    const [respondiendo, setRespondiendo] = useState(false);
    const pendienteRef = useRef(null);

    useEffect(() => {
        const cargarEstado = async () => {
            try {
                const response = await axios.get('/api/2fa/estado-config');
                setActivado(response.data.two_factor_enabled);
                setModo(response.data.modo || 'dispositivo');
                setConfiable(!!response.data.dispositivo_confiable);
            } catch (error) {
                console.error('Error al consultar estado 2FA:', error);
            } finally {
                setCargando(false);
            }
        };
        cargarEstado();
    }, []);

    // Polling cada 8s: muestra la tarjeta "¿Eres tú?" si hay un reto pendiente.
    useEffect(() => {
        const consultarPendientes = async () => {
            try {
                const response = await axios.get('/api/2fa/pendientes');
                if (response.data.pending) {
                    const reto = response.data.challenge;
                    if (pendienteRef.current !== reto.challenge_id) {
                        pendienteRef.current = reto.challenge_id;
                        setPendiente(reto);
                    }
                } else if (pendienteRef.current) {
                    pendienteRef.current = null;
                    setPendiente(null);
                }
            } catch (error) {
                console.error('Error al consultar retos 2FA:', error);
            }
        };
        consultarPendientes();
        const intervalo = setInterval(consultarPendientes, 8000);
        return () => clearInterval(intervalo);
    }, []);

    const handleActivar = () => {
        setPassword('');
        setPasswordError('');
        setAccionClave('activar');
    };

    const handleConfirmarClave = async (e) => {
        e.preventDefault();
        if (!password) {
            setPasswordError('Ingresa tu contraseña actual.');
            return;
        }
        setProcesando(true);
        try {
            const url = accionClave === 'activar' ? '/api/2fa/activar' : '/api/2fa/desactivar';
            const cuerpo = accionClave === 'activar'
                ? { user_password: password, modo: modoElegido }
                : { user_password: password };
            const response = await axios.post(url, cuerpo);
            setActivado(accionClave === 'activar');
            if (accionClave === 'activar') setModo(modoElegido);
            setAccionClave(null);
            setPassword('');
            setPasswordError('');
            showAlert(response.data.message || (accionClave === 'activar'
                ? 'Verificación en dos pasos activada.'
                : 'Verificación en dos pasos desactivada.'));
        } catch (error) {
            if (error.response?.data?.errors) {
                setPasswordError(error.response.data.errors.user_password?.[0] || '');
            } else {
                setPasswordError(error.response?.data?.message || 'No se pudo confirmar la operación.');
            }
            showAlert('Error: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setProcesando(false);
        }
    };

    // Cambia cómo se pide el código (cada inicio o solo dispositivos nuevos).
    const handleCambiarModo = async (nuevo) => {
        if (procesando || nuevo === modo) return;
        setProcesando(true);
        try {
            const response = await axios.post('/api/2fa/modo', { user_password: password, modo: nuevo });
            setModo(nuevo);
            setPassword('');
            setPasswordError('');
            showAlert(response.data.message || 'Modo actualizado.');
        } catch (error) {
            showAlert(error.response?.data?.message || 'No se pudo cambiar el modo.', 'error');
        } finally {
            setProcesando(false);
        }
    };

    // Olvida este navegador: el próximo inicio de sesión pedirá el código.
    const handleOlvidarDispositivo = async () => {
        try {
            const response = await axios.delete('/api/2fa/dispositivo');
            setConfiable(false);
            showAlert(response.data.message || 'Dispositivo olvidado.');
        } catch (error) {
            showAlert(error.response?.data?.message || 'No se pudo olvidar el dispositivo.', 'error');
        }
    };

    const handleResponder = async (decision) => {
        if (!pendiente || respondiendo) return;
        setRespondiendo(true);
        try {
            const response = await axios.post('/api/2fa/aprobar', {
                challenge_id: pendiente.challenge_id,
                decision
            });
            pendienteRef.current = null;
            setPendiente(null);
            showAlert(response.data.message || (decision === 'aprobar' ? 'Acceso aprobado.' : 'Acceso denegado.'));
        } catch (error) {
            showAlert('Error al responder: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setRespondiendo(false);
        }
    };

    return (
        <div className="glass-box-nested p-4 mt-4 text-start">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <span className="icon-badge-2fa material-symbols-outlined">shield</span>
                    Verificación en dos pasos
                </h5>
                {!cargando && (
                    <span className={`badge px-3 py-2 ${activado ? 'bg-success' : 'bg-secondary'} bg-opacity-10 border border-opacity-25 ${activado ? 'text-success border-success' : 'text-secondary border-secondary'}`} style={{ fontSize: '0.75rem' }}>
                        {activado ? 'ACTIVADA' : 'INACTIVA'}
                    </span>
                )}
            </div>
            <p className="small opacity-50 mb-3">
                Al activarla, los inicios de sesión desde dispositivos nuevos te pedirán aprobación aquí o con un código enviado a tu correo.
            </p>

            {cargando ? (
                <div className="text-center py-2"><div className="spinner-border spinner-border-sm text-success" role="status"></div></div>
            ) : accionClave ? (
                <form onSubmit={handleConfirmarClave}>
                    {accionClave === 'activar' && (
                        <div className="mb-3">
                            <label className="form-label opacity-75 small d-block">¿Cuándo pedir el código?</label>
                            <div className="d-flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${modoElegido === 'siempre' ? 'btn-success' : 'btn-outline-secondary'}`}
                                    onClick={() => setModoElegido('siempre')}
                                >
                                    En cada inicio de sesión
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${modoElegido === 'dispositivo' ? 'btn-success' : 'btn-outline-secondary'}`}
                                    onClick={() => setModoElegido('dispositivo')}
                                >
                                    Solo en dispositivos nuevos
                                </button>
                            </div>
                            <div className="small opacity-50 mt-1">
                                {modoElegido === 'siempre'
                                    ? 'Más seguro: cada vez que entres te pedirá el código del correo.'
                                    : 'Este navegador quedará como confiable y no pedirá código.'}
                            </div>
                        </div>
                    )}
                    <label className="form-label opacity-75 small">
                        Confirma con tu contraseña actual para {accionClave === 'activar' ? 'activar' : 'desactivar'}
                    </label>
                    <input
                        type="password"
                        className={`form-control ${passwordError ? 'is-invalid' : ''}`}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Contraseña actual"
                        autoComplete="current-password"
                    />
                    {passwordError && <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{passwordError}</div>}
                    <div className="d-flex gap-2 mt-3 flex-wrap">
                        <button type="submit" className={`btn ${accionClave === 'activar' ? 'btn-success' : 'btn-danger'} action-btn flex-grow-1 btn-press`} disabled={procesando}>
                            {procesando ? 'Verificando...' : accionClave === 'activar' ? 'Confirmar activación' : 'Confirmar desactivación'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary action-btn px-4 btn-press" onClick={() => { setAccionClave(null); setPassword(''); setPasswordError(''); }}>
                            Cancelar
                        </button>
                    </div>
                </form>
            ) : activado ? (
                <>
                    <div className="mb-3">
                        <label className="form-label opacity-50 small mb-1">CUÁNDO PIDE EL CÓDIGO</label>
                        <div className="d-flex gap-2 flex-wrap">
                            <button
                                type="button"
                                className={`btn btn-sm ${modo === 'siempre' ? 'btn-success' : 'btn-outline-secondary'}`}
                                onClick={() => { setPassword(''); setPasswordError(''); setAccionClave(null); setTimeout(() => handleCambiarModo('siempre'), 0); }}
                                disabled={procesando || modo === 'siempre'}
                            >
                                En cada inicio de sesión
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${modo === 'dispositivo' ? 'btn-success' : 'btn-outline-secondary'}`}
                                onClick={() => { setPassword(''); setPasswordError(''); setAccionClave(null); setTimeout(() => handleCambiarModo('dispositivo'), 0); }}
                                disabled={procesando || modo === 'dispositivo'}
                            >
                                Solo en dispositivos nuevos
                            </button>
                        </div>
                    </div>
                    {confiable && (
                        <button className="btn btn-outline-warning action-btn w-100 btn-press mb-2" onClick={handleOlvidarDispositivo}>
                            <span className="material-symbols-outlined small">phonelink_erase</span> Olvidar este dispositivo
                        </button>
                    )}
                    <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-outline-danger action-btn flex-grow-1 btn-press" onClick={() => { setAccionClave('desactivar'); setPassword(''); setPasswordError(''); }}>
                            <span className="material-symbols-outlined small">lock_open</span> Desactivar
                        </button>
                        <button className="btn btn-outline-secondary action-btn px-3 btn-press" onClick={() => { setPassword(''); setPasswordError(''); setAccionClave(null); document.getElementById('2fa-cambiar-modo')?.focus(); }}>
                            <span className="material-symbols-outlined small">tune</span> Cambiar modo
                        </button>
                    </div>
                    <div id="2fa-cambiar-modo" className="mt-3">
                        <label className="form-label opacity-75 small">Confirma con tu contraseña para cambiar el modo</label>
                        <input
                            type="password"
                            className={`form-control ${passwordError ? 'is-invalid' : ''}`}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                            placeholder="Contraseña actual"
                            autoComplete="current-password"
                        />
                        {passwordError && <div className="text-danger small mt-1">{passwordError}</div>}
                    </div>
                </>
            ) : (
                <button className="btn btn-success action-btn w-100 btn-press" onClick={handleActivar}>
                    <span className="material-symbols-outlined small">lock</span> Activar
                </button>
            )}

            {pendiente && (
                <div className="pendiente-2fa mt-3">
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-warning">help</span>
                        <h6 className="mb-0">¿Eres tú?</h6>
                        <span className="pulse-dot ms-1" aria-hidden="true"></span>
                    </div>
                    <p className="small opacity-75 mb-2">Alguien intenta entrar a tu cuenta. Si no fuiste tú, deniega el acceso.</p>
                    <div className="pendiente-meta"><span className="material-symbols-outlined">language</span> {pendiente.ip || '—'}</div>
                    <div className="pendiente-meta text-truncate"><span className="material-symbols-outlined">smartphone</span> {pendiente.user_agent || '—'}</div>
                    <div className="pendiente-meta"><span className="material-symbols-outlined">schedule</span> {pendiente.created_at ? new Date(pendiente.created_at).toLocaleString() : '—'}</div>
                    <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-approve-2fa flex-grow-1 btn-press" onClick={() => handleResponder('aprobar')} disabled={respondiendo}>
                            <span className="material-symbols-outlined small">check</span> {respondiendo ? 'Enviando...' : 'Sí, soy yo'}
                        </button>
                        <button className="btn btn-deny-2fa flex-grow-1 btn-press" onClick={() => handleResponder('denegar')} disabled={respondiendo}>
                            <span className="material-symbols-outlined small">close</span> No soy yo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DosPasos;
