import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import { showAlert } from './CustomAlert';

// Guarda la sesión entregada por validar-codigo o por el polling de estado.
const guardarSesion2Fa = (data) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_role', data.role);
    localStorage.removeItem('2fa_challenge_id');
};

// Redirige al panel según rol (mismo mapa que Login.jsx).
const redirigirPorRol = (navigate, role) => {
    const userRole = (role || '').toLowerCase();
    if (userRole === 'admin') {
        navigate('/admin');
    } else if (userRole === 'instructor') {
        navigate('/instructor');
    } else if (userRole === 'aprendiz') {
        navigate('/aprendiz');
    } else {
        navigate('/loading');
    }
};

const Verificacion2Fa = () => {
    const navigate = useNavigate();
    const [challengeId] = useState(() => localStorage.getItem('2fa_challenge_id') || '');
    const [code, setCode] = useState('');
    const [codeErrors, setCodeErrors] = useState('');
    const [generalError, setGeneralError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resuelto, setResuelto] = useState(false);
    const resueltoRef = useRef(false);

    const marcarResuelto = () => {
        resueltoRef.current = true;
        setResuelto(true);
    };

    const volverAlLogin = () => {
        localStorage.removeItem('2fa_challenge_id');
        navigate('/login');
    };

    // Polling: el otro dispositivo (o el correo) puede aprobar mientras se escribe el código.
    useEffect(() => {
        if (!challengeId) return;
        const consultarEstado = async () => {
            if (resueltoRef.current) return;
            try {
                const response = await axios.get(`/api/2fa/estado/${challengeId}`);
                const estado = response.data.estado;
                if (estado === 'aprobado') {
                    marcarResuelto();
                    guardarSesion2Fa(response.data);
                    showAlert(response.data.message || 'Login exitoso');
                    redirigirPorRol(navigate, response.data.role);
                } else if (estado === 'rechazado' || estado === 'denegado') {
                    marcarResuelto();
                    setGeneralError('El intento fue rechazado. Vuelve a iniciar sesión.');
                } else if (estado === 'expirado') {
                    marcarResuelto();
                    setGeneralError(response.data.message || 'El intento de acceso expiró. Vuelve a intentarlo.');
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    marcarResuelto();
                    setGeneralError('El intento de acceso no existe. Vuelve a iniciar sesión.');
                }
            }
        };
        const intervalo = setInterval(consultarEstado, 4000);
        return () => clearInterval(intervalo);
    }, [challengeId, navigate]);

    // Sin challenge no hay nada que verificar: de vuelta al login.
    if (!challengeId) {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center vh-90 fade-in-up">
                <div className="glass-box p-4 p-md-5 mx-3 text-center">
                    <h4 className="fw-bold">Sin verificación pendiente</h4>
                    <p className="mt-3 small opacity-75">Inicia sesión para generar un código de verificación.</p>
                    <div className="d-grid mt-4">
                        <Link to="/login" className="btn btn-glow btn-primary-login w-100 fw-bold py-3">
                            VOLVER AL LOGIN
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    // Valida el código de 6 dígitos enviado al correo.
    const handleSubmit = async (e) => {
        e.preventDefault();
        setCodeErrors('');
        setGeneralError('');
        setLoading(true);
        try {
            const response = await axios.post('/api/2fa/validar-codigo', {
                challenge_id: challengeId,
                code: code.trim()
            });
            marcarResuelto();
            guardarSesion2Fa(response.data);
            showAlert(response.data.message || 'Login exitoso');
            redirigirPorRol(navigate, response.data.role);
        } catch (error) {
            if (error.response) {
                const mensaje = error.response.data.message || 'Código inválido';
                if (error.response.status === 422) {
                    setCodeErrors(mensaje);
                } else {
                    setGeneralError(mensaje);
                    // El reto ya se resolvió o expiró: no tiene sentido reintentar.
                    if (error.response.status === 400) {
                        marcarResuelto();
                    }
                }
                showAlert(mensaje, 'error');
            } else {
                setGeneralError('Error al conectar con el servidor.');
                showAlert('Error al conectar con el servidor.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="d-flex flex-column justify-content-center align-items-center vh-90 fade-in-up">
            <div className="glass-box p-4 p-md-5 mx-3">
                <div className="text-center mb-4">
                    <img src="https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png?rev=40" className="logosena mb-3" alt="Logo SENA" />
                    <h2 className="landing-title fw-bold mb-0">Verificación en <span className="neon-text">dos pasos</span></h2>
                    <hr className="border-success opacity-25" />
                    <p className="mt-3 small opacity-75">Revisa tu correo e ingresa el código de 6 dígitos. Si aprobaste el acceso desde otro dispositivo, entrarás automáticamente.</p>
                </div>

                {generalError && (
                    <div className="alert alert-danger" role="alert">{generalError}</div>
                )}

                {!resuelto ? (
                    <form onSubmit={handleSubmit}>
                        <div className="user-box">
                            <input
                                type="text"
                                name="code"
                                required
                                placeholder=" "
                                inputMode="numeric"
                                maxLength="6"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className={codeErrors ? 'is-invalid' : ''}
                            />
                            <label>Código de 6 dígitos</label>
                            {codeErrors && <div className="invalid-feedback d-block">{codeErrors}</div>}
                        </div>

                        <div className="d-grid gap-3 mt-4">
                            <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3" type="submit" disabled={loading}>
                                {loading ? 'VERIFICANDO...' : 'VERIFICAR'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-glow w-100"
                                onClick={volverAlLogin}
                            >
                                VOLVER AL LOGIN
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="d-grid gap-3 mt-4">
                        <button
                            type="button"
                            className="btn btn-glow btn-primary-login w-100 fw-bold py-3"
                            onClick={volverAlLogin}
                        >
                            VOLVER AL LOGIN
                        </button>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default Verificacion2Fa;
