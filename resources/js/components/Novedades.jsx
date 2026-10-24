import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { showAlert, showConfirm } from './CustomAlert';
import { fechaBogota, horaBogota } from '../utils/formato';

const LEIDAS_KEY = 'novedades_leidas';

const leerLeidas = () => {
    try {
        return new Set(JSON.parse(localStorage.getItem(LEIDAS_KEY) || '[]'));
    } catch (_) {
        return new Set();
    }
};

const diaBogota = (valor) => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(valor));
    } catch (_) {
        return '';
    }
};

const Novedades = ({ currentUser, initialMode = 'history' }) => {
    const [novedades, setNovedades] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState(initialMode); // 'form' or 'history'
    const [formErrors, setFormErrors] = useState({});
    const [formData, setFormData] = useState({
        novedad_ambiente: '',
        novedad_title: '',
        novedad_body: ''
    });
    const [filtro, setFiltro] = useState('todas'); // todas | nuevas | hoy | semana
    const [ambiente, setAmbiente] = useState('');
    const [leidas, setLeidas] = useState(leerLeidas);

    const esSuperadmin = (currentUser?.role?.rol_name || '').toLowerCase() === 'superadmin';

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const fetchNovedades = async (search = '') => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/novedades?search=${search}`);
            setNovedades(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching novedades:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mode === 'history') fetchNovedades();
    }, [mode]);

    useEffect(() => {
        const handleFocus = () => fetchNovedades(searchTerm);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchNovedades(searchTerm);
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [searchTerm]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        fetchNovedades(e.target.value);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (formErrors[e.target.name]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/novedades', formData);
            showAlert('Novedad registrada con éxito');
            setFormErrors({});
            setFormData({
                novedad_ambiente: '',
                novedad_title: '',
                novedad_body: ''
            });
            setMode('history');
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al registrar la novedad: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar esta novedad?');
        if (confirmed) {
            try {
                await axios.delete(`/api/novedades/${id}`);
                showAlert('Novedad eliminada');
                fetchNovedades(searchTerm);
            } catch (error) {
                showAlert('Error al eliminar la novedad', 'error');
            }
        }
    };

    const marcarLeida = (id) => {
        setLeidas((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem(LEIDAS_KEY, JSON.stringify([...next]));
            } catch (_) { /* sin almacenamiento: solo dura la sesión */ }
            return next;
        });
    };

    const ambientes = useMemo(
        () => [...new Set(novedades.map((n) => n.novedad_ambiente).filter(Boolean))].sort(),
        [novedades]
    );

    const visibles = useMemo(() => {
        const hoy = diaBogota(new Date());
        const limiteSemana = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return novedades.filter((n) => {
            if (ambiente && n.novedad_ambiente !== ambiente) return false;
            if (filtro === 'nuevas' && leidas.has(n.id_novedad)) return false;
            if (filtro === 'hoy' && diaBogota(n.novedad_datetime) !== hoy) return false;
            if (filtro === 'semana' && new Date(n.novedad_datetime).getTime() < limiteSemana) return false;
            return true;
        });
    }, [novedades, ambiente, filtro, leidas]);

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    const renderForm = () => (
        <div className="fade-in-up mx-auto" style={{ maxWidth: '760px' }}>
            <div className="page-cabecera">
                <div>
                    <h3 className="page-titulo mb-1">Reportar novedad</h3>
                    <p className="page-subtitulo mb-0">Incidentes y novedades de los ambientes de formación</p>
                </div>
                <div className="page-acciones">
                    <button type="button" className="btn btn-outline-secondary action-btn" onClick={() => setMode('history')}>
                        <span className="material-symbols-outlined">arrow_back</span> Volver
                    </button>
                </div>
            </div>

            <div className="glass-box p-4" style={{ maxWidth: '760px' }}>
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Lugar / ambiente</label>
                            <input
                                type="text"
                                name="novedad_ambiente"
                                className={`form-control ${formErrors.novedad_ambiente ? 'is-invalid' : ''}`}
                                value={formData.novedad_ambiente}
                                onChange={handleChange}
                                required
                                placeholder="Ej: Ambiente 302, Auditorio, Biblioteca…"
                            />
                            {fieldError('novedad_ambiente')}
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Título</label>
                            <input
                                type="text"
                                name="novedad_title"
                                className={`form-control ${formErrors.novedad_title ? 'is-invalid' : ''}`}
                                value={formData.novedad_title}
                                onChange={handleChange}
                                required
                                placeholder="Ej: Fallo en proyector, silla rota…"
                            />
                            {fieldError('novedad_title')}
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Descripción</label>
                            <textarea
                                name="novedad_body"
                                className={`form-control ${formErrors.novedad_body ? 'is-invalid' : ''}`}
                                rows="5"
                                value={formData.novedad_body}
                                onChange={handleChange}
                                required
                                placeholder="Explica qué ocurrió y el estado del ambiente…"
                            ></textarea>
                            {fieldError('novedad_body')}
                        </div>
                    </div>
                    <button type="submit" className="btn btn-success w-100 py-2 action-btn">
                        <span className="material-symbols-outlined">report_problem</span> Registrar novedad
                    </button>
                </form>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="fade-in-up mx-auto" style={{ maxWidth: '1100px' }}>
            <div className="page-cabecera">
                <div>
                    <h3 className="page-titulo mb-1">Novedades</h3>
                    <p className="page-subtitulo mb-0">
                        {novedades.length} registro{novedades.length === 1 ? '' : 's'} · {visibles.length} en pantalla
                    </p>
                </div>
                <div className="page-acciones">
                    <button type="button" className="btn btn-success action-btn" onClick={() => setMode('form')}>
                        <span className="material-symbols-outlined">add_circle</span> Reportar novedad
                    </button>
                </div>
            </div>

            <div className="filtros-barra">
                <div className="buscador-sena">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por título, descripción o ambiente…"
                        value={searchTerm}
                        onChange={handleSearch}
                        aria-label="Buscar novedades"
                    />
                    {searchTerm && (
                        <button type="button" className="buscador-limpiar" onClick={() => { setSearchTerm(''); fetchNovedades(''); }} aria-label="Limpiar búsqueda">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                <div className="filtros-chips">
                    {[
                        { key: 'todas', label: 'Todas' },
                        { key: 'nuevas', label: 'Nuevas' },
                        { key: 'hoy', label: 'Hoy' },
                        { key: 'semana', label: 'Esta semana' }
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
                    <select
                        className="filtro-select"
                        value={ambiente}
                        onChange={(e) => setAmbiente(e.target.value)}
                        aria-label="Filtrar por ambiente"
                    >
                        <option value="">Todos los ambientes</option>
                        {ambientes.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
            </div>

            <div className="feed-novedades">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Cargando…</span>
                        </div>
                    </div>
                ) : visibles.length > 0 ? (
                    visibles.map((novedad) => {
                        const nueva = !leidas.has(novedad.id_novedad);
                        const autor = `${novedad.user?.user_name || ''} ${novedad.user?.user_lastname || ''}`.trim() || 'Usuario';
                        return (
                            <article
                                key={novedad.id_novedad}
                                className={`novedad-item glass-box ${nueva ? 'nueva' : ''}`}
                                onClick={() => marcarLeida(novedad.id_novedad)}
                                title={nueva ? 'Marcar como leída' : 'Leída'}
                            >
                                <span className="novedad-avatar">{autor[0]}</span>
                                <div className="novedad-contenido">
                                    <div className="novedad-cabecera">
                                        <span className="novedad-ambiente">{novedad.novedad_ambiente}</span>
                                        {nueva && <span className="novedad-nueva">Nueva</span>}
                                        <span className="novedad-fecha">
                                            {fechaBogota(novedad.novedad_datetime)} · {horaBogota(novedad.novedad_datetime)}
                                        </span>
                                    </div>
                                    <h4 className="novedad-titulo">{novedad.novedad_title}</h4>
                                    <p className="novedad-texto">{novedad.novedad_body}</p>
                                    <div className="novedad-autor">
                                        <span className="material-symbols-outlined">person</span>
                                        {autor}
                                    </div>
                                </div>
                                {esSuperadmin && (
                                    <button
                                        type="button"
                                        className="novedad-eliminar"
                                        title="Eliminar novedad"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(novedad.id_novedad); }}
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                )}
                            </article>
                        );
                    })
                ) : (
                    <div className="estado-vacio">
                        <span className="material-symbols-outlined">event_busy</span>
                        <p className="mb-0">No hay novedades con esos filtros.</p>
                    </div>
                )}
            </div>
        </div>
    );

    return mode === 'form' ? renderForm() : renderHistory();
};

export default Novedades;
