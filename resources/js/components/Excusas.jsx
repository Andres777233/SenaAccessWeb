import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { showAlert, showConfirm } from './CustomAlert';

const ESTADO_BADGE = {
    pendiente: 'badge-soft-warning',
    usada: 'badge-soft-success',
    anulada: 'badge-soft-secondary',
    expirada: 'badge-soft-info'
};

const nombrePersona = (u) => {
    if (!u) return '—';
    return `${u.user_name || ''} ${u.user_lastname || ''}`.trim() || u.user_email || '—';
};

const nombreAmbiente = (e) => e.ambiente?.ambiente_nombre || '—';

// Resto de vigencia "mm:ss" para la cuenta regresiva del aprendiz.
const restoVigencia = (expira_en, ahora) => {
    const diff = new Date(expira_en).getTime() - ahora;
    if (diff <= 0) return 'Expirada';
    const min = Math.floor(diff / 60000);
    const seg = Math.floor((diff % 60000) / 1000);
    return `${min}:${String(seg).padStart(2, '0')}`;
};

const Excusas = ({ currentUser, rol }) => {
    const rolNorm = (rol || currentUser?.role?.rol_name || '').toLowerCase();
    // Portería opera como admin: valida PIN y ve la bandeja (sin crear excusas).
    const esOperativo = rolNorm === 'superadmin' || rolNorm === 'admin';
    const esInstructor = rolNorm === 'instructor' || rolNorm === 'instructora';

    if (esOperativo) return <ExcusasAdmin />;
    if (esInstructor) return <InstructorExcusas />;
    return <MisExcusas />;
};

// ---------- INSTRUCTOR: crea excusas con PIN + lista propia ----------
const InstructorExcusas = () => {
    const [aprendices, setAprendices] = useState([]);
    const [ambientes, setAmbientes] = useState([]);
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [aprendizId, setAprendizId] = useState('');
    const [ambienteId, setAmbienteId] = useState('');
    const [motivo, setMotivo] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [creando, setCreando] = useState(false);
    const [ultima, setUltima] = useState(null); // Excusa recién creada (tarjeta PIN protagonista).
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [busquedaLista, setBusquedaLista] = useState('');

    const fetchLista = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/instructor/excusas');
            setLista(response.data);
        } catch (error) {
            console.error('Error fetching excusas:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cargarCatalogos = async () => {
            try {
                const [usersRes, ambRes] = await Promise.all([
                    axios.get('/api/admin/users'),
                    axios.get('/api/mis-ambientes').catch(() => axios.get('/api/ambientes'))
                ]);
                const soloAprendices = (Array.isArray(usersRes.data) ? usersRes.data : [])
                    .filter(u => u.role?.rol_name === 'Aprendiz');
                setAprendices(soloAprendices);
                setAmbientes(Array.isArray(ambRes.data) ? ambRes.data : []);
            } catch (error) {
                console.error('Error cargando aprendices/ambientes:', error);
            }
        };
        cargarCatalogos();
        fetchLista();
    }, [fetchLista]);

    useEffect(() => {
        const handleFocus = () => fetchLista();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchLista();
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchLista]);

    const filtrados = aprendices.filter(a => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return true;
        return [a.user_name, a.user_lastname, a.user_identification, String(a.user_coursenumber || '')]
            .join(' ').toLowerCase().includes(q);
    });

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    const listaVisibles = lista.filter((item) => {
        if (filtroEstado === 'vencidos') {
            if (!['expirada', 'anulada'].includes(item.estado)) return false;
        } else if (filtroEstado !== 'todos' && item.estado !== filtroEstado) {
            return false;
        }
        const q = busquedaLista.trim().toLowerCase();
        if (!q) return true;
        return `${nombrePersona(item.aprendiz)} ${item.pin || ''} ${item.motivo || ''}`.toLowerCase().includes(q);
    });

    const handleCrear = async (e) => {
        e.preventDefault();
        const errores = {};
        if (!aprendizId) errores.fk_id_aprendiz = ['Seleccione un aprendiz.'];
        if (!ambienteId) errores.fk_id_ambiente = ['Seleccione un ambiente.'];
        if (!motivo.trim()) errores.motivo = ['El motivo es obligatorio.'];
        if (Object.keys(errores).length > 0) {
            setFormErrors(errores);
            return;
        }
        setCreando(true);
        try {
            const response = await axios.post('/api/instructor/excusas', {
                fk_id_aprendiz: Number(aprendizId),
                fk_id_ambiente: Number(ambienteId),
                motivo: motivo.trim()
            });
            setUltima(response.data);
            setMotivo('');
            setFormErrors({});
            showAlert('Permiso creado. Comparte el PIN con el aprendiz.');
            fetchLista();
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al crear el permiso: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setCreando(false);
        }
    };

    const handleCopiarPin = async (pin) => {
        try {
            await navigator.clipboard.writeText(pin);
            showAlert('PIN copiado al portapapeles.');
        } catch (error) {
            showAlert('No se pudo copiar. PIN: ' + pin, 'error');
        }
    };

    const handleAnular = async (id) => {
        const confirmed = await showConfirm('¿Anular este permiso? El PIN dejará de funcionar.');
        if (!confirmed) return;
        try {
            await axios.delete(`/api/instructor/excusas/${id}`);
            showAlert('Permiso anulado.');
            if (ultima?.id_excusa === id) setUltima(null);
            fetchLista();
        } catch (error) {
            showAlert('Error al anular: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-4 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="section-header">
                    <h3 className="mb-0">Crear Permiso de Salida</h3>
                    <p className="opacity-50 small">Genera un PIN de 4 dígitos válido por 15 minutos</p>
                </div>
                <form onSubmit={handleCrear}>
                    <div className="mb-3">
                        <label className="form-label opacity-75 small">Buscar aprendiz</label>
                        <div className="input-group search-input-group">
                            <span className="input-group-text">
                                <span className="material-symbols-outlined">search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Nombre, documento o ficha..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label opacity-75 small">Aprendiz</label>
                        <div className="aprendices-picker">
                            {filtrados.length > 0 ? filtrados.map((a) => {
                                const activo = String(a.id_usuario) === String(aprendizId);
                                return (
                                    <button
                                        type="button"
                                        key={a.id_usuario}
                                        className={`aprendiz-opcion ${activo ? 'activo' : ''}`}
                                        onClick={() => {
                                            setAprendizId(String(a.id_usuario));
                                            setFormErrors(prev => {
                                                const n = { ...prev };
                                                delete n.fk_id_aprendiz;
                                                return n;
                                            });
                                        }}
                                    >
                                        <span className="selector-avatar">
                                            {a.profile_photo_path ? <img src={a.profile_photo_path} alt="" loading="lazy" /> : <>{a.user_name?.[0]}{a.user_lastname?.[0]}</>}
                                        </span>
                                        <span className="selector-datos">
                                            <strong>{a.user_name} {a.user_lastname}</strong>
                                            <small>
                                                {a.user_identification || 'Sin documento'}
                                                {a.user_coursenumber ? ` · Ficha ${a.user_coursenumber}` : ''}
                                            </small>
                                        </span>
                                        <span className="material-symbols-outlined selector-check">
                                            {activo ? 'check_circle' : 'radio_button_unchecked'}
                                        </span>
                                    </button>
                                );
                            }) : (
                                <p className="selector-vacio mb-0">No hay aprendices con esa búsqueda.</p>
                            )}
                        </div>
                        {fieldError('fk_id_aprendiz')}
                    </div>
                    <div className="mb-3">
                        <label className="form-label opacity-75 small">Ambiente</label>
                        <select
                            className={`form-control ${formErrors.fk_id_ambiente ? 'is-invalid' : ''}`}
                            value={ambienteId}
                            onChange={(e) => { setAmbienteId(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.fk_id_ambiente; return n; }); }}
                        >
                            <option value="" disabled>Seleccione un ambiente...</option>
                            {ambientes.map(amb => (
                                <option key={amb.id_ambiente} value={amb.id_ambiente}>
                                    {amb.ambiente_nombre}{amb.ambiente_ubicacion ? ` — ${amb.ambiente_ubicacion}` : ''}
                                </option>
                            ))}
                        </select>
                        {fieldError('fk_id_ambiente')}
                    </div>
                    <div className="mb-3">
                        <label className="form-label opacity-75 small">Motivo</label>
                        <textarea
                            className={`form-control ${formErrors.motivo ? 'is-invalid' : ''}`}
                            rows="3"
                            value={motivo}
                            onChange={(e) => { setMotivo(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.motivo; return n; }); }}
                            maxLength={255}
                            placeholder="Ej: Cita médica, diligencia familiar..."
                        ></textarea>
                        {fieldError('motivo')}
                    </div>
                    <button type="submit" className="btn btn-success w-100 py-2 action-btn" disabled={creando}>
                        <span className="material-symbols-outlined">key</span> {creando ? 'Generando PIN...' : 'Generar PIN'}
                    </button>
                </form>

                {ultima && (
                    <div className="glass-box-nested p-4 mt-4 text-center">
                        <p className="opacity-50 small mb-1">PIN para {nombrePersona(ultima.aprendiz)} — {nombreAmbiente(ultima)}</p>
                        <p className="fw-bold mb-3" style={{ fontSize: '3.25rem', letterSpacing: '0.5rem' }}>{ultima.pin}</p>
                        <div className="d-flex gap-2 justify-content-center flex-wrap">
                            <button className="btn btn-success action-btn px-4" onClick={() => handleCopiarPin(ultima.pin)}>
                                <span className="material-symbols-outlined">content_copy</span> Copiar
                            </button>
                            <button className="btn btn-outline-secondary action-btn px-4" onClick={() => setUltima(null)}>
                                <span className="material-symbols-outlined">close</span> Cerrar
                            </button>
                        </div>
                        <p className="opacity-50 small mt-3 mb-0">Vigente por 15 minutos. La portería lo valida al salir.</p>
                    </div>
                )}
            </div>

            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1100px' }}>
                <div className="page-cabecera mb-3">
                    <div>
                        <h3 className="page-titulo mb-1">Mis permisos</h3>
                        <p className="page-subtitulo mb-0">{listaVisibles.length} de {lista.length} permiso(s)</p>
                    </div>
                </div>

                <div className="filtros-barra">
                    <div className="buscador-sena">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por aprendiz, PIN o motivo…"
                            value={busquedaLista}
                            onChange={(e) => setBusquedaLista(e.target.value)}
                            aria-label="Buscar permisos"
                        />
                        {busquedaLista && (
                            <button type="button" className="buscador-limpiar" onClick={() => setBusquedaLista('')} aria-label="Limpiar búsqueda">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                    <div className="filtros-chips">
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'pendiente', label: 'Pendientes' },
                            { key: 'usada', label: 'Usados' },
                            { key: 'vencidos', label: 'Vencidos' }
                        ].map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                className={`chip-sena ${filtroEstado === f.key ? 'activo' : ''}`}
                                onClick={() => setFiltroEstado(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : listaVisibles.length > 0 ? (
                        <table className="table admin-table table-cards mb-0">
                            <thead>
                                <tr>
                                    <th>PIN</th>
                                    <th>Aprendiz</th>
                                    <th>Ambiente</th>
                                    <th>Motivo</th>
                                    <th>Estado</th>
                                    <th>Vence</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listaVisibles.map(item => (
                                    <tr key={item.id_excusa}>
                                        <td data-label="PIN" className="fw-bold" style={{ letterSpacing: '0.2rem' }}>{item.pin}</td>
                                        <td data-label="Aprendiz">{nombrePersona(item.aprendiz)}</td>
                                        <td data-label="Ambiente">{nombreAmbiente(item)}</td>
                                        <td data-label="Motivo"><small className="opacity-75">{item.motivo}</small></td>
                                        <td data-label="Estado">
                                            <span className={`badge ${ESTADO_BADGE[item.estado] || 'badge-soft-secondary'} px-3 py-2`}>{item.estado}</span>
                                        </td>
                                        <td data-label="Vence">{item.expira_en ? new Date(item.expira_en).toLocaleString() : '—'}</td>
                                        <td data-label="Acciones">
                                            {item.estado === 'pendiente' && (
                                                <button className="btn btn-sm btn-outline-danger p-1 d-flex align-items-center" title="Anular permiso" onClick={() => handleAnular(item.id_excusa)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="estado-vacio">
                            <span className="material-symbols-outlined">key_off</span>
                            <p className="mb-0">{lista.length === 0 ? 'Aún no has creado permisos.' : 'No hay permisos con ese filtro.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- ADMIN: valida PIN en portería + bandeja con estados ----------
const ExcusasAdmin = () => {
    const [pin, setPin] = useState('');
    const [validando, setValidando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [errorPin, setErrorPin] = useState('');
    const [bandeja, setBandeja] = useState([]);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchBandeja = useCallback(async (estado = '') => {
        try {
            setLoading(true);
            const params = estado ? `?estado=${estado}` : '';
            const response = await axios.get(`/api/admin/excusas${params}`);
            setBandeja(response.data);
        } catch (error) {
            console.error('Error fetching excusas:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBandeja(filtroEstado);
    }, [fetchBandeja, filtroEstado]);

    useEffect(() => {
        const handleFocus = () => fetchBandeja(filtroEstado);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchBandeja(filtroEstado);
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchBandeja, filtroEstado]);

    const handleValidar = async (e) => {
        e.preventDefault();
        setResultado(null);
        setErrorPin('');
        if (!pin.trim()) {
            setErrorPin('Digite el PIN del aprendiz.');
            return;
        }
        setValidando(true);
        try {
            const response = await axios.post('/api/excusas/validar', { pin: pin.trim() });
            setResultado(response.data);
            setPin('');
            showAlert(response.data.message || 'Salida autorizada. PIN validado.');
            fetchBandeja(filtroEstado);
        } catch (error) {
            setErrorPin(error.response?.data?.message || 'Error al validar el PIN.');
        } finally {
            setValidando(false);
        }
    };

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-4 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="section-header">
                    <h3 className="mb-0">Validar permiso de salida</h3>
                    <p className="opacity-50 small">PIN de 4 dígitos · vigencia de 15 minutos · un solo uso</p>
                </div>
                <form onSubmit={handleValidar}>
                    <div className="mb-3">
                        <label className="form-label opacity-75 small">PIN del permiso</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            className={`form-control text-center fw-bold ${errorPin ? 'is-invalid' : ''}`}
                            style={{ fontSize: '1.75rem', letterSpacing: '0.5rem' }}
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setErrorPin(''); }}
                            placeholder="••••"
                        />
                        {errorPin && <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{errorPin}</div>}
                    </div>
                    <button type="submit" className="btn btn-success w-100 py-2 action-btn" disabled={validando}>
                        <span className="material-symbols-outlined">qr_code_scanner</span> {validando ? 'Validando...' : 'Validar y Registrar Salida'}
                    </button>
                </form>

                {resultado && (
                    <div className="glass-box-nested p-4 mt-4">
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-success">check_circle</span>
                            <p className="mb-0 fw-bold text-success">{resultado.message}</p>
                        </div>
                        <p className="mb-1"><span className="opacity-50 small">Aprendiz: </span><span className="fw-bold">{nombrePersona(resultado.aprendiz)}</span></p>
                        {resultado.aprendiz?.user_identification && (
                            <p className="mb-1"><span className="opacity-50 small">Documento: </span>{resultado.aprendiz.user_identification}</p>
                        )}
                        <p className="mb-0"><span className="opacity-50 small">Ambiente: </span>{resultado.excusa ? nombreAmbiente(resultado.excusa) : '—'}</p>
                    </div>
                )}
            </div>

            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">Bandeja de Permisos</h3>
                        <p className="opacity-50 small">Total: {bandeja.length} permiso(s)</p>
                    </div>
                    <select className="form-select" style={{ maxWidth: '200px' }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="usada">Usadas</option>
                        <option value="anulada">Anuladas</option>
                        <option value="expirada">Expiradas</option>
                    </select>
                </div>
                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : bandeja.length > 0 ? (
                        <table className="table admin-table table-cards mb-0">
                            <thead>
                                <tr>
                                    <th>PIN</th>
                                    <th>Aprendiz</th>
                                    <th>Ambiente</th>
                                    <th>Instructor</th>
                                    <th>Motivo</th>
                                    <th>Estado</th>
                                    <th>Vence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bandeja.map(item => (
                                    <tr key={item.id_excusa}>
                                        <td data-label="PIN" className="fw-bold" style={{ letterSpacing: '0.2rem' }}>{item.pin}</td>
                                        <td data-label="Aprendiz">{nombrePersona(item.aprendiz)}</td>
                                        <td data-label="Ambiente">{nombreAmbiente(item)}</td>
                                        <td data-label="Instructor">{nombrePersona(item.instructor)}</td>
                                        <td data-label="Motivo"><small className="opacity-75">{item.motivo}</small></td>
                                        <td data-label="Estado">
                                            <span className={`badge ${ESTADO_BADGE[item.estado] || 'badge-soft-secondary'} px-3 py-2`}>{item.estado}</span>
                                        </td>
                                        <td data-label="Vence">{item.expira_en ? new Date(item.expira_en).toLocaleString() : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>inbox</span>
                            <p className="mt-2">No hay permisos en este estado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- APRENDIZ: mis permisos con PIN, estado y vigencia ----------
const MisExcusas = () => {
    const [excusas, setExcusas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ahora, setAhora] = useState(Date.now());
    const [filtro, setFiltro] = useState('todos');

    const fetchExcusas = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/mis-excusas');
            setExcusas(response.data);
        } catch (error) {
            console.error('Error fetching mis excusas:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExcusas();
    }, [fetchExcusas]);

    useEffect(() => {
        const handleFocus = () => fetchExcusas();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchExcusas();
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchExcusas]);

    useEffect(() => {
        const hayPendientes = excusas.some(e => e.estado === 'pendiente');
        if (!hayPendientes) return;
        const timer = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [excusas]);

    const visibles = excusas.filter((e) => {
        if (filtro === 'todos') return true;
        if (filtro === 'vencidos') return ['expirada', 'anulada'].includes(e.estado);
        return e.estado === filtro;
    });

    const copiarPin = async (pin) => {
        try {
            await navigator.clipboard.writeText(pin);
            showAlert('PIN copiado. Preséntalo en portería.');
        } catch (_) {
            showAlert('No se pudo copiar el PIN: ' + pin, 'error');
        }
    };

    return (
        <div className="fade-in-up mx-auto" style={{ maxWidth: '1100px' }}>
            <div className="page-cabecera">
                <div>
                    <h3 className="page-titulo mb-1">Permisos de salida</h3>
                    <p className="page-subtitulo mb-0">
                        {excusas.length} permiso{excusas.length === 1 ? '' : 's'} · presenta el PIN en portería
                    </p>
                </div>
            </div>

            <div className="filtros-barra">
                <div className="filtros-chips">
                    {[
                        { key: 'todos', label: 'Todos' },
                        { key: 'pendiente', label: 'Pendientes' },
                        { key: 'usada', label: 'Usados' },
                        { key: 'vencidos', label: 'Vencidos' }
                    ].map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`chip-sena ${filtro === f.key ? 'activo' : ''}`}
                            onClick={() => setFiltro(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Cargando…</span>
                    </div>
                </div>
            ) : visibles.length > 0 ? (
                <div className="grid-permisos">
                    {visibles.map((item) => {
                        const pendiente = item.estado === 'pendiente';
                        return (
                            <article className={`permiso-card glass-box ${pendiente ? 'pendiente' : ''}`} key={item.id_excusa}>
                                <div className="permiso-card-head">
                                    <span className={`badge ${ESTADO_BADGE[item.estado] || 'badge-soft-secondary'} px-3 py-2`}>
                                        {item.estado}
                                    </span>
                                    {pendiente && item.expira_en && (
                                        <span className="permiso-vigencia">
                                            <span className="material-symbols-outlined">timer</span>
                                            {restoVigencia(item.expira_en, ahora)}
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="permiso-pin"
                                    onClick={() => copiarPin(item.pin)}
                                    title="Copiar PIN"
                                >
                                    {item.pin}
                                </button>

                                <div className="permiso-meta">
                                    <strong>{nombreAmbiente(item)}</strong>
                                    <span>{nombrePersona(item.instructor)}</span>
                                </div>

                                <p className="permiso-motivo">{item.motivo}</p>

                                <button
                                    type="button"
                                    className="btn btn-outline-success btn-sm action-btn w-100 mt-auto"
                                    onClick={() => copiarPin(item.pin)}
                                >
                                    <span className="material-symbols-outlined small">content_copy</span> Copiar PIN
                                </button>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="estado-vacio">
                    <span className="material-symbols-outlined">key_off</span>
                    <p className="mb-0">
                        {excusas.length === 0
                            ? 'No tienes permisos de salida. Pide a tu instructor que genere uno.'
                            : 'No hay permisos con ese filtro.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default Excusas;
