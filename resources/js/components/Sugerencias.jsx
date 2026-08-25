import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { showAlert, showConfirm } from './CustomAlert';

const CATEGORIAS = ['Sistema', 'Ambientes', 'Procesos', 'Otro'];
const ESTADOS = ['Pendiente', 'En revisión', 'Implementada', 'Rechazada'];

const ESTADO_BADGE = {
    'Pendiente': 'badge-soft-warning',
    'En revisión': 'badge-soft-info',
    'Implementada': 'badge-soft-success',
    'Rechazada': 'badge-soft-secondary'
};

const CATEGORIA_ICONO = {
    'Sistema': 'terminal',
    'Ambientes': 'meeting_room',
    'Procesos': 'account_tree',
    'Otro': 'category'
};

const Sugerencias = ({ currentUser, initialMode = 'form' }) => {
    const isAdmin = currentUser?.role?.rol_name === 'admin'; //CONVENCION: EL ROL ADMIN ES MINUSCULA

    const [sugerencias, setSugerencias] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState(initialMode); // 'form' | 'history'
    const [formErrors, setFormErrors] = useState({});
    const [formData, setFormData] = useState({
        sugerencia_asunto: '',
        sugerencia_categoria: '',
        sugerencia_body: ''
    });

    // Estados de la bandeja del admin
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('');
    const [page, setPage] = useState(1);
    const [respondiendo, setRespondiendo] = useState(null); // Sugerencia en el modal de respuesta
    const [respuestaData, setRespuestaData] = useState({ respuesta_admin: '', sugerencia_status: 'En revisión' });
    const [respuestaErrors, setRespuestaErrors] = useState({});

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const fetchSugerencias = useCallback(async (search = '', status = '', categoria = '', pageNum = 1) => {
        try {
            setLoading(true);
            if (isAdmin) {
                const params = new URLSearchParams({ page: String(pageNum) });
                if (search) params.append('q', search);
                if (status) params.append('status', status);
                if (categoria) params.append('categoria', categoria);
                const response = await axios.get(`/api/sugerencias?${params.toString()}`);
                setSugerencias(response.data.data);
                setMeta(response.data);
            } else {
                const response = await axios.get('/api/my-sugerencias');
                setSugerencias(response.data);
                setMeta(null);
            }
        } catch (error) {
            console.error('Error fetching sugerencias:', error);
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchSugerencias(searchTerm, filterStatus, filterCategoria, page);
    }, [fetchSugerencias, mode, filterStatus, filterCategoria, page]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPage(1);
        fetchSugerencias(e.target.value, filterStatus, filterCategoria, 1);
    };

    const handleFilterChange = (setter) => (e) => {
        setter(e.target.value);
        setPage(1);
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
            await axios.post('/api/sugerencias', formData);
            showAlert('Sugerencia enviada con éxito. ¡Gracias por ayudarnos a mejorar!');
            setFormErrors({});
            setFormData({ sugerencia_asunto: '', sugerencia_categoria: '', sugerencia_body: '' });
            setMode('history');
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al enviar la sugerencia: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const openResponder = (sugerencia) => {
        setRespondiendo(sugerencia);
        setRespuestaData({
            respuesta_admin: sugerencia.respuesta_admin || '',
            sugerencia_status: sugerencia.sugerencia_status === 'Pendiente' ? 'En revisión' : sugerencia.sugerencia_status
        });
        setRespuestaErrors({});
    };

    const handleRespuestaChange = (e) => {
        setRespuestaData({
            ...respuestaData,
            [e.target.name]: e.target.value
        });
        if (respuestaErrors[e.target.name]) {
            setRespuestaErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    const handleResponderSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`/api/admin/sugerencias/${respondiendo.id_sugerencia}/responder`, respuestaData);
            showAlert('Respuesta enviada. El autor fue notificado.');
            setRespondiendo(null);
            fetchSugerencias(searchTerm, filterStatus, filterCategoria, page);
        } catch (error) {
            if (error.response?.data?.errors) {
                setRespuestaErrors(error.response.data.errors);
            }
            showAlert('Error al responder: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar esta sugerencia?');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/sugerencias/${id}`);
                showAlert('Sugerencia eliminada');
                fetchSugerencias(searchTerm, filterStatus, filterCategoria, page);
            } catch (error) {
                showAlert('Error al eliminar la sugerencia', 'error');
            }
        }
    };

    const fieldError = (name, errors) => (
        errors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{errors[name][0]}</div> : null
    );

    const renderBadgeEstado = (estado) => (
        <span className={`badge ${ESTADO_BADGE[estado] || 'badge-soft-secondary'} px-3 py-2`}>{estado}</span>
    );

    // ---------- FORMULARIO DE ENVÍO (APRENDIZ / INSTRUCTOR) ----------
    const renderForm = () => (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="section-header">
                    <h3 className="mb-0">Enviar Sugerencia</h3>
                    <p className="opacity-50 small">Comparte tus ideas para mejorar SenaAccess o el centro de formación</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="row">
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Asunto</label>
                            <input
                                type="text"
                                name="sugerencia_asunto"
                                className={`form-control ${formErrors.sugerencia_asunto ? 'is-invalid' : ''}`}
                                value={formData.sugerencia_asunto}
                                onChange={handleChange}
                                required
                                maxLength={150}
                                placeholder="Ej: Agregar filtro por ficha en el historial..."
                            />
                            {fieldError('sugerencia_asunto', formErrors)}
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Categoría</label>
                            <select
                                name="sugerencia_categoria"
                                className={`form-control ${formErrors.sugerencia_categoria ? 'is-invalid' : ''}`}
                                value={formData.sugerencia_categoria}
                                onChange={handleChange}
                                required
                            >
                                <option value="" disabled>Seleccione una categoría...</option>
                                {CATEGORIAS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            {fieldError('sugerencia_categoria', formErrors)}
                        </div>
                        <div className="col-12 mb-3">
                            <label className="form-label opacity-75 small">Descripción</label>
                            <textarea
                                name="sugerencia_body"
                                className={`form-control ${formErrors.sugerencia_body ? 'is-invalid' : ''}`}
                                rows="5"
                                value={formData.sugerencia_body}
                                onChange={handleChange}
                                required
                                placeholder="Describe tu sugerencia con detalle: ¿qué propones y qué problema resuelve?"
                            ></textarea>
                            {fieldError('sugerencia_body', formErrors)}
                        </div>
                    </div>
                    <div className="mt-4">
                        <button type="submit" className="btn btn-success w-100 py-2 action-btn">
                            <span className="material-symbols-outlined">send</span> Enviar Sugerencia
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // ---------- HISTORIAL PROPIO (APRENDIZ / INSTRUCTOR) ----------
    const renderHistory = () => (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1000px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">Mis Sugerencias</h3>
                        <p className="opacity-50 small">Total: {sugerencias.length} enviada(s)</p>
                    </div>
                    <button className="btn btn-success action-btn d-flex align-items-center gap-2" onClick={() => setMode('form')}>
                        <span className="material-symbols-outlined">add_circle</span> Nueva Sugerencia
                    </button>
                </div>

                <div className="admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : sugerencias.length > 0 ? (
                        <table className="table admin-table table-cards mb-0">
                            <thead>
                                <tr>
                                    <th>Asunto</th>
                                    <th>Categoría</th>
                                    <th>Estado</th>
                                    <th>Respuesta</th>
                                    <th>Fecha de Envío</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sugerencias.map(item => (
                                    <tr key={item.id_sugerencia}>
                                        <td data-label="Asunto" className="fw-bold">{item.sugerencia_asunto}</td>
                                        <td data-label="Categoría">
                                            <span className="badge badge-soft-primary px-3 py-2">
                                                <span className="material-symbols-outlined me-1" style={{ fontSize: '14px' }}>{CATEGORIA_ICONO[item.sugerencia_categoria] || 'category'}</span>
                                                {item.sugerencia_categoria}
                                            </span>
                                        </td>
                                        <td data-label="Estado">{renderBadgeEstado(item.sugerencia_status)}</td>
                                        <td data-label="Respuesta">
                                            {item.respuesta_admin ? (
                                                <div>
                                                    <p className="mb-1" style={{ fontSize: '0.85rem' }}>{item.respuesta_admin}</p>
                                                    <small className="opacity-50">Respondida: {new Date(item.responded_at).toLocaleString()}</small>
                                                </div>
                                            ) : (
                                                <span className="opacity-50">Sin respuesta aún</span>
                                            )}
                                        </td>
                                        <td data-label="Fecha de Envío">{new Date(item.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>lightbulb</span>
                            <p className="mt-2">Aún no has enviado sugerencias</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ---------- BANDEJA DE GESTIÓN (ADMIN) ----------
    const renderAdmin = () => (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">Buzón de Sugerencias</h3>
                        <p className="opacity-50 small">{meta ? `${meta.total} sugerencia(s) en total` : ''}</p>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        <div className="input-group search-input-group" style={{ maxWidth: '260px' }}>
                            <span className="input-group-text">
                                <span className="material-symbols-outlined">search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar asunto o autor..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        <select className="form-select" style={{ maxWidth: '160px' }} value={filterStatus} onChange={handleFilterChange(setFilterStatus)}>
                            <option value="">Todos los estados</option>
                            {ESTADOS.map(est => <option key={est} value={est}>{est}</option>)}
                        </select>
                        <select className="form-select" style={{ maxWidth: '150px' }} value={filterCategoria} onChange={handleFilterChange(setFilterCategoria)}>
                            <option value="">Todas las categorías</option>
                            {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>

                <div className="admin-scrollable-container" style={{ maxHeight: '58vh' }}>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : sugerencias.length > 0 ? (
                        <table className="table admin-table table-cards mb-0">
                            <thead>
                                <tr>
                                    <th>Autor</th>
                                    <th>Asunto</th>
                                    <th>Categoría</th>
                                    <th>Estado</th>
                                    <th>Fecha</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sugerencias.map(item => (
                                    <tr key={item.id_sugerencia}>
                                        <td data-label="Autor">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="rounded-circle bg-success bg-opacity-20 d-flex align-items-center justify-content-center text-success fw-bold" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                                    {item.user?.user_name?.[0]}{item.user?.user_lastname?.[0]}
                                                </div>
                                                <div>
                                                    <p className="mb-0 fw-bold" style={{ fontSize: '0.85rem' }}>{item.user?.user_name} {item.user?.user_lastname}</p>
                                                    <small className="opacity-50">{item.user?.role?.rol_name || ''}</small>
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Asunto">
                                            <p className="mb-0 fw-bold" style={{ fontSize: '0.85rem' }}>{item.sugerencia_asunto}</p>
                                            <small className="opacity-50 d-inline-block text-truncate" style={{ maxWidth: '280px' }}>{item.sugerencia_body}</small>
                                        </td>
                                        <td data-label="Categoría">
                                            <span className="badge badge-soft-primary px-3 py-2">
                                                <span className="material-symbols-outlined me-1" style={{ fontSize: '14px' }}>{CATEGORIA_ICONO[item.sugerencia_categoria] || 'category'}</span>
                                                {item.sugerencia_categoria}
                                            </span>
                                        </td>
                                        <td data-label="Estado">{renderBadgeEstado(item.sugerencia_status)}</td>
                                        <td data-label="Fecha">{new Date(item.created_at).toLocaleString()}</td>
                                        <td data-label="Acciones">
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-sm btn-outline-success p-1 d-flex align-items-center" title="Responder" onClick={() => openResponder(item)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>reply</span>
                                                </button>
                                                <button className="btn btn-sm btn-outline-danger p-1 d-flex align-items-center" title="Eliminar" onClick={() => handleDelete(item.id_sugerencia)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>inbox</span>
                            <p className="mt-2">No se encontraron sugerencias</p>
                        </div>
                    )}
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                        <small className="opacity-50">Página {meta.current_page} de {meta.last_page}</small>
                        <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success action-btn" disabled={meta.current_page <= 1} onClick={() => setPage(page - 1)}>
                                <span className="material-symbols-outlined">chevron_left</span> Anterior
                            </button>
                            <button className="btn btn-sm btn-outline-success action-btn" disabled={meta.current_page >= meta.last_page} onClick={() => setPage(page + 1)}>
                                Siguiente <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de respuesta */}
            {respondiendo && (
                <div className="custom-alert-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.45)', animation: 'fadeIn 0.25s ease-out' }}>
                    <div className="glass-box modal-glass-box p-4 p-md-5 mx-3" style={{ maxWidth: '560px', width: '100%', animation: 'scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
                        <div className="section-header mb-4">
                            <h3 className="mb-0">Responder sugerencia</h3>
                            <p className="opacity-50 small mb-0">De {respondiendo.user?.user_name} {respondiendo.user?.user_lastname}: "{respondiendo.sugerencia_asunto}"</p>
                        </div>
                        <div className="glass-box-nested equipo-detail-card p-3 mb-4" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            <p className="mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>{respondiendo.sugerencia_body}</p>
                        </div>
                        <form onSubmit={handleResponderSubmit}>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Nuevo estado</label>
                                <select
                                    name="sugerencia_status"
                                    className="form-select"
                                    value={respuestaData.sugerencia_status}
                                    onChange={handleRespuestaChange}
                                    required
                                >
                                    {ESTADOS.filter(est => est !== 'Pendiente').map(est => (
                                        <option key={est} value={est}>{est}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Respuesta para el autor</label>
                                <textarea
                                    name="respuesta_admin"
                                    className={`form-control ${respuestaErrors.respuesta_admin ? 'is-invalid' : ''}`}
                                    rows="4"
                                    value={respuestaData.respuesta_admin}
                                    onChange={handleRespuestaChange}
                                    required
                                    placeholder="Explica la decisión tomada sobre esta sugerencia..."
                                ></textarea>
                                {fieldError('respuesta_admin', respuestaErrors)}
                            </div>
                            <div className="d-flex gap-2 justify-content-end mt-4 flex-wrap">
                                <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={() => setRespondiendo(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-success action-btn px-4">
                                    <span className="material-symbols-outlined">send</span> Enviar Respuesta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    if (isAdmin) {
        return renderAdmin();
    }

    return mode === 'form' ? renderForm() : renderHistory();
};

export default Sugerencias;
