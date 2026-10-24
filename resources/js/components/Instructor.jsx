import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import Novedades from './Novedades';
import StatsDashboard from './StatsDashboard';
import Ambientes from './Ambientes';
import Excusas from './Excusas';
import QrInvitado from './QrInvitado';
import UserQrCarnet from './UserQrCarnet';
import EscanearAcceso from './EscanearAcceso';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import SimulacionHuella from './SimulacionHuella';
import PerfilSena from './PerfilSena';
import EditarMiPerfil from './EditarMiPerfil';
import ModalExportar from './ModalExportar';
import { showAlert } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { descargarArchivo, nombreExportado } from '../utils/exportar';
import { mensajeDeError } from '../utils/mensajes';

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

const Instructor = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [users, setUsers] = useState([]);
    const [ingresos, setIngresos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTermIngresos, setSearchTermIngresos] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');
    const [myEquipmentList, setMyEquipmentList] = useState([]);
    const [novedades, setNovedades] = useState([]);
    const [exportAbierto, setExportAbierto] = useState(false);
    const [exportFormato, setExportFormato] = useState('pdf');
    const [exportando, setExportando] = useState(false);
    const [exportEquiposAbierto, setExportEquiposAbierto] = useState(false);
    const [exportEquiposFormato, setExportEquiposFormato] = useState('pdf');
    const [exportEquiposExportando, setExportEquiposExportando] = useState(false);
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileErrors, setProfileErrors] = useState({});
    const [fotoBlob, setFotoBlob] = useState(null);
    const [fotoPreview, setFotoPreview] = useState(null);
    const [archivoRecorte, setArchivoRecorte] = useState(null);
    const [codigo2fa, setCodigo2fa] = useState('');
    const [codigoSolicitado, setCodigoSolicitado] = useState(false);
    const [formData, setFormData] = useState({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const [usersResponse, ingresosResponse, userMeResponse, myEquipmentResponse, novedadesResponse] = await Promise.all([
                    axios.get('/api/admin/users'),
                    axios.get('/api/my-ingresos'),
                    axios.get('/api/user'),
                    axios.get('/api/my-equipment'),
                    axios.get('/api/my-novedades')
                ]);
                setUsers(usersResponse.data);
                setIngresos(ingresosResponse.data);
                setCurrentUser(userMeResponse.data);
                setMyEquipmentList(myEquipmentResponse.data);
                setNovedades(novedadesResponse.data);
                setFormData({
                    user_identification: userMeResponse.data.user_identification || '',
                    user_name: userMeResponse.data.user_name,
                    user_lastname: userMeResponse.data.user_lastname,
                    user_email: userMeResponse.data.user_email,
                    user_password: '',
                    profile_photo_path: userMeResponse.data.profile_photo_path || null
                });
            } catch (error) {
                console.error('Error cargando datos: ', error);
                if (error.response && error.response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    navigate('/login');
                } else {
                    // La API ya explica el problema (por ejemplo, limite de
                    // intentos): se muestra su mensaje y no un error tecnico.
                    showAlert(mensajeDeError(error, 'No se pudieron cargar los datos del panel.'), 'error');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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
            } else if (view === 'mis_equipos') {
                try {
                    const response = await axios.get('/api/my-equipment');
                    setMyEquipmentList(response.data);
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

    const filteredIngresos = ingresos.filter(ingreso => {
        const search = searchTermIngresos.toLowerCase();
        const userName = `${ingreso.user?.user_name} ${ingreso.user?.user_lastname}`.toLowerCase();
        if (filterTipo && ingreso.ingreso_type !== filterTipo) return false;
        const dia = diaBogota(ingreso.ingreso_datetime);
        if (filterDesde && dia < filterDesde) return false;
        if (filterHasta && dia > filterHasta) return false;
        return (
            userName.includes(search) ||
            (ingreso.user?.user_email || '').toLowerCase().includes(search) ||
            (ingreso.ingreso_place || '').toLowerCase().includes(search)
        );
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


    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (profileErrors[e.target.name]) {
            setProfileErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    // Guarda el perfil en PUT /api/my-profile (multipart + _method=PUT).
    // Si cambia la clave con 2FA activo, el backend responde 422 con
    // errors.two_factor_code y envia el codigo al correo: se muestra el
    // campo del codigo y al reenviar se incluye two_factor_code.
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('user_identification', formData.user_identification);
            data.append('user_name', formData.user_name);
            data.append('user_lastname', formData.user_lastname);
            data.append('user_email', formData.user_email);
            if (formData.user_password) data.append('user_password', formData.user_password);
            if (codigo2fa) data.append('two_factor_code', codigo2fa);
            if (fotoBlob) data.append('image', fotoBlob, 'foto.jpg');
            data.append('_method', 'PUT');

            const response = await axios.post('/api/my-profile', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setCurrentUser(response.data);
            showAlert('Perfil actualizado con éxito');
            setProfileErrors({});
            setEditingProfile(false);
            setFotoBlob(null);
            setFotoPreview(null);
            setArchivoRecorte(null);
            setCodigo2fa('');
            setCodigoSolicitado(false);
        } catch (error) {
            if (error.response?.data?.errors) {
                setProfileErrors(error.response.data.errors);
            }
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitado(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al actualizar perfil: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    // Limpia el formulario de perfil (foto recortada y codigo 2FA incluidos).
    const cancelarEdicionPerfil = () => {
        setEditingProfile(false);
        setFotoBlob(null);
        setFotoPreview(null);
        setArchivoRecorte(null);
        setCodigo2fa('');
        setCodigoSolicitado(false);
    };

    const profileFieldError = (name) => (
        profileErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{profileErrors[name][0]}</div> : null
    );

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
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1100px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Mi historial de accesos</h3>
                                <p className="page-subtitulo mb-0">{filteredIngresos.length} registro{filteredIngresos.length === 1 ? '' : 's'}</p>
                            </div>
                            <div className="page-acciones">
                                <button className="btn btn-outline-success action-btn" onClick={() => { setExportFormato('pdf'); setExportAbierto(true); }}>
                                    <span className="material-symbols-outlined">download</span> Exportar
                                </button>
                            </div>
                        </div>

                        <div className="filtros-barra">
                            <div className="buscador-sena">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por lugar o usuario…"
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
                                    <thead><tr><th>Fecha y hora</th><th>Ubicación</th><th>Tipo</th></tr></thead>
                                    <tbody>
                                        {filteredIngresos.length > 0 ? filteredIngresos.map(ingreso => (
                                            <tr key={ingreso.id_ingreso}>
                                                <td data-label="Fecha y Hora">{new Date(ingreso.ingreso_datetime).toLocaleString()}</td>
                                                <td data-label="Ubicación"><span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2">{ingreso.ingreso_place}</span></td>
                                                <td data-label="Tipo">
                                                    <span className={`badge px-3 py-2 ${ingreso.ingreso_type === 'Entrada' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${ingreso.ingreso_type === 'Entrada' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {ingreso.ingreso_type}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="text-center py-4 opacity-50">No hay registros con esos filtros.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'novedad_form':
                return <Novedades currentUser={currentUser} initialMode="form" />;
            case 'novedad_historial':
                return <Novedades currentUser={currentUser} initialMode="history" />;
            case 'ambientes':
                return <Ambientes currentUser={currentUser} rol="instructor" />;
            case 'excusas':
                return <Excusas currentUser={currentUser} rol="instructor" />;
            case 'validar_qr':
                return <QrInvitado />;
            case 'qr_carnet':
                return <UserQrCarnet currentUser={currentUser} />;
            case 'escanear_acceso':
                return <EscanearAcceso />;
            case 'mis_equipos':
                return (
                    <div className="fade-in-up mx-auto" style={{ maxWidth: '1100px' }}>
                        <div className="page-cabecera">
                            <div>
                                <h3 className="page-titulo mb-1">Mis equipos</h3>
                                <p className="page-subtitulo mb-0">{myEquipmentList.length} equipo{myEquipmentList.length === 1 ? '' : 's'}</p>
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
                                    <thead><tr><th>Equipo</th><th>Marca/Modelo</th><th>Serial</th><th>Propiedad</th><th>Accesorios</th><th>Estado</th><th>Fecha</th><th>Comprobante</th></tr></thead>
                                    <tbody>
                                        {myEquipmentList.length > 0 ? myEquipmentList.map(item => (
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
                                                <td data-label="Estado">
                                                    <span className={`badge px-3 py-2 ${item.equipo_status === 'Disponible' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${item.equipo_status === 'Disponible' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Fecha" className="small opacity-75">
                                                    <div className="d-flex flex-column">
                                                        <span>{new Date(item.entry_datetime).toLocaleString()}</span>
                                                        {item.equipo_return_datetime && (
                                                            <span className="text-success">Dev.: {new Date(item.equipo_return_datetime).toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-label="Comprobante">
                                                    <button type="button" className="action-btn btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : <tr><td colSpan="8" className="text-center py-4 opacity-50">No tienes equipos registrados.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'profile':
                return (
                    <PerfilSena
                        usuario={currentUser}
                        rol={currentUser?.role?.rol_name || 'Instructor'}
                        onEditar={() => setEditingProfile(true)}
                        seguridad={<><DosPasos /><MiHuella /><SimulacionHuella /></>}
                    />
                );
            default: return null;
        }
    };

    // Nav espeja el dock del instructor móvil (Inicio·Ambientes·Novedades·Historial·Equipos).
    // Excusas, Mi carnet y Marcar acceso van visibles en la barra: son
    // accesos directos del instructor y no deben quedar escondidos.
    const instructorLinks = [
        { label: 'Inicio', icon: 'dashboard', view: 'dashboard' },
        { label: 'Mis salones', icon: 'meeting_room', view: 'ambientes' },
        {
            label: 'Novedades',
            icon: 'report_problem',
            view: 'novedad_historial',
            dropdown: true,
            items: [
                { label: 'Reportar novedad', icon: 'add_circle', view: 'novedad_form' },
                { label: 'Historial de novedades', icon: 'history', view: 'novedad_historial' }
            ]
        },
        { label: 'Historial', icon: 'history', view: 'historial' },
        { label: 'Excusas', icon: 'key', view: 'excusas' },
        { label: 'Mis equipos', icon: 'inventory_2', view: 'mis_equipos' },
        { label: 'Mi carnet', icon: 'id_card', view: 'qr_carnet' },
        { label: 'Salida QR', icon: 'qr_code_scanner', view: 'escanear_acceso' }
    ];

    if (loading) return <div className="text-white text-center mt-5">Cargando...</div>;

    return (
        <div className="min-vh-100 d-flex flex-column fade-in-up">
            <Navbar currentUser={currentUser} view={view} setView={(newView) => {
                setView(newView);
                setEditingProfile(false);
            }} links={instructorLinks} />
            <main className="container-fluid px-3 px-md-5 py-4 flex-grow-1">{renderView()}</main>
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

export default Instructor;
