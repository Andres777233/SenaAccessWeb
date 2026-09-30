import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { showAlert } from './CustomAlert';

// Bloque "Verificación en dos pasos" reutilizado en los perfiles de Admin, Instructor y Aprendiz.
const DosPasos = () => {
    const [activado, setActivado] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [pidiendoClave, setPidiendoClave] = useState(false);
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

    const handleActivar = async () => {
        setProcesando(true);
        try {
            const response = await axios.post('/api/2fa/activar');
            setActivado(true);
            showAlert(response.data.message || 'Verificación en dos pasos activada.');
        } catch (error) {
            showAlert('Error al activar: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setProcesando(false);
        }
    };

    const handleDesactivar = async (e) => {
        e.preventDefault();
        if (!password) {
            setPasswordError('Ingresa tu contraseña actual.');
            return;
        }
        setProcesando(true);
        try {
            const response = await axios.post('/api/2fa/desactivar', { user_password: password });
            setActivado(false);
            setPidiendoClave(false);
            setPassword('');
            setPasswordError('');
            showAlert(response.data.message || 'Verificación en dos pasos desactivada.');
        } catch (error) {
            if (error.response?.data?.errors) {
                setPasswordError(error.response.data.errors.user_password?.[0] || '');
            }
            showAlert('Error al desactivar: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setProcesando(false);
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
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <span className="material-symbols-outlined">shield</span>
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
            ) : activado ? (
                <>
                    {!pidiendoClave ? (
                        <button className="btn btn-outline-danger action-btn w-100" onClick={() => setPidiendoClave(true)}>
                            <span className="material-symbols-outlined small">lock_open</span> Desactivar
                        </button>
                    ) : (
                        <form onSubmit={handleDesactivar}>
                            <label className="form-label opacity-75 small">Confirma con tu contraseña actual</label>
                            <input
                                type="password"
                                className={`form-control ${passwordError ? 'is-invalid' : ''}`}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
                                placeholder="Contraseña actual"
                            />
                            {passwordError && <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{passwordError}</div>}
                            <div className="d-flex gap-2 mt-3 flex-wrap">
                                <button type="submit" className="btn btn-danger action-btn flex-grow-1" disabled={procesando}>
                                    {procesando ? 'Verificando...' : 'Confirmar desactivación'}
                                </button>
                                <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={() => { setPidiendoClave(false); setPassword(''); setPasswordError(''); }}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}
                </>
            ) : (
                <button className="btn btn-success action-btn w-100" onClick={handleActivar} disabled={procesando}>
                    <span className="material-symbols-outlined small">lock</span> {procesando ? 'Activando...' : 'Activar'}
                </button>
            )}

            {pendiente && (
                <div className="mt-3 p-3 rounded border border-warning border-opacity-50 bg-warning bg-opacity-10">
                    <h6 className="mb-1 d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">help</span> ¿Eres tú?
                    </h6>
                    <p className="small opacity-75 mb-2">Alguien intenta entrar a tu cuenta. Si no fuiste tú, deniega el acceso.</p>
                    <div className="small mb-1"><span className="opacity-50">IP:</span> {pendiente.ip}</div>
                    <div className="small mb-1 text-truncate"><span className="opacity-50">Dispositivo:</span> {pendiente.user_agent}</div>
                    <div className="small mb-3"><span className="opacity-50">Fecha:</span> {pendiente.created_at ? new Date(pendiente.created_at).toLocaleString() : '—'}</div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-success action-btn flex-grow-1" onClick={() => handleResponder('aprobar')} disabled={respondiendo}>
                            <span className="material-symbols-outlined small">check</span> Sí, soy yo
                        </button>
                        <button className="btn btn-outline-danger action-btn flex-grow-1" onClick={() => handleResponder('denegar')} disabled={respondiendo}>
                            <span className="material-symbols-outlined small">close</span> No soy yo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DosPasos;
