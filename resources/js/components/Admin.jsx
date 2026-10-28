import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import Novedades from './Novedades';
import StatsDashboard from './StatsDashboard';
import Ambientes from './Ambientes';
import AccesoQr from './AccesoQr';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import SimulacionHuella from './SimulacionHuella';
import PerfilSena from './PerfilSena';
import EditarMiPerfil from './EditarMiPerfil';
import { showAlert, showConfirm } from './CustomAlert';
import { mensajeDeError } from '../utils/mensajes';
import { corregirRolDePanel } from '../utils/sesion';

// Usuario de la última sesión: permite pintar el panel al instante y
// refrescarlo con /api/user en segundo plano.
const usuarioGuardado = () => {
    try {
        return JSON.parse(localStorage.getItem('sena_usuario') || 'null');
    } catch (_) {
        return null;
    }
};

// Una cuenta es invitada por su rol o, en datos viejos, por el correo que
// genera /register-guest. Sirve para no mostrarla como aprendiz ni pedirle
// ficha/programa que nunca tuvo.
const esCuentaInvitado = (user) => {
    const rol = String(user?.role?.rol_name || '').trim().toLowerCase();
    const email = String(user?.user_email || '').trim().toLowerCase();
    return rol === 'invitado' || rol === 'visitante' || rol === 'guest' || email.startsWith('guest_');
};

const Admin = () => {
    // HOOK: useNavigate se emplea para redirigir al Login si el usuario no tiene una sesión activa o el token expira.
    const navigate = useNavigate();
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
    const [editingProfile, setEditingProfile] = useState(false); // Edición del perfil propio

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
                // Si la sesión real no es de superadmin, se redirige a su panel
                // (una pestaña vieja no puede quedarse en /admin con otro rol).
                if (!corregirRolDePanel(userMe.data, 'superadmin', navigate)) return;
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

    // La lista ya viene filtrada y paginada del servidor
    // (fetchUsers con search/rol); aquí no se refiltra nada en el navegador.
    const filteredUsers = usuariosPagina;

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
    const esRolAprendiz = String(roles.find(r => String(r.id_rol) === String(formData.fk_id_rol))?.rol_name || '').toLowerCase() === 'aprendiz';

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'users':
                return (
                    <div className="fade-in-up">
                        {(editingUser || creatingUser) && (
                            <div ref={userFormRef} className="glass-box p-4 mb-5 mx-auto fade-in-up" style={{ maxWidth: '760px' }}>
                                <div className="page-cabecera mb-3">
                                    <div>
                                        <h3 className="page-titulo mb-1">{creatingUser ? 'Nuevo usuario' : 'Editar usuario'}</h3>
                                        <p className="page-subtitulo mb-0">{creatingUser ? 'Crea la cuenta y asigna su rol.' : 'Actualiza los datos de la cuenta.'}</p>
                                    </div>
                                    <div className="page-acciones">
                                        <button type="button" className="btn btn-outline-secondary action-btn" onClick={handleCancelEdit}>
                                            <span className="material-symbols-outlined">arrow_back</span> Volver
                                        </button>
                                    </div>
                                </div>
                                <div className="admin-scrollable-container" style={{ maxHeight: '65vh' }}>
                                    <form onSubmit={creatingUser ? handleCreate : handleUpdate}>
                                        <div className="perfil-editar-titulo">Identidad</div>
                                        <div className="row">
                                            <div className="col-md-4 mb-3">
                                                <label className="form-label opacity-75 small">Tipo de documento</label>
                                                <select name="user_documento_tipo" className={`form-select ${formErrors.user_documento_tipo ? 'is-invalid' : ''}`} value={formData.user_documento_tipo} onChange={handleChange} required>
                                                    <option value="CC">CC: Cédula de Ciudadanía</option>
                                                    <option value="CE">CE: Cédula de Extranjería</option>
                                                    <option value="TI">TI: Tarjeta de Identidad</option>
                                                    <option value="PAS">PAS: Pasaporte</option>
                                                </select>
                                                {fieldError('user_documento_tipo')}
                                            </div>
                                            <div className="col-md-8 mb-3">
                                                <label className="form-label opacity-75 small">N° documento</label>
                                                <input type="text" name="user_identification" className={`form-control ${formErrors.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={handleChange} required />
                                                {fieldError('user_identification')}
                                            </div>
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label opacity-75 small">Nombre</label>
                                                <input type="text" name="user_name" className={`form-control ${formErrors.user_name ? 'is-invalid' : ''}`} value={formData.user_name} onChange={handleChange} required />
                                                {fieldError('user_name')}
                                            </div>
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label opacity-75 small">Apellido</label>
                                                <input type="text" name="user_lastname" className={`form-control ${formErrors.user_lastname ? 'is-invalid' : ''}`} value={formData.user_lastname} onChange={handleChange} required />
                                                {fieldError('user_lastname')}
                                            </div>
                                        </div>

                                        <div className="perfil-editar-titulo">Contacto</div>
                                        <div className="row">
                                            <div className="col-md-8 mb-3">
                                                <label className="form-label opacity-75 small">Correo institucional</label>
                                                <input type="email" name="user_email" className={`form-control ${formErrors.user_email ? 'is-invalid' : ''}`} value={formData.user_email} onChange={handleChange} required />
                                                {fieldError('user_email')}
                                            </div>
                                            <div className="col-md-4 mb-3">
                                                <label className="form-label opacity-75 small">Teléfono (opcional)</label>
                                                <input type="tel" name="user_telefono" className={`form-control ${formErrors.user_telefono ? 'is-invalid' : ''}`} value={formData.user_telefono} onChange={handleChange} />
                                                {fieldError('user_telefono')}
                                            </div>
                                        </div>

                                        {esRolAprendiz && (
                                            <>
                                                <div className="perfil-editar-titulo">Académico</div>
                                                <div className="row">
                                                    <div className="col-md-4 mb-3">
                                                        <label className="form-label opacity-75 small">Ficha</label>
                                                        <input type="number" name="user_coursenumber" className={`form-control ${formErrors.user_coursenumber ? 'is-invalid' : ''}`} value={formData.user_coursenumber} onChange={handleChange} required />
                                                        {fieldError('user_coursenumber')}
                                                    </div>
                                                    <div className="col-md-8 mb-3">
                                                        <label className="form-label opacity-75 small">Programa</label>
                                                        <input type="text" name="user_program" className={`form-control ${formErrors.user_program ? 'is-invalid' : ''}`} value={formData.user_program} onChange={handleChange} required />
                                                        {fieldError('user_program')}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="perfil-editar-titulo">Acceso</div>
                                        <div className="row">
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label opacity-75 small">Rol asignado</label>
                                                <select name="fk_id_rol" className={`form-select ${formErrors.fk_id_rol ? 'is-invalid' : ''}`} value={formData.fk_id_rol} onChange={handleChange} required>
                                                    <option value="">Seleccione un rol</option>
                                                    {roles.map(role => (
                                                        <option key={role.id_rol} value={role.id_rol}>{role.rol_name}</option>
                                                    ))}
                                                </select>
                                                {fieldError('fk_id_rol')}
                                            </div>
                                            <div className="col-md-6 mb-3">
                                                <label className="form-label opacity-75 small">{creatingUser ? 'Contraseña' : 'Nueva contraseña (opcional)'}</label>
                                                <input type="password" name="user_password" placeholder={creatingUser ? 'Contraseña obligatoria…' : 'Dejar vacío para no cambiarla'} className={`form-control ${formErrors.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={handleChange} required={creatingUser} />
                                                {fieldError('user_password')}
                                            </div>
                                        </div>

                                        <div className="d-flex gap-2 mt-4">
                                            <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                                                <span className="material-symbols-outlined">{creatingUser ? 'person_add' : 'save'}</span> {creatingUser ? 'Crear usuario' : 'Guardar cambios'}
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
                                <div className="page-cabecera px-3 px-md-4">
                                    <div>
                                        <h3 className="page-titulo mb-1">
                                            {userFilter === 'all' ? 'Usuarios' : userFilter === 'pendientes' ? 'Cuentas pendientes' : userFilter}
                                        </h3>
                                        <p className="page-subtitulo mb-0">
                                            {usuariosTotal} registro{usuariosTotal === 1 ? '' : 's'}{usuariosCargando ? ' · actualizando…' : ''}
                                        </p>
                                    </div>
                                    <div className="page-acciones">
                                        <button className="btn btn-success action-btn" onClick={handleNewUser}>
                                            <span className="material-symbols-outlined small">person_add</span> Nuevo usuario
                                        </button>
                                    </div>
                                </div>

                                <div className="filtros-barra px-3 px-md-4">
                                    <div className="buscador-sena">
                                        <span className="material-symbols-outlined">search</span>
                                        <input
                                            type="text"
                                            placeholder="Buscar por nombre, documento, correo o ficha…"
                                            value={searchTermUsers}
                                            onChange={(e) => setSearchTermUsers(e.target.value)}
                                            aria-label="Buscar usuarios"
                                        />
                                        {searchTermUsers && (
                                            <button type="button" className="buscador-limpiar" onClick={() => setSearchTermUsers('')} aria-label="Limpiar búsqueda">
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="filtros-chips" role="group" aria-label="Filtrar por rol">
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
                                                className={`chip-sena ${userFilter === f.key ? 'activo' : ''}`}
                                                onClick={() => { setUserFilter(f.key); setUsuariosPag(1); usuariosPagRef.current = 1; }}
                                            >
                                                {f.label}
                                                {f.key === 'pendientes' && pendientesCount > 0 && (
                                                    <span className="chip-conteo">{pendientesCount}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid-usuarios px-3 px-md-4">
                                    {filteredUsers.length > 0 ? filteredUsers.map(user => {
                                        const invitado = esCuentaInvitado(user);
                                        const rolVisible = invitado ? 'Invitado' : (user.role?.rol_name || '—');
                                        const tonoRol = invitado ? 'warning' : user.role?.rol_name === 'Admin' ? 'danger' : 'success';
                                        return (
                                        <article key={user.id_usuario} className="user-card-new glass-box">
                                            <div className="user-card-header">
                                                <div className="user-avatar-lg overflow-hidden">
                                                    {user.profile_photo_path ? (
                                                        <img src={user.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <>{user.user_name[0]}{user.user_lastname[0]}</>
                                                    )}
                                                </div>
                                                <div className="user-card-identidad">
                                                    <h5 className="mb-1 text-truncate">{user.user_name} {user.user_lastname}</h5>
                                                    <span className={`badge bg-${tonoRol} bg-opacity-10 text-${tonoRol} border border-${tonoRol} border-opacity-25`} style={{ fontSize: '0.65rem' }}>
                                                        {rolVisible}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="user-card-body">
                                                <div className="user-info-item">
                                                    <span className="material-symbols-outlined">id_card</span>
                                                    <span className="text-truncate">{user.user_identification || 'S/N'}</span>
                                                </div>
                                                <div className="user-info-item">
                                                    <span className="material-symbols-outlined">mail</span>
                                                    <span className="text-truncate">{user.user_email}</span>
                                                </div>
                                                {invitado ? (
                                                    <div className="user-info-item">
                                                        <span className="material-symbols-outlined">qr_code_2</span>
                                                        <span className="text-truncate">Invitado temporal con QR de un uso</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="user-info-item">
                                                            <span className="material-symbols-outlined">groups</span>
                                                            <span className="text-truncate">Ficha: {user.user_coursenumber || '—'}</span>
                                                        </div>
                                                        <div className="user-info-item">
                                                            <span className="material-symbols-outlined">school</span>
                                                            <span className="text-truncate">{user.user_program || 'Sin programa'}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {user.user_telefono && (
                                                    <div className="user-info-item">
                                                        <span className="material-symbols-outlined">call</span>
                                                        <span className="text-truncate">{user.user_telefono}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="user-card-acciones">
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
                                                        <button className="btn btn-outline-success btn-sm action-btn flex-grow-1" onClick={() => handleEditClick(user)}>
                                                            <span className="material-symbols-outlined small">edit</span> Editar
                                                        </button>
                                                        <button className="btn btn-outline-danger btn-sm action-btn" onClick={() => handleDelete(user.id_usuario)} aria-label={`Eliminar a ${user.user_name}`}>
                                                            <span className="material-symbols-outlined small">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </article>
                                        );
                                    }) : (
                                        <div className="estado-vacio">
                                            <span className="material-symbols-outlined">person_off</span>
                                            <p className="mb-0">No se encontraron usuarios con esos filtros.</p>
                                        </div>
                                    )}
                                </div>

                                {usuariosUltima > 1 && (
                                    <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
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
            case 'acceso_qr':
                return <AccesoQr />;
            case 'profile':
                if (editingProfile) {
                    return (
                        <EditarMiPerfil
                            usuario={currentUser}
                            mostrarFichaPrograma={false}
                            onCancelar={() => setEditingProfile(false)}
                            onGuardado={(usuario) => {
                                setCurrentUser(usuario);
                                setEditingProfile(false);
                            }}
                        />
                    );
                }
                return (
                    <PerfilSena
                        usuario={currentUser}
                        rol={currentUser?.role?.rol_name || 'Superadmin'}
                        onEditar={() => setEditingProfile(true)}
                        seguridad={<><DosPasos /><MiHuella /><SimulacionHuella /></>}
                    />
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
        { label: 'Inicio', icon: 'dashboard', view: 'dashboard' },
        { label: 'Novedades', icon: 'report_problem', view: 'novedad_historial' },
        { label: 'Usuarios', icon: 'group', view: 'users', filter: 'all' },
        { label: 'Ambientes', icon: 'meeting_room', view: 'ambientes' },
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
