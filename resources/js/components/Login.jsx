import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import Footer from './Footer';
import BotonTema from './BotonTema';
import { showAlert } from './CustomAlert';
import { decidirRutaPorRol, limpiarSesionLocal } from '../utils/sesion';
import { guardarSesion, guardarReto2Fa, guardarUsuario, borrarUsuario } from '../utils/auth';

const Login = () => {
    // HOOK: useNavigate maneja las redirecciones post-login hacia los paneles de control.
    const navigate = useNavigate();

    // HOOK: Múltiples useState para almacenar temporalmente los datos del formulario (email, password) mientras el usuario escribe.
    const [user_email, setEmail] = useState(''); // Estado para almacenar email del usuario
    // Correos usados en este navegador (espejo del autorrelleno del móvil; la clave la pone el navegador, nunca se guarda aquí).
    const [correosGuardados, setCorreosGuardados] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sena_emails') || '[]'); }
        catch { return []; }
    });
    const guardarCorreoUsado = (correo) => {
        const limpio = (correo || '').trim();
        if (!limpio) return;
        setCorreosGuardados((prev) => {
            const lista = [limpio, ...prev.filter((c) => c.toLowerCase() !== limpio.toLowerCase())].slice(0, 5);
            try { localStorage.setItem('sena_emails', JSON.stringify(lista)); } catch {}
            return lista;
        });
    };
    const [user_password, setPassword] = useState(''); // Estado para almacenar contraseña del usuario
    const [showPassword, setShowPassword] = useState(false); // Estado para alternar visibilidad de contraseña
    const [enviando, setEnviando] = useState(false); // Evita doble submit mientras viaja el login
    const [isGuestMode, setIsGuestMode] = useState(false); // Estado para alternar modo invitado
    const [guestData, setGuestData] = useState({ // Estado para almacenar datos de invitado
        user_name: '',
        user_lastname: '',
        user_identification: '',
        user_documento_tipo: 'CC'
    });
    const [guestErrors, setGuestErrors] = useState({}); // Errores de validación por campo (invitado)
    const [qrInvitado, setQrInvitado] = useState(null); // { token, expiresAt, dataUrl } tras registro exitoso
    // Estado de la visita (lo dice el servidor): pendiente | dentro | salida | expirado.
    const [visita, setVisita] = useState(null);
    const [qrSalida, setQrSalida] = useState(null); // { token, expiresAt, dataUrl } tras registrar la entrada
    const [restante, setRestante] = useState(''); // cuenta regresiva del QR que se está mostrando

    // Consulta el estado de la visita cada 5 s: cuando portería registra la
    // entrada, esta pantalla cambia sola al QR de salida.
    useEffect(() => {
        const token = qrInvitado?.token;
        if (!token) return;
        let vivo = true;
        const consultar = async () => {
            try {
                const { data } = await axios.get(`/api/guest/estado/${token}`);
                if (vivo) setVisita(data);
            } catch (_) {
                /* sin conexión: se mantiene el estado anterior */
            }
        };
        consultar();
        const id = setInterval(consultar, 5000);
        return () => { vivo = false; clearInterval(id); };
    }, [qrInvitado?.token]);

    // Genera la imagen del QR de salida cuando la visita queda "dentro".
    useEffect(() => {
        let vivo = true;
        const tokenSalida = visita?.qr_salida;
        if (!tokenSalida) {
            setQrSalida(null);
            return;
        }
        QRCode.toDataURL(tokenSalida)
            .then((dataUrl) => {
                if (vivo) {
                    setQrSalida({ token: tokenSalida, dataUrl, expiresAt: visita?.qr_salida_expires_at });
                }
            })
            .catch(() => {});
        return () => { vivo = false; };
    }, [visita?.qr_salida]);

    // Cuenta regresiva del QR visible: entrada pendiente o salida (6 h de visita).
    const venceEn = visita?.estado === 'dentro'
        ? (visita?.qr_salida_expires_at || qrInvitado?.expiresAt)
        : qrInvitado?.expiresAt;
    useEffect(() => {
        if (!venceEn) return;
        const tick = () => {
            const ms = new Date(venceEn).getTime() - Date.now();
            if (ms <= 0) {
                setRestante('00:00');
                return;
            }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setRestante(h > 0
                ? `${h}h ${String(m).padStart(2, '0')}m`
                : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [venceEn]);

    // Funcion para manejar el envio del formulario de login
    // device_id: UUID persistente de este navegador; el backend solo pide 2FA en dispositivos nuevos.
    const obtenerDeviceId = () => {
        let id = localStorage.getItem('sena_device_id');
        if (!id) {
            id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            localStorage.setItem('sena_device_id', id);
        }
        return id;
    };

    // Cierra el ingreso: guarda el token, aplica la puerta de entrada y
    // lleva al panel del rol. La ruta la decide utils/sesion.js para que el
    // login normal y el 2FA se comporten igual.
    const finalizarLogin = async (datos, correo = '') => {
        guardarSesion(datos.access_token, datos.role);
        // Guarda el usuario para que el panel pinte al instante; igual se
        // refresca con /api/user al montar.
        if (datos.user) {
            guardarUsuario(datos.user);
        }
        if (correo) guardarCorreoUsado(correo);

        const ruta = await decidirRutaPorRol(datos.role, datos.access_token);
        if (ruta === '/login') {
            limpiarSesionLocal();
            showAlert('Tu cuenta no tiene un rol válido. Contacta al administrador.', 'error');
            return;
        }
        // Navegacion SPA: sin recargar toda la pagina (el panel entra de una).
        navigate(ruta, { replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (enviando) return;
        setEnviando(true);
        // Nunca se mezcla la sesion nueva con la anterior: sin esto un token
        // de admin podia sobrevivir al login de aprendiz/instructor y el 2FA
        // o los guards mostraban el panel equivocado.
        limpiarSesionLocal();
        try {
            const response = await axios.post('/api/login', {
                user_email,
                user_password,
                device_id: obtenerDeviceId()
            });

            // 2FA requerido: el backend no emitió token; se continúa en /verificacion-2fa.
            if (response.data.two_factor_required) {
                // El reto no devuelve el usuario: se evita mostrar otro nombre
                // mientras el panel valida la sesión.
                borrarUsuario();
                guardarReto2Fa(response.data.two_factor_id);
                // Pista del correo ("j***@sena.edu.co") para la pantalla del código.
                sessionStorage.setItem('2fa_hint', response.data.email_hint || '');
                showAlert(response.data.message || 'Verificación en dos pasos requerida.');
                navigate('/verificacion-2fa');
                return;
            }

            await finalizarLogin(response.data, user_email);
        } catch (error) {
            if (error.response) {
                showAlert(error.response.data.message || 'Error en el inicio de sesión', 'error');
            } else {
                showAlert('Error al conectar con el servidor.', 'error');
            }
        } finally {
            setEnviando(false);
        }
    };

    // Funcion para alternar visibilidad de contraseña
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // Funcion para manejar el envio del formulario de invitado
    // POST /api/register-guest → { qr_token, qr_expires_at }; genera el QR y lo muestra.
    const handleGuestSubmit = async (e) => {
        e.preventDefault();
        setGuestErrors({});
        try {
            const response = await axios.post('/api/register-guest', guestData);
            const dataUrl = await QRCode.toDataURL(response.data.qr_token);
            setVisita(null);
            setQrSalida(null);
            setQrInvitado({
                token: response.data.qr_token,
                expiresAt: response.data.qr_expires_at,
                dataUrl
            });
            showAlert(response.data.message);
        } catch (error) {
            if (error.response?.data?.errors) {
                setGuestErrors(error.response.data.errors);
                showAlert('Revisa los datos del invitado.', 'error');
            } else if (error.response) {
                showAlert(error.response.data.message || 'Error al registrar ingreso de invitado', 'error');
            } else {
                showAlert('Error al conectar con el servidor.', 'error');
            }
        }
    };

    // Copia el token del QR visible al portapapeles.
    const copiarToken = async () => {
        const token = (visita?.estado === 'dentro' ? qrSalida?.token : qrInvitado?.token) || '';
        try {
            await navigator.clipboard.writeText(token);
            showAlert('Código copiado al portapapeles.');
        } catch (err) {
            showAlert('No se pudo copiar el código.', 'error');
        }
    };

    // Limpia el QR mostrado y deja el formulario listo para otro invitado.
    const registrarOtroInvitado = () => {
        setQrInvitado(null);
        setQrSalida(null);
        setVisita(null);
        setRestante('');
        setGuestErrors({});
        setGuestData({ user_name: '', user_lastname: '', user_identification: '', user_documento_tipo: 'CC' });
    };

    const guestError = (name) =>
        guestErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{guestErrors[name][0]}</div> : null;

    if (isGuestMode) {
        // Pantalla del invitado: SOLO el QR. Primero el de entrada; cuando
        // portería lo escanea, esta pantalla cambia sola al QR de salida.
        if (qrInvitado) {
            const estadoVisita = visita?.estado || 'pendiente';
            const enSalida = estadoVisita === 'dentro';
            const terminada = estadoVisita === 'salida' || estadoVisita === 'expirado';
            const qrVisible = enSalida ? qrSalida : qrInvitado;

            return (
                <div className="auth-page fade-in-up">
                    <main className="auth-main">
                    <div className="glass-box auth-card text-center" style={{ maxWidth: '440px' }}>
                <BotonTema />
                        <h2 className="fw-bold mb-0">
                            {terminada ? 'Visita finalizada' : enSalida ? 'Tu código de salida' : 'Tu código de ingreso'}
                        </h2>
                        <h5 className="fw-light text-success">
                            {terminada ? 'Gracias por visitarnos'
                                : enSalida ? 'Muéstralo en portería al salir'
                                    : 'Preséntalo en portería'}
                        </h5>
                        <hr className="border-success opacity-25" />

                        {terminada ? (
                            <div className="my-4">
                                <span className="material-symbols-outlined text-success" style={{ fontSize: '72px' }}>
                                    {estadoVisita === 'salida' ? 'task_alt' : 'timer_off'}
                                </span>
                                <p className="small opacity-75 mb-0">
                                    {estadoVisita === 'salida'
                                        ? 'Tu salida quedó registrada en portería.'
                                        : 'La visita superó el plazo de 6 horas y se cerró automáticamente.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {qrVisible?.dataUrl ? (
                                    <img src={qrVisible.dataUrl} alt="QR de la visita" className="img-fluid my-3" style={{ maxWidth: '240px' }} />
                                ) : (
                                    <div className="my-4"><span className="spinner-border text-success" role="status" /></div>
                                )}
                                <div className="fw-bold fs-4">{restante ? `Vence en ${restante}` : 'Generando…'}</div>
                                <p className="small opacity-75 mb-2">
                                    {enSalida
                                        ? 'Código de salida · un solo uso · se vence al cumplir la visita'
                                        : 'Código de entrada · un solo uso · la visita dura 6 horas'}
                                </p>
                                <code className="d-block text-break small p-2 bg-dark bg-opacity-25 rounded mb-3">{qrVisible?.token || ''}</code>
                            </>
                        )}

                        <div className="d-grid gap-3">
                            {!terminada && (
                                <button className="btn btn-glow w-100 fw-bold" type="button" onClick={copiarToken}>
                                    COPIAR CÓDIGO
                                </button>
                            )}
                            <button className="btn btn-glow w-100" type="button" onClick={registrarOtroInvitado}>
                                REGISTRAR OTRO
                            </button>
                            <button
                                type="button"
                                className="btn btn-glow w-100"
                                onClick={() => { setIsGuestMode(false); registrarOtroInvitado(); }}
                            >
                                VOLVER AL LOGIN
                            </button>
                        </div>
                    </div>
                    </main>
                    <Footer />
                </div>
            );
        }
        return (
            <div className="auth-page fade-in-up">
                <main className="auth-main">
                <div className="glass-box auth-card">
                <BotonTema />
                    <div className="text-center mb-4">
                        <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" />
                        <h2 className="fw-bold mb-0">Invitado</h2>
                        <h5 className="fw-light text-success">Ingreso Rapido</h5>
                        <hr className="border-success opacity-25" />
                        <p className="mt-3 small opacity-75">Ingrese sus datos básicos para registrar su visita (válida 6 horas).</p>
                    </div>

                    <form onSubmit={handleGuestSubmit}>
                        <div className="mb-3">
                            <label className="form-label opacity-75 small">Tipo de Documento</label>
                            <select
                                className={`form-select ${guestErrors.user_documento_tipo ? 'is-invalid' : ''}`}
                                value={guestData.user_documento_tipo}
                                onChange={(e) => setGuestData({ ...guestData, user_documento_tipo: e.target.value })}
                            >
                                <option value="CC">CC: Cédula de Ciudadanía</option>
                                <option value="CE">CE: Cédula de Extranjería</option>
                                <option value="TI">TI: Tarjeta de Identidad</option>
                                <option value="PAS">PAS: Pasaporte</option>
                            </select>
                            {guestError('user_documento_tipo')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_identification}
                                onChange={(e) => setGuestData({ ...guestData, user_identification: e.target.value })}
                            />
                            <label>Número de Documento</label>
                            {guestError('user_identification')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_name}
                                // Funcion para generar los datos de invitado (guest)
                                onChange={(e) => setGuestData({ ...guestData, user_name: e.target.value })}
                            />
                            <label>Nombres</label>
                            {guestError('user_name')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_lastname}
                                onChange={(e) => setGuestData({ ...guestData, user_lastname: e.target.value })}
                            />
                            <label>Apellidos</label>
                            {guestError('user_lastname')}
                        </div>

                        <div className="d-grid gap-3 mt-4">
                            <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3" type="submit">
                                REGISTRAR INGRESO
                            </button>
                            <button
                                type="button"
                                className="btn btn-glow w-100"
                                onClick={() => setIsGuestMode(false)}
                            >
                                VOLVER AL LOGIN
                            </button>
                        </div>
                    </form>
                </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
            <div className="glass-box auth-card">
                <BotonTema />
                <div className="text-center mb-4">
                    <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" />
                    <h2 className="landing-title fw-bold mb-0">Sena <span className="neon-text">Access</span></h2>
                    <h5 className="fw-light text-success">Acceso CCyS</h5>
                    <hr className="border-success opacity-25" />
                    <h4 className="mt-3 fw-bold">Iniciar Sesión</h4>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="user-box">
                        <input
                            type="email"
                            name="user_email"
                            required
                            placeholder=" "
                            value={user_email}
                            onChange={(e) => setEmail(e.target.value)}
                            list="sena-emails"
                            autoComplete="email"
                        />
                        <datalist id="sena-emails">
                            {correosGuardados.map((c) => <option key={c} value={c} />)}
                        </datalist>
                        <label>Correo electrónico</label>
                    </div>
                    <div className="user-box">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="user_password"
                            autoComplete="current-password"
                            required
                            placeholder=" "
                            value={user_password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <label>Contraseña</label>
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={togglePasswordVisibility}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                    <line x1="12" y1="5" x2="12" y2="2" />
                                    <line x1="5" y1="8" x2="3" y2="5" />
                                    <line x1="19" y1="8" x2="21" y2="5" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 10c4 6 16 6 20 0" />
                                    <line x1="12" y1="15" x2="12" y2="18" />
                                    <line x1="7" y1="14" x2="5" y2="17" />
                                    <line x1="17" y1="14" x2="19" y2="17" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="d-grid gap-3 mb-4">
                        <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3 d-flex align-items-center justify-content-center gap-2" type="submit" disabled={enviando}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                // Icono de flecha de inicio de sesión
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                            {enviando ? 'INGRESANDO...' : 'INGRESAR'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline-success w-100 fw-bold d-flex align-items-center justify-content-center gap-2"
                            onClick={() => navigate('/huella')}
                        >
                            <span className="material-symbols-outlined">fingerprint</span>
                            INGRESAR CON HUELLA
                        </button>

                        <div className="position-relative text-center my-3">
                            <hr className="border-secondary opacity-25" />
                            <span className="position-absolute top-50 start-50 translate-middle theme-bg theme-text px-2 small opacity-75" style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                o continúa como invitado
                            </span>
                        </div>

                        <button
                            type="button"
                            className="btn btn-glow w-100 fw-bold"
                            onClick={() => setIsGuestMode(true)}
                        >
                            INVITADO
                        </button>
                    </div>
                </form>

                <div className="mt-4 text-center">
                    <p className="mb-2 theme-text opacity-75 small">¿No estás registrado? <Link to="/register" className="custom-link fw-bold text-success">¡Regístrate aquí!</Link></p>
                    <p className="mb-4 theme-text opacity-75 small">¿Olvidaste tu contraseña? <Link to="/password-recovery" className="custom-link fw-bold text-success">Recuperar</Link></p>
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default Login;
