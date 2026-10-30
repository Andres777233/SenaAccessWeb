import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import StatsDashboard from './StatsDashboard';
import Excusas from './Excusas';
import QrInvitado from './QrInvitado';
import UserQrCarnet from './UserQrCarnet';
import AccesoQr from './AccesoQr';
import EquipmentForm from './EquipmentForm';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import SimulacionHuella from './SimulacionHuella';
import PerfilSena from './PerfilSena';
import EditarMiPerfil from './EditarMiPerfil';
import ModalExportar from './ModalExportar';
import { showAlert, showConfirm } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { mensajeDeError } from '../utils/mensajes';
import { corregirRolDePanel, limpiarSesionLocal } from '../utils/sesion';
import { getToken } from '../utils/auth';

// Panel de Portería: operación diaria sin gestión de usuarios ni ambientes.
// Historial del centro, validar PIN de excusas, inventario de
// equipos (registrar/devolver/eliminar) y escáner QR de invitados.
const Portero = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    // Historial global de accesos (GET /api/admin/ingresos, paginado).
    const [ingresos, setIngresos] = useState([]);
    const [ingresosMeta, setIngresosMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [historialLoading, setHistorialLoading] = useState(false);
    const [searchTermIngresos, setSearchTermIngresos] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');

    // Inventario de equipos (GET /api/admin/equipment).
    const [equipmentList, setEquipmentList] = useState([]);
    const [searchTermEquipment, setSearchTermEquipment] = useState('');
    const [estadoEquipo, setEstadoEquipo] = useState('');

    // Exportaciones (historial y equipos).
    const [exportAbierto, setExportAbierto] = useState(false);
    const [exportFormato, setExportFormato] = useState('pdf');
    const [exportando, setExportando] = useState(false);
    const [exportEquiposAbierto, setExportEquiposAbierto] = useState(false);
    const [exportEquiposFormato, setExportEquiposFormato] = useState('pdf');
    const [exportEquiposExportando, setExportEquiposExportando] = useState(false);
    const filtrosIniciados = React.useRef(false);

    // Perfil propio (PUT /api/my-profile, multipart + _method=PUT).
    const [editingProfile, setEditingProfile] = useState(false);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = getToken();
                if (!token) {
                    navigate('/login');
                    return;
                }
                // Primero se valida el rol real; luego se piden los datos
                // operativos, que solo acepta el rol Admin (portería).
                const userMeResponse = await axios.get('/api/user');
                if (!corregirRolDePanel(userMeResponse.data, 'admin', navigate)) return;
                const [ingresosResponse, equipmentResponse] = await Promise.all([
                    axios.get('/api/admin/ingresos?per_page=15'),
                    axios.get('/api/admin/equipment')
                ]);
                setCurrentUser(userMeResponse.data);
                setIngresos(ingresosResponse.data.data || []);
                setIngresosMeta({
                    current_page: ingresosResponse.data.current_page || 1,
                    last_page: ingresosResponse.data.last_page || 1,
                    total: ingresosResponse.data.total || 0
                });
                setEquipmentList(Array.isArray(equipmentResponse.data) ? equipmentResponse.data : []);
            } catch (error) {
                console.error('Error cargando datos: ', error);
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    limpiarSesionLocal();
                    navigate('/login');
                } else {
                    showAlert(mensajeDeError(error, 'No se pudieron cargar los datos del panel.'), 'error');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const fetchIngresos = async (page = 1) => {
        try {
            setHistorialLoading(true);
            const params = new URLSearchParams({ page: String(page) });
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);
            const response = await axios.get(`/api/admin/ingresos?${params.toString()}`);
            setIngresos(response.data.data || []);
            setIngresosMeta({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                total: response.data.total || 0
            });
        } catch (error) {
            console.error('Error al cargar ingresos:', error);
        } finally {
            setHistorialLoading(false);
        }
    };

    // Los filtros de tipo/fecha se aplican solos (con un respiro de 350 ms).
    useEffect(() => {
        if (!filtrosIniciados.current) {
            filtrosIniciados.current = true;
            return undefined;
        }
        const t = setTimeout(() => fetchIngresos(1), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterTipo, filterDesde, filterHasta]);

    const descargarBlob = (data, nombre) => {
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const abrirExportar = () => {
        setExportFormato('pdf');
        setExportAbierto(true);
    };

    const descargarExportacion = async () => {
        try {
            setExportando(true);
            const params = new URLSearchParams();
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);
            params.append('formato', exportFormato);
            const resp = await axios.get(`/api/admin/ingresos/export?${params.toString()}`, { responseType: 'blob' });
            const ext = exportFormato === 'xlsx' ? 'xlsx' : 'pdf';
            descargarBlob(resp.data, `historial_accesos_${new Date().toISOString().slice(0, 10)}.${ext}`);
            setExportAbierto(false);
            showAlert('Exportación generada');
        } catch (_) {
            showAlert('No se pudo generar la exportación. Intenta de nuevo.', 'error');
        } finally {
            setExportando(false);
        }
    };

    const abrirExportarEquipos = () => {
        setExportEquiposFormato('pdf');
        setExportEquiposAbierto(true);
    };

    const descargarExportacionEquipos = async () => {
        try {
            setExportEquiposExportando(true);
            const params = new URLSearchParams();
            if (searchTermEquipment) params.append('q', searchTermEquipment);
            if (estadoEquipo) params.append('estado', estadoEquipo);
            params.append('formato', exportEquiposFormato);
            const resp = await axios.get(`/api/admin/equipment/export?${params.toString()}`, { responseType: 'blob' });
            const ext = exportEquiposFormato === 'docx' ? 'doc' : 'pdf';
            descargarBlob(resp.data, `inventario_equipos_${new Date().toISOString().slice(0, 10)}.${ext}`);
            setExportEquiposAbierto(false);
            showAlert('Exportación generada');
        } catch (_) {
            showAlert('No se pudo generar la exportación. Intenta de nuevo.', 'error');
        } finally {
            setExportEquiposExportando(false);
        }
    };

    const fechaInput = (offsetDias = 0) => new Date(Date.now() + offsetDias * 86400000)
        .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const presetRango = (dias) => {
        setFilterDesde(fechaInput(-(dias - 1)));
        setFilterHasta(fechaInput(0));
    };

    const presetDia = (offset) => {
        setFilterDesde(fechaInput(offset));
        setFilterHasta(fechaInput(offset));
    };

    const limpiarFiltrosHistorial = () => {
        setSearchTermIngresos('');
        setFilterTipo('');
        setFilterDesde('');
        setFilterHasta('');
        fetchIngresos(1);
    };

    const fetchEquipment = async () => {
        try {
            const response = await axios.get('/api/admin/equipment');
            setEquipmentList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error al refrescar equipos:', error);
        }
    };

    // Descarga el comprobante PDF del equipo indicado (portero ve cualquiera).
    const handleDescargarComprobante = async (item) => {
        try {
            await downloadComprobante(item.id_ingreso_equipo);
        } catch (error) {
            console.error('Error al descargar comprobante:', error);
            showAlert(error.response?.status === 403
                ? 'No tienes permiso para descargar este comprobante.'
                : 'No se pudo descargar el comprobante. Intenta de nuevo.', 'error');
        }
    };

    // Marca un equipo como devuelto (POST /api/admin/equipment/{id}/return + recarga).
    const handleDevolverEquipo = async (id) => {
        const confirmed = await showConfirm('¿Marcar este equipo como devuelto?');
        if (!confirmed) return;
        try {
            const response = await axios.post(`/api/admin/equipment/${id}/return`);
            await fetchEquipment();
            showAlert(response.data.message || 'Equipo devuelto con éxito');
        } catch (error) {
            showAlert('Error al devolver equipo: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    // Elimina un equipo (DELETE /api/admin/equipment/{id} + error real).
    const handleEliminarEquipo = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este equipo?');
        if (!confirmed) return;
        try {
            const response = await axios.delete(`/api/admin/equipment/${id}`);
            setEquipmentList(equipmentList.filter(item => item.id_ingreso_equipo !== id));
            showAlert(response.data.message || 'Equipo eliminado');
        } catch (error) {
            showAlert('Error al eliminar equipo: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const cancelarEdicionPerfil = () => setEditingProfile(false);


    // Nav de portería: el ingreso (carnet/código/PIN) va separado de los
    // permisos de salida y del QR que se proyecta en la puerta.
    const porteroLinks = [
        { label: 'Inicio', icon: 'dashboard', view: 'dashboard' },
        { label: 'Ingreso', icon: 'qr_code_scanner', view: 'validar_qr' },
        { label: 'Permisos', icon: 'key', view: 'excusas' },
        { label: 'Equipos', icon: 'inventory_2', view: 'equipos' },
        { label: 'Historial', icon: 'history', view: 'historial' },
        { label: 'Mi carnet', icon: 'id_card', view: 'qr_carnet' },
        { label: 'QR de portería', icon: 'qr_code_2', view: 'acceso_qr' }
    ];

    const filteredEquipment = equipmentList.filter(item => {
        const search = searchTermEquipment.toLowerCase();
        if (estadoEquipo && item.equipo_status !== estadoEquipo) return false;
        return (
            `${item.equipo_type || ''} ${item.equipo_brand || ''} ${item.equipo_model || ''} ${item.equipo_serial || ''}`.toLowerCase().includes(search) ||
            `${item.user?.user_name || ''} ${item.user?.user_lastname || ''}`.toLowerCase().includes(search) ||
            (item.user?.user_email || '').toLowerCase().includes(search) ||
            (item.user?.user_identification || '').toLowerCase().includes(search)
        );
    });

    const renderView = () => {
        if (editingProfile) {
            return (
                <EditarMiPerfil
                    usuario={currentUser}
                    mostrarFichaPrograma={false}
                    onCancelar={cancelarEdicionPerfil}
                    onGuardado={(usuario) => {
                        setCurrentUser(usuario);
                        setEditingProfile(false);
                    }}
                />
            );
        }

        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'historial':
                return (
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1200px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Historial de accesos</h3>
                                <p className="page-subtitulo mb-0">{ingresosMeta.total} registro{ingresosMeta.total === 1 ? '' : 's'}</p>
                            </div>
                            <div className="page-acciones">
                                <button className="btn btn-outline-success action-btn" onClick={abrirExportar}>
                                    <span className="material-symbols-outlined">download</span> Exportar
                                </button>
                            </div>
                        </div>

                        <div className="filtros-barra">
                            <div className="buscador-sena">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por usuario, documento o lugar…"
                                    value={searchTermIngresos}
                                    onChange={(e) => setSearchTermIngresos(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') fetchIngresos(1); }}
                                    aria-label="Buscar en el historial"
                                />
                                {searchTermIngresos && (
                                    <button type="button" className="buscador-limpiar" onClick={() => { setSearchTermIngresos(''); fetchIngresos(1); }} aria-label="Limpiar búsqueda">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                )}
                            </div>
                            <div className="filtros-chips">
                                {[
                                    { key: '', label: 'Todos' },
                                    { key: 'Entrada', label: 'Entradas' },
                                    { key: 'Salida', label: 'Salidas' }
                                ].map((f) => (
                                    <button
                                        key={f.key || 'todos'}
                                        type="button"
                                        className={`chip-sena ${filterTipo === f.key ? 'activo' : ''}`}
                                        onClick={() => setFilterTipo(f.key)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                                <button type="button" className="chip-sena" onClick={() => presetDia(0)}>Hoy</button>
                                <button type="button" className="chip-sena" onClick={() => presetDia(-1)}>Ayer</button>
                                <button type="button" className="chip-sena" onClick={() => presetRango(7)}>7 días</button>
                                <button type="button" className="chip-sena" onClick={limpiarFiltrosHistorial}>Limpiar</button>
                            </div>
                            <div className="filtros-fechas">
                                <label>
                                    Desde
                                    <input type="date" className="form-control" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
                                </label>
                                <label>
                                    Hasta
                                    <input type="date" className="form-control" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
                                </label>
                            </div>
                        </div>

                        <div className="glass-box p-0" style={{ maxWidth: 'none' }}>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Usuario</th>
                                            <th>Fecha y hora</th>
                                            <th>Ubicación / punto</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialLoading ? (
                                            <tr><td colSpan="4" className="text-center py-4"><div className="spinner-border text-success" role="status"></div></td></tr>
                                        ) : ingresos.length > 0 ? ingresos.map(ingreso => (
                                            <tr key={ingreso.id_ingreso}>
                                                <td data-label="Usuario">
                                                    <div className="d-flex flex-column">
                                                        <span className="fw-bold">{ingreso.user?.user_name} {ingreso.user?.user_lastname}</span>
                                                        <span className="small opacity-50">{ingreso.user?.user_email}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Fecha y Hora">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="material-symbols-outlined opacity-50" style={{ fontSize: '18px' }}>calendar_today</span>
                                                        {new Date(ingreso.ingreso_datetime).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td data-label="Ubicación">
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2" style={{ fontSize: '0.75rem' }}>
                                                        {ingreso.ingreso_place}
                                                    </span>
                                                </td>
                                                <td data-label="Tipo">
                                                    <span className={`badge px-3 py-2 ${ingreso.ingreso_type === 'Entrada' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${ingreso.ingreso_type === 'Entrada' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {ingreso.ingreso_type}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="text-center py-4 opacity-50">No se encontraron registros con esos filtros.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {ingresosMeta.last_page > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2 p-3">
                                    <span className="small opacity-50">Página {ingresosMeta.current_page} de {ingresosMeta.last_page}</span>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-outline-success btn-sm" disabled={ingresosMeta.current_page <= 1} onClick={() => fetchIngresos(ingresosMeta.current_page - 1)}>
                                            <span className="material-symbols-outlined small">chevron_left</span> Anterior
                                        </button>
                                        <button className="btn btn-outline-success btn-sm" disabled={ingresosMeta.current_page >= ingresosMeta.last_page} onClick={() => fetchIngresos(ingresosMeta.current_page + 1)}>
                                            Siguiente <span className="material-symbols-outlined small">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'excusas':
                return <Excusas currentUser={currentUser} rol="admin" />;
            case 'equipo_entry':
                return (
                    <div className="fade-in-up">
                        <button className="btn btn-outline-success btn-sm mb-3" onClick={() => setView('equipos')}>
                            <span className="material-symbols-outlined small">arrow_back</span> Volver al inventario
                        </button>
                        <EquipmentForm adminMode onSaved={fetchEquipment} />
                    </div>
                );
            case 'equipos':
                return (
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1200px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Equipos</h3>
                                <p className="page-subtitulo mb-0">{filteredEquipment.length} equipo{filteredEquipment.length === 1 ? '' : 's'}</p>
                            </div>
                            <div className="page-acciones">
                                <button className="btn btn-outline-success action-btn" onClick={abrirExportarEquipos}>
                                    <span className="material-symbols-outlined">download</span> Exportar
                                </button>
                                <button className="btn btn-success action-btn" onClick={() => setView('equipo_entry')}>
                                    <span className="material-symbols-outlined">add_circle</span> Registrar equipo
                                </button>
                            </div>
                        </div>

                        <div className="filtros-barra">
                            <div className="buscador-sena">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar equipo, dueño, documento o serial…"
                                    value={searchTermEquipment}
                                    onChange={(e) => setSearchTermEquipment(e.target.value)}
                                    aria-label="Buscar equipos"
                                />
                                {searchTermEquipment && (
                                    <button type="button" className="buscador-limpiar" onClick={() => setSearchTermEquipment('')} aria-label="Limpiar búsqueda">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                )}
                            </div>
                            <div className="filtros-chips">
                                {[
                                    { key: '', label: 'Todos' },
                                    { key: 'Prestado', label: 'En uso' },
                                    { key: 'Disponible', label: 'Devueltos' }
                                ].map((f) => (
                                    <button
                                        key={f.key || 'todos'}
                                        type="button"
                                        className={`chip-sena ${estadoEquipo === f.key ? 'activo' : ''}`}
                                        onClick={() => setEstadoEquipo(f.key)}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="glass-box p-0" style={{ maxWidth: 'none' }}>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Equipo</th>
                                            <th>Dueño</th>
                                            <th>Serial</th>
                                            <th>Propiedad</th>
                                            <th>Estado</th>
                                            <th>Ingreso</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEquipment.length > 0 ? filteredEquipment.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Equipo">
                                                    <div className="d-flex flex-column">
                                                        <span className="fw-bold">{item.equipo_type}</span>
                                                        <span className="small opacity-50">{item.equipo_brand} {item.equipo_model || ''}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Dueño">
                                                    <div className="d-flex flex-column">
                                                        <span>{item.user?.user_name} {item.user?.user_lastname}</span>
                                                        <span className="small opacity-50">{item.user?.user_identification || item.user?.user_email}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Serial"><code>{item.equipo_serial}</code></td>
                                                <td data-label="Propiedad">
                                                    <span className={`badge badge-soft-${item.equipo_propiedad === 'Propio' ? 'info' : 'secondary'} px-2 py-1`}>
                                                        {item.equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado'}
                                                    </span>
                                                </td>
                                                <td data-label="Estado">
                                                    <span className={`badge px-3 py-2 ${item.equipo_status === 'Disponible' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${item.equipo_status === 'Disponible' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_status === 'Disponible' ? 'Devuelto' : 'En uso'}
                                                    </span>
                                                </td>
                                                <td data-label="Ingreso" className="small opacity-75">
                                                    {item.entry_datetime ? new Date(item.entry_datetime).toLocaleString() : '—'}
                                                </td>
                                                <td data-label="Acciones">
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        {item.equipo_status !== 'Disponible' && (
                                                            <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleDevolverEquipo(item.id_ingreso_equipo)} title="Marcar como devuelto">
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_return</span>
                                                            </button>
                                                        )}
                                                        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                                                        </button>
                                                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleEliminarEquipo(item.id_ingreso_equipo)} title="Eliminar equipo">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="7" className="text-center py-4 opacity-50">No hay equipos con esos filtros.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'validar_qr':
                return <QrInvitado />;
            case 'qr_carnet':
                return <UserQrCarnet currentUser={currentUser} />;
            case 'acceso_qr':
                return <AccesoQr />;
            case 'profile':
                return (
                    <PerfilSena
                        usuario={currentUser}
                        rol={currentUser?.role?.rol_name || 'Admin'}
                        onEditar={() => setEditingProfile(true)}
                        seguridad={<><DosPasos /><MiHuella /><SimulacionHuella /></>}
                    />
                );
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column min-vh-100">
            <Navbar currentUser={currentUser} view={view} setView={(newView) => {
                setView(newView);
                setEditingProfile(false);
            }} links={porteroLinks} />
            <main className="container-fluid px-3 px-md-5 py-4 flex-grow-1">{renderView()}</main>
            <Footer />
            <ModalExportar
                abierto={exportAbierto}
                titulo="Exportar historial"
                detalle="Se aplican los filtros activos. Elige PDF o Excel."
                formatos={['pdf', 'xlsx']}
                formato={exportFormato}
                onFormato={setExportFormato}
                onCerrar={() => setExportAbierto(false)}
                onExportar={descargarExportacion}
                exportando={exportando}
            />
            <ModalExportar
                abierto={exportEquiposAbierto}
                titulo="Exportar equipos"
                detalle="Se aplican la búsqueda y el estado activos. Elige PDF o Word."
                formatos={['pdf', 'docx']}
                formato={exportEquiposFormato}
                onFormato={setExportEquiposFormato}
                onCerrar={() => setExportEquiposAbierto(false)}
                onExportar={descargarExportacionEquipos}
                exportando={exportEquiposExportando}
            />
        </div>
    );
};

export default Portero;
