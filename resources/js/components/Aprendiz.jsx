import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import StatsDashboard from './StatsDashboard';
import Excusas from './Excusas';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import SimulacionHuella from './SimulacionHuella';
import UserQrCarnet from './UserQrCarnet';
import EscanearAcceso from './EscanearAcceso';
import PerfilSena from './PerfilSena';
import EditarMiPerfil from './EditarMiPerfil';
import ModalExportar from './ModalExportar';
import { showAlert } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { descargarArchivo, nombreExportado } from '../utils/exportar';
import { mensajeDeError } from '../utils/mensajes';
import { corregirRolDePanel, limpiarSesionLocal } from '../utils/sesion';
import { getToken } from '../utils/auth';

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

const Aprendiz = ({ rol }) => {
    const navigate = useNavigate();
    // El mismo panel sirve al aprendiz y al funcionario (/funcionario). El
    // funcionario es personal administrativo: no tiene ficha de formación ni
    // permisos/excusas, pero sí carnet, historial, equipos y perfil.
    const [currentUser, setCurrentUser] = useState(null);
    const esFuncionario = ((rol || '').toLowerCase() || (currentUser?.role?.rol_name || '').toLowerCase()) === 'funcionario';
    const [view, setView] = useState('dashboard'); // 'dashboard', 'comprobantes', 'profile'
    const [ingresos, setIngresos] = useState([]);
    const [equipmentList, setEquipmentList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTermIngresos, setSearchTermIngresos] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');
    const [exportAbierto, setExportAbierto] = useState(false);
    const [exportFormato, setExportFormato] = useState('pdf');
    const [exportando, setExportando] = useState(false);
    const [exportEquiposAbierto, setExportEquiposAbierto] = useState(false);
    const [exportEquiposFormato, setExportEquiposFormato] = useState('pdf');
    const [exportEquiposExportando, setExportEquiposExportando] = useState(false);
    const [editingProfile, setEditingProfile] = useState(false);
    useEffect(() => { // Logica para cargar los datos del usuario, haciendo el uso de useEffect
        const fetchData = async () => {
            try {
                const token = getToken();
                if (!token) {
                    navigate('/login');
                    return;
                }

                // Primero se valida el rol real; después se piden los datos del
                // panel. Así una sesión vieja de otro rol no pinta ni consulta
                // endpoints que no le corresponden.
                const userMeResponse = await axios.get('/api/user');
                if (!corregirRolDePanel(userMeResponse.data, 'aprendiz', navigate)) return;
                const [ingresosResponse, equipmentResponse] = await Promise.all([
                    axios.get('/api/my-ingresos'),
                    axios.get('/api/my-equipment')
                ]);
                setCurrentUser(userMeResponse.data);
                setIngresos(ingresosResponse.data);
                setEquipmentList(equipmentResponse.data);

            } catch (error) { // catch para manejar errores en la carga de los datos 
                console.error('Error cargando datos: ', error);
                if (error.response && error.response.status === 401) {
                    limpiarSesionLocal();
                    navigate('/login');
                } else {
                    // La API ya explica el problema (por ejemplo, limite de
                    // intentos): se muestra su mensaje y no un error tecnico.
                    showAlert(mensajeDeError(error, 'No se pudieron cargar los datos del panel.'), 'error');
                }
            } finally { // Finally para asegurar que el estado de carga se actualice correctamente independientemente de si la solicitud fue exitosa o si ocurrió un error, evitando que la interfaz quede en un estado de carga indefinido
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    // Descarga el comprobante PDF del equipo indicado.
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

    // Refresca los datos de la vista actual al cambiar de vista y al enfocar la pestaña,
    // para que los cambios hechos por otros roles se reflejen sin recargar la página.
    useEffect(() => {
        const refreshViewData = async () => {
            if (view === 'historial') {
                try {
                    const response = await axios.get('/api/my-ingresos');
                    setIngresos(response.data);
                } catch (error) {
                    console.error('Error al refrescar ingresos:', error);
                }
            } else if (view === 'comprobantes') {
                try {
                    const response = await axios.get('/api/my-equipment');
                    setEquipmentList(response.data);
                } catch (error) {
                    console.error('Error al refrescar equipos:', error);
                }
            }
        };
        refreshViewData();
        const onFocus = () => refreshViewData();
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [view]);

    const cancelarEdicionPerfil = () => setEditingProfile(false);

    if (loading) return <div className="text-white text-center mt-5">Cargando...</div>;


    const filteredIngresos = ingresos.filter((ingreso) => {
        if (filterTipo && ingreso.ingreso_type !== filterTipo) return false;
        const dia = diaBogota(ingreso.ingreso_datetime);
        if (filterDesde && dia < filterDesde) return false;
        if (filterHasta && dia > filterHasta) return false;
        const q = searchTermIngresos.trim().toLowerCase();
        if (!q) return true;
        return `${ingreso.ingreso_place || ''} ${ingreso.ingreso_type || ''}`.toLowerCase().includes(q);
    });

    const exportarHistorial = async () => {
        setExportando(true);
        try {
            const params = { formato: exportFormato };
            if (filterTipo) params.tipo = filterTipo;
            if (filterDesde) params.desde = filterDesde;
            if (filterHasta) params.hasta = filterHasta;
            await descargarArchivo('/api/my-ingresos/export', params, nombreExportado('mi_historial', exportFormato));
            setExportAbierto(false);
            showAlert('Exportación generada');
        } catch (_) {
            showAlert('No se pudo generar la exportación. Intenta de nuevo.', 'error');
        } finally {
            setExportando(false);
        }
    };

    const exportarEquipos = async () => {
        setExportEquiposExportando(true);
        try {
            await descargarArchivo(
                '/api/my-equipment/export',
                { formato: exportEquiposFormato },
                nombreExportado('mis_equipos', exportEquiposFormato)
            );
            setExportEquiposAbierto(false);
            showAlert('Exportación generada');
        } catch (_) {
            showAlert('No se pudo generar la exportación. Intenta de nuevo.', 'error');
        } finally {
            setExportEquiposExportando(false);
        }
    };

    const renderView = () => {
        if (editingProfile) {
            return (
                <EditarMiPerfil
                    usuario={currentUser}
                    mostrarFichaPrograma={!esFuncionario}
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
            case 'comprobantes':
                return (
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1200px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Mis equipos</h3>
                                <p className="page-subtitulo mb-0">{equipmentList.length} equipo{equipmentList.length === 1 ? '' : 's'} registrado{equipmentList.length === 1 ? '' : 's'}</p>
                            </div>
                            <div className="page-acciones">
                                <button
                                    type="button"
                                    className="btn btn-outline-success action-btn"
                                    onClick={() => { setExportEquiposFormato('pdf'); setExportEquiposAbierto(true); }}
                                >
                                    <span className="material-symbols-outlined">download</span> Exportar
                                </button>
                            </div>
                        </div>
                        <div className="glass-box p-0" style={{ maxWidth: 'none' }}>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Equipo</th>
                                            <th>Marca/Modelo</th>
                                            <th>Serial</th>
                                            <th>Propiedad</th>
                                            <th>Accesorios</th>
                                            <th>Ingreso / Devolución</th>
                                            <th>Estado</th>
                                            <th>Comprobante</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentList.length > 0 ? equipmentList.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Equipo"><span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">{item.equipo_type}</span></td>
                                                <td data-label="Marca/Modelo">{item.equipo_brand} {item.equipo_model}</td>
                                                <td data-label="Serial"><code>{item.equipo_serial}</code></td>
                                                <td data-label="Propiedad">
                                                    <span className={`badge px-3 py-2 ${item.equipo_propiedad === 'Propio' ? 'bg-info' : 'bg-secondary'} bg-opacity-10 border border-opacity-25 ${item.equipo_propiedad === 'Propio' ? 'text-info border-info' : 'text-secondary border-secondary'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado'}
                                                    </span>
                                                </td>
                                                <td data-label="Accesorios" className="small opacity-75">
                                                    {(item.equipo_accesorios || []).map(a => a?.tipo).filter(Boolean).join(', ') || '—'}
                                                </td>
                                                <td data-label="Ingreso / Devolución" className="small opacity-75">
                                                    <div className="d-flex flex-column">
                                                        <span>Ingreso: {new Date(item.entry_datetime).toLocaleString()}</span>
                                                        {item.equipo_return_datetime && (
                                                            <span className="text-success">Devolución: {new Date(item.equipo_return_datetime).toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-label="Estado">
                                                    <span className={`badge px-3 py-2 ${item.equipo_status === 'Disponible' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${item.equipo_status === 'Disponible' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Comprobante">
                                                    <button type="button" className="action-btn btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="8" className="text-center py-4 opacity-50">No tienes equipos registrados.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'historial':
                return (
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1100px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Mi historial</h3>
                                <p className="page-subtitulo mb-0">{filteredIngresos.length} registro{filteredIngresos.length === 1 ? '' : 's'}</p>
                            </div>
                            <div className="page-acciones">
                                <button type="button" className="btn btn-outline-success action-btn" onClick={() => { setExportFormato('pdf'); setExportAbierto(true); }}>
                                    <span className="material-symbols-outlined">download</span> Exportar
                                </button>
                            </div>
                        </div>

                        <div className="filtros-barra">
                            <div className="buscador-sena">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por lugar…"
                                    value={searchTermIngresos}
                                    onChange={(e) => setSearchTermIngresos(e.target.value)}
                                    aria-label="Buscar en mi historial"
                                />
                                {searchTermIngresos && (
                                    <button type="button" className="buscador-limpiar" onClick={() => setSearchTermIngresos('')} aria-label="Limpiar búsqueda">
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
                                <button
                                    type="button"
                                    className="chip-sena"
                                    onClick={() => { setFilterTipo(''); setFilterDesde(''); setFilterHasta(''); setSearchTermIngresos(''); }}
                                >
                                    Limpiar
                                </button>
                            </div>
                            <div className="filtros-fechas">
                                <label>Desde <input type="date" className="form-control" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} /></label>
                                <label>Hasta <input type="date" className="form-control" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} /></label>
                            </div>
                        </div>

                        <div className="glass-box p-0" style={{ maxWidth: 'none' }}>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Fecha y hora</th>
                                            <th>Ubicación / punto</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredIngresos.length > 0 ? filteredIngresos.map(ingreso => (
                                            <tr key={ingreso.id_ingreso}>
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
                                            <tr>
                                                <td colSpan="3" className="text-center py-4 opacity-50">No hay registros con esos filtros.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'permisos':
                // Los permisos/excusas son del aprendiz: el funcionario no los tiene.
                if (esFuncionario) return null;
                return <Excusas currentUser={currentUser} rol="aprendiz" />;
            case 'qr_carnet':
                return <UserQrCarnet currentUser={currentUser} />;
            case 'escanear_acceso':
                return <EscanearAcceso />;
            case 'profile':
                return (
                    <PerfilSena
                        usuario={currentUser}
                        rol={currentUser?.role?.rol_name || 'Aprendiz'}
                        onEditar={() => setEditingProfile(true)}
                        seguridad={<><DosPasos /><MiHuella /><SimulacionHuella /></>}
                    />
                );
            default:
                return null;
        }
    };

    const aprendizLinks = [ // Definicion de enlaces para el navbar (espejo del dock móvil: Inicio·Excusas·Historial·Equipos)
        { label: 'Inicio', icon: 'dashboard', view: 'dashboard' },
        // El funcionario no maneja permisos (excusas): esos son del aprendiz.
        ...(esFuncionario ? [] : [{ label: 'Mis permisos', icon: 'key', view: 'permisos' }]),
        { label: 'Historial', icon: 'history', view: 'historial' },
        { label: 'Mis equipos', icon: 'inventory_2', view: 'comprobantes' },
        { label: 'Mi carnet', icon: 'id_card', view: 'qr_carnet' },
        { label: 'Salida QR', icon: 'qr_code_scanner', view: 'escanear_acceso' }
    ];

    return ( // Estructura principal
        <div className="min-vh-100 d-flex flex-column fade-in-up" style={{ background: 'transparent' }}>
            <Navbar
                currentUser={currentUser}
                view={view}
                setView={(newView) => {
                    setView(newView);
                    setEditingProfile(false);
                }}
                links={aprendizLinks}
            />

            <main className="container-fluid px-3 px-md-5 py-2 flex-grow-1">
                {renderView()}
            </main>

            <Footer />
            <ModalExportar
                abierto={exportAbierto}
                titulo="Exportar mi historial"
                detalle="Se aplican los filtros activos. Elige PDF o Excel."
                formatos={['pdf', 'xlsx']}
                formato={exportFormato}
                onFormato={setExportFormato}
                onCerrar={() => setExportAbierto(false)}
                onExportar={exportarHistorial}
                exportando={exportando}
            />
            <ModalExportar
                abierto={exportEquiposAbierto}
                titulo="Exportar mis equipos"
                detalle="Elige PDF o Word."
                formatos={['pdf', 'docx']}
                formato={exportEquiposFormato}
                onFormato={setExportEquiposFormato}
                onCerrar={() => setExportEquiposAbierto(false)}
                onExportar={exportarEquipos}
                exportando={exportEquiposExportando}
            />
        </div>
    );
};

export default Aprendiz;
