import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import Novedades from './Novedades';
import StatsDashboard from './StatsDashboard';
import Ambientes from './Ambientes';
import QrScannerModal from './QrScannerModal';
import AccesoQr from './AccesoQr';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import SimulacionHuella from './SimulacionHuella';
import RecorteFoto from './RecorteFoto';
import { showAlert, showConfirm } from './CustomAlert';
import { mensajeDeError } from '../utils/mensajes';

// Usuario de la última sesión: permite pintar el panel al instante y
// refrescarlo con /api/user en segundo plano.
const usuarioGuardado = () => {
    try {
        return JSON.parse(localStorage.getItem('sena_usuario') || 'null');
    } catch (_) {
        return null;
    }
};

const Admin = () => {
    // HOOK: useNavigate se emplea para redirigir al Login si el usuario no tiene una sesión activa o el token expira.
    const navigate = useNavigate();
    const carouselRef = useRef(null);
    const userFormRef = useRef(null);
    // HOOK: useState se utiliza de forma intensiva para mantener el estado de la aplicación: usuario logueado, la vista renderizada en el panel, listas de datos desde la API y estados de carga.
    const [currentUser, setCurrentUser] = useState(usuarioGuardado);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'users', 'ambientes', 'acceso_qr', 'profile'
    const [userFilter, setUserFilter] = useState('all'); // 'all', 'Instructor', 'Aprendiz'
    // Página actual del carrusel de usuarios (paginada en servidor).
    const [usuariosPagina, setUsuariosPagina] = useState([]);
    const [usuariosTotal, setUsuariosTotal] = useState(0);
    const [usuariosUltima, setUsuariosUltima] = useState(1);
    const [usuariosPag, setUsuariosPag] = useState(1);
    const [pendientesCount, setPendientesCount] = useState(0); // Badge de la bandeja Pendientes
    const [usuariosCargando, setUsuariosCargando] = useState(false);
    const [usersSearchDeb, setUsersSearchDeb] = useState(''); // Búsqueda con debounce
    const usuariosPagRef = useRef(1); // Página vigente para refrescos (evita closures viejos)
    const [roles, setRoles] = useState([]); // Lista de roles
    const [loading, setLoading] = useState(() => !usuarioGuardado()); // Solo bloquea si no hay usuario en caché
    const [editingUser, setEditingUser] = useState(null); // Usuario que se está editando
    const [creatingUser, setCreatingUser] = useState(false); // Formulario en modo crear
    const [searchTermUsers, setSearchTermUsers] = useState(''); // Busqueda de usuarios
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false); // Escáner de carnet digital
    const [formData, setFormData] = useState({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: '',
        user_coursenumber: '',
        user_program: '',
        user_documento_tipo: 'CC',
        user_telefono: '',
        fk_id_rol: ''
    });
    const [formErrors, setFormErrors] = useState({}); // Errores de validación por campo
    const [perfilArchivo, setPerfilArchivo] = useState(null); // Foto elegida para recortar
    const [claveNueva, setClaveNueva] = useState(''); // Nueva contraseña del admin
    const [codigo2faAdm, setCodigo2faAdm] = useState(''); // Código 2FA del correo
    const [codigoSolicitadoAdm, setCodigoSolicitadoAdm] = useState(false); // Backend pidió el código

    // Desplaza la vista hasta el formulario al iniciar la edición o creación de un usuario
    useEffect(() => {
        if (editingUser || creatingUser) {
            const timer = setTimeout(() => {
                userFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [editingUser, creatingUser]);

    // Página del carrusel de usuarios desde el servidor (24 por página,
    // con búsqueda y rol filtrados allá, no en el navegador).
    const fetchUsers = async (page) => {
        const p = page || usuariosPagRef.current || 1;
        setUsuariosCargando(true);
        try {
            const params = new URLSearchParams();
            params.append('per_page', '24');
            params.append('page', String(p));
            if (usersSearchDeb) params.append('search', usersSearchDeb);
            if (userFilter !== 'all' && userFilter !== 'pendientes') params.append('rol', userFilter);
            if (userFilter === 'pendientes') params.append('estado', 'pendiente');
            const resp = await axios.get(`/api/admin/users?${params.toString()}`);
            setUsuariosPagina(resp.data.data || []);
            setUsuariosTotal(resp.data.total || 0);
            setUsuariosUltima(resp.data.last_page || 1);
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
        } finally {
            setUsuariosCargando(false);
        }
    };

    // Escáner de carnet digital (paridad Sebastián): el QR trae JSON SENA_ACCESS;
    // se busca por identificación y se filtra el listado por identificación.
    const handleQrScan = (rawData) => {
        setIsQrScannerOpen(false);
        try {
            const parsed = JSON.parse(rawData);
            if (parsed.app === 'SENA_ACCESS' && parsed.user_identification) {
                setSearchTermUsers(parsed.user_identification);
            } else {
                setSearchTermUsers(rawData.trim());
            }
        } catch {
            setSearchTermUsers(rawData.trim());
        }
        setUserFilter('all');
        setView('users');
        showAlert('Búsqueda aplicada desde el carnet escaneado');
    };

    // Badge de pendientes: cuenta solicitudes sin entrar a la bandeja.
    const fetchPendientesCount = async () => {
        try {
            const { data } = await axios.get('/api/admin/users?estado=pendiente&per_page=1');
            setPendientesCount(data.total || 0);
        } catch (_) { /* el badge se queda en 0 */ }
    };

    useEffect(() => {
        if (view === 'users') fetchPendientesCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    useEffect(() => {
        // Al volver a la pestaña se re-pide solo la página visible de usuarios.
        const onFocus = () => {
            if (view === 'users') fetchUsers();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    // Debounce de 400 ms en la búsqueda de usuarios: no dispara un GET por tecla.
    useEffect(() => {
        const t = setTimeout(() => {
            setUsersSearchDeb(searchTermUsers.trim());
            setUsuariosPag(1);
            usuariosPagRef.current = 1;
        }, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTermUsers]);

    // La página del carrusel vive en el servidor: buscar, filtrar o paginar
    // re-pide solo 24 filas en vez de refiltrar todo en el navegador.
    useEffect(() => {
        if (view === 'users' && !editingUser && !creatingUser) {
            usuariosPagRef.current = usuariosPag;
            fetchUsers(usuariosPag);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, usuariosPag, usersSearchDeb, userFilter]);

    // HOOK: al montar el panel solo se valida la sesión y se traen los roles.
    // Los datos de cada vista se piden al abrirla, así la entrada es inmediata.
    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('access_token');
            if (!token) {
                navigate('/login');
                return;
            }

            // Los roles no bloquean el panel: se piden en paralelo.
            const rolesP = axios.get('/api/admin/roles').then((r) => r.data).catch(() => null);

            try {
                const userMe = await axios.get('/api/user');
                setCurrentUser(userMe.data);
                localStorage.setItem('sena_usuario', JSON.stringify(userMe.data));
                const datosRoles = await rolesP;
                if (datosRoles) setRoles(datosRoles);
            } catch (error) {
                console.error('Error cargando datos: ', error);
                if (error.response && error.response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    localStorage.removeItem('sena_usuario');
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

    // El carrusel de usuarios ya viene filtrado y paginado del servidor
    // (fetchUsers con search/rol); aquí no se refiltra nada en el navegador.
    const filteredUsers = usuariosPagina;

    // Funcion para desplazar el carrusel
    const scrollCarousel = (direction) => {
        if (carouselRef.current) {
            const scrollAmount = 300;
            carouselRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };
    // Funcion para editar un usuario
    const handleEditClick = (user) => {
        setCreatingUser(false);
        setEditingUser(user.id_usuario);
        setFormData({
            user_identification: user.user_identification || '',
            user_name: user.user_name || '',
            user_lastname: user.user_lastname || '',
            user_email: user.user_email || '',
        user_password: '',
        user_coursenumber: user.user_coursenumber || '',
        user_program: user.user_program || '',
        user_documento_tipo: user.user_documento_tipo || 'CC',
        user_telefono: user.user_telefono || '',
        fk_id_rol: user.fk_id_rol || '',
        profile_photo_path: user.profile_photo_path || null
    });
};
// Funcion para cancelar la edicion o creación de un usuario
const handleCancelEdit = () => {
    setEditingUser(null);
    setCreatingUser(false);
    setFormErrors({});
    setFormData({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: '',
        user_coursenumber: '',
        user_program: '',
        user_documento_tipo: 'CC',
        user_telefono: '',
        fk_id_rol: ''
    });
};
    // Funcion para cambiar un dato del formulario
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
    // Funcion para actualizar un usuario
    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            // Workaround para PUT con FormData en Laravel
            data.append('_method', 'PUT');

            const response = await axios.post(`/api/admin/users/${editingUser}`, data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }); // El metodo axios.post se usa para enviar los datos del formulario al backend.

            fetchUsers(); // Refresca la página visible del carrusel

            // Si el usuario editado es el actual, actualizarlo también
            if (currentUser && currentUser.id_usuario === editingUser) {
                setCurrentUser(response.data);
            }

            showAlert('Usuario actualizado con éxito');
            handleCancelEdit();
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al actualizar usuario: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };
    // Abre el mismo formulario de edición en modo crear
    const handleNewUser = () => {
        setEditingUser(null);
        setCreatingUser(true);
        setFormErrors({});
        setFormData({
            user_identification: '',
            user_name: '',
            user_lastname: '',
            user_email: '',
            user_password: '',
            user_coursenumber: '',
            user_program: '',
            user_documento_tipo: 'CC',
            user_telefono: '',
            fk_id_rol: ''
        });
    };
    // Funcion para crear un usuario (POST /api/admin/users, mismos campos que editar)
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });

            const response = await axios.post('/api/admin/users', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            fetchUsers(); // Refresca la página visible del carrusel
            showAlert('Usuario creado con éxito');
            handleCancelEdit();
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al crear usuario: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };
    // Funcion para eliminar un usuario
    // Bandeja de pendientes: aprueba (avisa al correo) o rechaza la solicitud.
    const handleAprobar = async (id) => {
        try {
            const { data } = await axios.post(`/api/admin/users/${id}/aprobar`);
            showAlert(data.message || 'Cuenta aprobada');
            fetchUsers();
            fetchPendientesCount();
        } catch (error) {
            showAlert(error.response?.data?.message || 'Error al aprobar', 'error');
        }
    };

    const handleRechazar = async (id) => {
        const confirmed = await showConfirm('¿Rechazar esta solicitud de cuenta?');
        if (!confirmed) return;
        try {
            const { data } = await axios.post(`/api/admin/users/${id}/rechazar`);
            showAlert(data.message || 'Solicitud rechazada');
            fetchUsers();
            fetchPendientesCount();
        } catch (error) {
            showAlert(error.response?.data?.message || 'Error al rechazar', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este usuario?');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/users/${id}`);
                fetchUsers(); // Refresca la página visible del carrusel
                showAlert('Usuario eliminado');
            } catch (error) {
                showAlert('Error al eliminar usuario', 'error');
            }
        }
    };

    // Campos base del perfil propio para PUT /api/my-profile (multipart + _method=PUT).
    const datosBaseMiPerfil = () => {
        const data = new FormData();
        data.append('user_identification', currentUser.user_identification || '');
        data.append('user_name', currentUser.user_name || '');
        data.append('user_lastname', currentUser.user_lastname || '');
        data.append('user_email', currentUser.user_email || '');
        data.append('_method', 'PUT');
        return data;
    };

    // Sube la foto recortada (campo `image`, max 5MB) a mi perfil.
    const subirFotoMiPerfil = async (blob) => {
        try {
            const data = datosBaseMiPerfil();
            data.append('image', blob, 'foto.jpg');
            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentUser(response.data);
            setPerfilArchivo(null);
            showAlert('Foto de perfil actualizada');
        } catch (error) {
            const detalle = error.response?.data?.errors?.image?.[0];
            showAlert('Error al subir foto: ' + (detalle || error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    // Cambia mi contraseña; con 2FA activo el backend envia un codigo de
    // 6 digitos al correo (422 + errors.two_factor_code) y se reenvia con el codigo.
    const cambiarClaveMiPerfil = async (e) => {
        e.preventDefault();
        try {
            const data = datosBaseMiPerfil();
            data.append('user_password', claveNueva);
            if (codigo2faAdm) data.append('two_factor_code', codigo2faAdm);
            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentUser(response.data);
            setClaveNueva('');
            setCodigo2faAdm('');
            setCodigoSolicitadoAdm(false);
            showAlert('Contraseña actualizada');
        } catch (error) {
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitadoAdm(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al cambiar contraseña: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="app-cargando">
                <div className="spinner-border text-success" role="status" />
                <p className="mb-0">Cargando panel...</p>
            </div>
        );
    }

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    // La ficha y el programa solo aplican al rol Aprendiz; admin e instructor no los tienen.
    const esRolAprendiz = roles.find(r => r.id_rol === formData.fk_id_rol)?.rol_name === 'Aprendiz';

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'users':
                return (
                    <div className="fade-in-up">
                        {(editingUser || creatingUser) && (
                            <div ref={userFormRef} className="glass-box p-4 mb-5 mx-auto fade-in-up" style={{ maxWidth: '600px' }}>
                                <div className="section-header">
                                    <h3 className="mb-0">{creatingUser ? 'Crear Nuevo Usuario' : 'Editar Perfil de Usuario'}</h3>
                                </div>
                                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                                    <form onSubmit={creatingUser ? handleCreate : handleUpdate}>
                                        <div className="row">
                                            <div className="col-12 mb-3">

                                                <label className="form-label opacity-75 small">N° Documento</label>
                                                <input type="text" name="user_identification" className={`form-control ${formErrors.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={handleChange} required />
                                                {fieldError('user_identification')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Tipo de Documento</label>
                                                <select name="user_documento_tipo" className={`form-select ${formErrors.user_documento_tipo ? 'is-invalid' : ''}`} value={formData.user_documento_tipo} onChange={handleChange} required>
                                                    <option value="CC">CC: Cédula de Ciudadanía</option>
                                                    <option value="CE">CE: Cédula de Extranjería</option>
                                                    <option value="TI">TI: Tarjeta de Identidad</option>
                                                    <option value="PAS">PAS: Pasaporte</option>
                                                </select>
                                                {fieldError('user_documento_tipo')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Teléfono de contacto (opcional)</label>
                                                <input type="tel" name="user_telefono" className={`form-control ${formErrors.user_telefono ? 'is-invalid' : ''}`} value={formData.user_telefono} onChange={handleChange} />
                                                {fieldError('user_telefono')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Nombre</label>
                                                <input type="text" name="user_name" className={`form-control ${formErrors.user_name ? 'is-invalid' : ''}`} value={formData.user_name} onChange={handleChange} required />
                                                {fieldError('user_name')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Apellido</label>
                                                <input type="text" name="user_lastname" className={`form-control ${formErrors.user_lastname ? 'is-invalid' : ''}`} value={formData.user_lastname} onChange={handleChange} required />
                                                {fieldError('user_lastname')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Email Institucional</label>
                                                <input type="email" name="user_email" className={`form-control ${formErrors.user_email ? 'is-invalid' : ''}`} value={formData.user_email} onChange={handleChange} required />
                                                {fieldError('user_email')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">{creatingUser ? 'Contraseña' : 'Seguridad (Opcional)'}</label>
                                                <input type="password" name="user_password" placeholder={creatingUser ? 'Contraseña obligatoria...' : 'Nueva contraseña...'} className={`form-control ${formErrors.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={handleChange} required={creatingUser} />
                                                {fieldError('user_password')}
                                            </div>
                                            {esRolAprendiz && (
                                                <>
                                                    <div className="col-12 mb-3">
                                                        <label className="form-label opacity-75 small">Ficha</label>
                                                        <input type="number" name="user_coursenumber" className={`form-control ${formErrors.user_coursenumber ? 'is-invalid' : ''}`} value={formData.user_coursenumber} onChange={handleChange} required />
                                                        {fieldError('user_coursenumber')}
                                                    </div>
                                                    <div className="col-12 mb-3">
                                                        <label className="form-label opacity-75 small">Programa</label>
                                                        <input type="text" name="user_program" className={`form-control ${formErrors.user_program ? 'is-invalid' : ''}`} value={formData.user_program} onChange={handleChange} required />
                                                        {fieldError('user_program')}
                                                    </div>
                                                </>
                                            )}
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Rol Asignado</label>
                                                <select name="fk_id_rol" className={`form-select ${formErrors.fk_id_rol ? 'is-invalid' : ''}`} value={formData.fk_id_rol} onChange={handleChange} required>
                                                    <option value="">Seleccione un rol</option>
                                                    {roles.map(role => (
                                                        <option key={role.id_rol} value={role.id_rol}>{role.rol_name}</option>
                                                    ))}
                                                </select>
                                                {fieldError('fk_id_rol')}
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2 mt-4">
                                            <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                                                <span className="material-symbols-outlined">{creatingUser ? 'person_add' : 'save'}</span> {creatingUser ? 'Crear Usuario' : 'Actualizar Datos'}
                                            </button>
                                            <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={handleCancelEdit}>
                                                Cancelar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {!editingUser && !creatingUser ? (
                            <div className="mx-auto w-100" style={{ maxWidth: '1200px', minWidth: 0 }}>
                                <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3 px-3 px-md-4">
                                    <div className="section-header mb-0">
                                        <h3 className="mb-0">Gestión de {userFilter === 'all' ? 'Usuarios' : userFilter === 'pendientes' ? 'Cuentas pendientes' : userFilter}</h3>
                                        <p className="small opacity-50 mb-0">Total: {usuariosTotal} registros{usuariosCargando ? ' • cargando…' : ''}</p>
                                    </div>
                                    <div className="d-flex gap-2 flex-wrap align-items-center usuarios-acciones">
                                        <button className="btn btn-success action-btn" onClick={handleNewUser}>
                                            <span className="material-symbols-outlined small">person_add</span> Nuevo usuario
                                        </button>
                                        <div className="btn-group" role="group" aria-label="Filtrar por rol">
                                            {[
                                                { key: 'all', label: 'Todos' },
                                                { key: 'pendientes', label: 'Pendientes' },
                                                { key: 'Instructor', label: 'Instructores' },
                                                { key: 'Aprendiz', label: 'Aprendices' },
                                                { key: 'Admin', label: 'Admins' },
                                                { key: 'Invitado', label: 'Invitados' }
                                            ].map(f => (
                                                <button
                                                    key={f.key}
                                                    type="button"
                                                    className={`btn btn-sm ${userFilter === f.key ? 'btn-success' : 'btn-outline-success'}`}
                                                    onClick={() => { setUserFilter(f.key); setUsuariosPag(1); usuariosPagRef.current = 1; }}
                                                >
                                                    {f.label}
                                                    {f.key === 'pendientes' && pendientesCount > 0 && (
                                                        <span className="badge rounded-pill bg-warning text-dark ms-1">{pendientesCount}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="input-group search-input-group" style={{ maxWidth: '350px' }}>
                                        <span className="input-group-text">
                                            <span className="material-symbols-outlined">search</span>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar..."
                                            value={searchTermUsers}
                                            onChange={(e) => setSearchTermUsers(e.target.value)}
                                        />
                                        </div>
                                    </div>
                                </div>

                                <div className="carousel-wrapper position-relative">
                                    <button className="carousel-nav-btn left shadow-lg" onClick={() => scrollCarousel('left')} aria-label="Anterior">
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>

                                    <div className="carousel-blur-start"></div>
                                    <div className="user-carousel d-flex gap-4 pb-4 px-3 px-md-5" ref={carouselRef}>
                                        {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                            <div key={user.id_usuario} className="user-card-new glass-box">
                                                <div className="user-card-header text-center pt-4 mb-3">
                                                    <div className="user-avatar-lg mx-auto mb-3 shadow overflow-hidden">
                                                        {user.profile_photo_path ? (
                                                            <img src={user.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <>{user.user_name[0]}{user.user_lastname[0]}</>
                                                        )}
                                                    </div>
                                                    <h5 className="mb-1 text-truncate px-2">{user.user_name} {user.user_lastname}</h5>
                                                    <span className={`badge ${user.role?.rol_name === 'Admin' ? 'bg-danger' : 'bg-success'} bg-opacity-10 text-${user.role?.rol_name === 'Admin' ? 'danger' : 'success'} border border-${user.role?.rol_name === 'Admin' ? 'danger' : 'success'} border-opacity-25`} style={{ fontSize: '0.65rem' }}>
                                                        {user.role?.rol_name}
                                                    </span>
                                                </div>

                                                <div className="user-card-body px-3 pb-3">
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">id_card</span>
                                                        <span className="text-truncate">{user.user_identification || 'S/N'}</span>
                                                    </div>
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">mail</span>
                                                        <span className="text-truncate">{user.user_email}</span>
                                                    </div>
                                                    <div className="user-info-item">
                                                        <span className="material-symbols-outlined">groups</span>
                                                        <span className="text-truncate">Ficha: {user.user_coursenumber || '—'}</span>
                                                    </div>
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">school</span>
                                                        <span className="text-truncate">{user.user_program || 'Sin programa'}</span>
                                                    </div>
                                                    {user.user_telefono && (
                                                        <div className="user-info-item">
                                                            <span className="material-symbols-outlined">call</span>
                                                            <span className="text-truncate">{user.user_telefono}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="d-flex gap-2 px-3 pb-4">
                                                    {user.estado_cuenta === 'pendiente' ? (
                                                        <>
                                                            <button className="btn btn-success btn-sm action-btn flex-grow-1" onClick={() => handleAprobar(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">check_circle</span> Aprobar
                                                            </button>
                                                            <button className="btn btn-danger btn-sm action-btn flex-grow-1" onClick={() => handleRechazar(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">cancel</span> Rechazar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="btn btn-warning btn-sm action-btn flex-grow-1" onClick={() => handleEditClick(user)}>
                                                                <span className="material-symbols-outlined small">edit</span> Editar
                                                            </button>
                                                            <button className="btn btn-danger btn-sm action-btn flex-grow-1" onClick={() => handleDelete(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">delete</span> Eliminar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center w-100 py-5 opacity-50">
                                                <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>person_off</span>
                                                <p className="mt-2">No se encontraron usuarios</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="carousel-blur-end"></div>

                                    <button className="carousel-nav-btn right shadow-lg" onClick={() => scrollCarousel('right')} aria-label="Siguiente">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>
                                {/* Paginación del servidor: 24 por página, sin renderizar cientos de tarjetas */}
                                {usuariosUltima > 1 && (
                                    <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            disabled={usuariosPag <= 1 || usuariosCargando}
                                            onClick={() => setUsuariosPag(p => Math.max(1, p - 1))}
                                        >
                                            Anterior
                                        </button>
                                        <span className="small opacity-75">Página {usuariosPag} de {usuariosUltima}</span>
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            disabled={usuariosPag >= usuariosUltima || usuariosCargando}
                                            onClick={() => setUsuariosPag(p => Math.min(usuariosUltima, p + 1))}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                );
            case 'ambientes':
                return <Ambientes currentUser={currentUser} rol="superadmin" />;
            case 'escanear_carnet':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto text-center" style={{ maxWidth: '640px' }}>
                            <h3 className="mb-2">Escanear Carnet Digital</h3>
                            <p className="opacity-50 small">Apunta al QR del carnet para buscar al usuario.</p>
                            <button type="button" className="btn btn-success px-4 py-2" onClick={() => setIsQrScannerOpen(true)}>
                                <span className="material-symbols-outlined small me-1">qr_code_scanner</span> Abrir escáner
                            </button>
                        </div>
                        <QrScannerModal isOpen={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onScanSuccess={handleQrScan} />
                    </div>
                );
            case 'acceso_qr':
                return <AccesoQr />;
            case 'profile':
                return (
                    <div className="fade-in-up glass-box p-5 mx-auto" style={{ maxWidth: '600px' }}>
                        <div className="text-center mb-4">
                            <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-3 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2.5rem', fontWeight: 'bold' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{currentUser?.user_name[0]}{currentUser?.user_lastname[0]}</>
                                )}
                            </div>
                            <h3 className="mb-1">{currentUser?.user_name} {currentUser?.user_lastname}</h3>
                            <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-3 py-1">
                                {currentUser?.role?.rol_name || 'Usuario'}
                            </span>
                        </div>

                        <div className="row text-start mt-4 g-4">
                            <div className="col-12">
                                <label className="form-label opacity-50 small mb-1">Identificación</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_identification || 'No registrada'}
                                </div>
                            </div>
                            <div className="col-12">
                                <label className="form-label opacity-50 small mb-1">Correo Institucional</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_email}
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label opacity-50 small mb-1">Programa</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_program}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10">
                            <button className="btn btn-outline-success w-100 py-3 d-flex align-items-center justify-content-center gap-2" onClick={() => {
                                handleEditClick(currentUser);
                                setView('users');
                            }}>
                                <span className="material-symbols-outlined">edit</span>
                                Editar Información de Perfil
                            </button>
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10 text-start">
                            <label className="form-label opacity-75 small">Foto de perfil</label>
                            {perfilArchivo ? (
                                <RecorteFoto
                                    archivo={perfilArchivo}
                                    alCancelar={() => setPerfilArchivo(null)}
                                    alConfirmar={subirFotoMiPerfil}
                                />
                            ) : (
                                <label className="btn btn-outline-success btn-sm w-100">
                                    <span className="material-symbols-outlined small me-1">photo_camera</span> Cambiar foto
                                    <input type="file" accept="image/*" hidden onChange={(e) => {
                                        if (e.target.files?.[0]) setPerfilArchivo(e.target.files[0]);
                                        e.target.value = '';
                                    }} />
                                </label>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10 text-start">
                            <form onSubmit={cambiarClaveMiPerfil}>
                                <label className="form-label opacity-75 small">Nueva contraseña (opcional)</label>
                                <input type="password" placeholder="Mínimo 6 caracteres..." className="form-control" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} />
                                <small className="opacity-50">Si tienes verificación en dos pasos activa, al guardar se enviará un código de 6 dígitos a tu correo.</small>
                                {codigoSolicitadoAdm && (
                                    <div className="mt-2">
                                        <label className="form-label opacity-75 small">Código de 6 dígitos (enviado a tu correo)</label>
                                        <input type="text" inputMode="numeric" maxLength="6" placeholder="123456" className="form-control" value={codigo2faAdm} onChange={(e) => setCodigo2faAdm(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                                    </div>
                                )}
                                <button type="submit" className="btn btn-success w-100 mt-2" disabled={!claveNueva}>
                                    <span className="material-symbols-outlined">lock</span> Cambiar contraseña
                                </button>
                            </form>
                        </div>
                        <DosPasos />
                        <MiHuella />
                                <SimulacionHuella />
                    </div>
                );
            case 'novedad_form':
                return <Novedades currentUser={currentUser} initialMode="form" />;
            case 'novedad_historial':
                return <Novedades currentUser={currentUser} initialMode="history" />;
            default:
                return null;
        }
    };

    // Nav del superadmin: gestión de usuarios, ambientes y novedades, más el
    // QR de acceso que se genera desde la web. Sin vistas de portería.
    const adminLinks = [
        { label: 'Dashboard', icon: 'dashboard', view: 'dashboard' },
        { label: 'Novedades', icon: 'report_problem', view: 'novedad_historial' },
        { label: 'Usuarios', icon: 'group', view: 'users', filter: 'all' },
        { label: 'Ambientes', icon: 'meeting_room', view: 'ambientes' },
        { label: 'Escanear carnet', icon: 'qr_code_scanner', view: 'escanear_carnet' },
        { label: 'Acceso QR', icon: 'qr_code_2', view: 'acceso_qr' }
    ];

    return (
        <div className="min-vh-100 d-flex flex-column fade-in-up" style={{ background: 'transparent' }}>
            <Navbar
                currentUser={currentUser}
                view={view}
                setView={setView}
                userFilter={userFilter}
                setUserFilter={setUserFilter}
                links={adminLinks}
            />

            <main className="container-fluid px-3 px-md-5 py-2 flex-grow-1">
                {renderView()}
            </main>

            <Footer />
        </div>
    );
};

export default Admin;
