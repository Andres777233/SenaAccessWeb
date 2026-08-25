import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import Novedades from './Novedades';
import StatsDashboard from './StatsDashboard';
import EquipmentForm from './EquipmentForm';
import Sugerencias from './Sugerencias';
import { showAlert, showConfirm } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';

const JORNADAS = ['Mañana', 'Tarde', 'Noche'];

const Admin = () => {
    // HOOK: useNavigate se emplea para redirigir al Login si el usuario no tiene una sesión activa o el token expira.
    const navigate = useNavigate();
    const carouselRef = useRef(null);
    const userFormRef = useRef(null);
    // HOOK: useState se utiliza de forma intensiva para mantener el estado de la aplicación: usuario logueado, la vista renderizada en el panel, listas de datos desde la API y estados de carga.
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'historial', 'users', 'profile'
    const [userFilter, setUserFilter] = useState('all'); // 'all', 'Instructor', 'Aprendiz'
    const [users, setUsers] = useState([]); // Lista de usuarios
    const [roles, setRoles] = useState([]); // Lista de roles
    const [ingresos, setIngresos] = useState([]); // Lista de ingresos
    const [loading, setLoading] = useState(true); // Estado de carga
    const [editingUser, setEditingUser] = useState(null); // Usuario que se está editando
    const [searchTermUsers, setSearchTermUsers] = useState(''); // Busqueda de usuarios
    const [searchTermIngresos, setSearchTermIngresos] = useState('');   // Busqueda de ingresos
    const [filterTipo, setFilterTipo] = useState('');                    // Filtro por tipo (Entrada/Salida)
    const [filterDesde, setFilterDesde] = useState('');                  // Filtro por fecha desde
    const [filterHasta, setFilterHasta] = useState('');                  // Filtro por fecha hasta
    const [ingresosMeta, setIngresosMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [historialLoading, setHistorialLoading] = useState(false);
    const [searchTermEquipment, setSearchTermEquipment] = useState(''); // Busqueda de equipos
    const [equipmentList, setEquipmentList] = useState([]);
    const [equipoRolFilter, setEquipoRolFilter] = useState(''); // Filtro por rol en historial de equipos
    const [equipoSort, setEquipoSort] = useState({ key: 'ingreso', dir: 'desc' }); // Orden de la tabla de equipos
    const [directorioTab, setDirectorioTab] = useState('instructores'); // 'instructores' | 'aprendices'
    const [filtroInstructor, setFiltroInstructor] = useState(''); // Filtro por instructor del directorio de aprendices
    const [asignaciones, setAsignaciones] = useState([]); // Asignaciones aprendiz -> instructor
    const [asignacionesLoading, setAsignacionesLoading] = useState(true);
    const [asignarAprendiz, setAsignarAprendiz] = useState(null); // Aprendiz en modal de asignación
    const [asignacionData, setAsignacionData] = useState({ fk_id_instructor: '', jornada: '' });
    const [formData, setFormData] = useState({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: '',
        user_coursenumber: '',
        user_program: '',
        fk_id_rol: ''
    });
    const [formErrors, setFormErrors] = useState({}); // Errores de validación por campo

    // Desplaza la vista hasta el formulario al iniciar la edición de un usuario
    useEffect(() => {
        if (editingUser) {
            const timer = setTimeout(() => {
                userFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [editingUser]);

    // Refresca los datos de la vista actual al cambiar de vista y al enfocar la pestaña,
    // para que los cambios hechos por otros roles se reflejen sin recargar la página.
    const refreshViewData = async () => {
        if (view === 'historial') {
            await fetchIngresos(1);
        } else if (view === 'historial_equipos') {
            await fetchEquipment();
        } else if (view === 'users') {
            try {
                const [usersResponse, rolesResponse] = await Promise.all([
                    axios.get('/api/admin/users'),
                    axios.get('/api/admin/roles')
                ]);
                setUsers(usersResponse.data);
                setRoles(rolesResponse.data);
            } catch (error) {
                console.error('Error al refrescar usuarios:', error);
            }
        }
    };

    useEffect(() => {
        refreshViewData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    useEffect(() => {
        const onFocus = () => refreshViewData();
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    const fetchAsignaciones = async () => {
        try {
            setAsignacionesLoading(true);
            const response = await axios.get('/api/admin/aprendiz-instructores');
            setAsignaciones(response.data);
        } catch (error) {
            console.error("Error al cargar asignaciones:", error);
        } finally {
            setAsignacionesLoading(false);
        }
    }

    const fetchEquipment = async () => {
        try {
            const response = await axios.get('/api/admin/equipment');
            setEquipmentList(response.data);
        } catch (error) {
            console.error("Error al refrescar lista:", error);
        }
    }

    // Descarga el comprobante PDF del equipo indicado (el admin puede descargar cualquiera).
    const handleDescargarComprobante = async (item) => {
        try {
            await downloadComprobante(item.id_ingreso_equipo);
        } catch (error) {
            console.error('Error al descargar comprobante:', error);
            showAlert('error', error.response?.status === 403
                ? 'No tienes permiso para descargar este comprobante.'
                : 'No se pudo descargar el comprobante. Intenta de nuevo.');
        }
    }

    const fetchIngresos = async (page = 1) => {
        try {
            setHistorialLoading(true);
            const params = new URLSearchParams({ page: String(page) });
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);

            const response = await axios.get(`/api/admin/ingresos?${params.toString()}`);
            setIngresos(response.data.data);
            setIngresosMeta({
                current_page: response.data.current_page,
                last_page: response.data.last_page,
                total: response.data.total,
            });
        } catch (error) {
            console.error("Error al cargar ingresos:", error);
        } finally {
            setHistorialLoading(false);
        }
    }

    // HOOK: useEffect se ejecuta al montarse el componente. Es fundamental para simular la carga de datos inicial realizando peticiones a la API para obtener roles, usuarios, ingresos y validar la sesión.
    useEffect(() => {

        const fetchData = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const [usersResponse, rolesResponse, userMeResponse, asignacionesResponse, equipmentResponse] = await Promise.all([
                    axios.get('/api/admin/users'),
                    axios.get('/api/admin/roles'),
                    axios.get('/api/user'),
                    axios.get('/api/admin/aprendiz-instructores'),
                    axios.get('/api/admin/equipment')
                ]);
                setUsers(usersResponse.data);
                setRoles(rolesResponse.data);
                setCurrentUser(userMeResponse.data);
                setAsignaciones(asignacionesResponse.data);
                setEquipmentList(equipmentResponse.data);
                await fetchIngresos(1);
            } catch (error) {
                console.error('Error cargando datos: ', error);
                if (error.response && error.response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filtro de usuarios por nombre, apellido, email, numero de ficha y rol
    const filteredUsers = users.filter(user => {
        const search = searchTermUsers.toLowerCase();
        const matchesSearch = (
            (user.user_identification?.toLowerCase() || '').includes(search) ||
            user.user_name.toLowerCase().includes(search) ||
            user.user_lastname.toLowerCase().includes(search) ||
            user.user_email.toLowerCase().includes(search) ||
            user.user_coursenumber.toString().includes(search) ||
            user.role?.rol_name.toLowerCase().includes(search)
        );

        if (userFilter === 'all') return matchesSearch;
        return matchesSearch && user.role?.rol_name === userFilter;
    });

    // Los ingresos ya vienen filtrados y paginados desde el servidor (/api/admin/ingresos)
    const filteredIngresos = ingresos;

    // Instructores disponibles para asignar a un aprendiz
    const instructors = users.filter(user => user.role?.rol_name === 'Instructor');

    // Filtro de instructores del directorio (sin ambientes)
    const filteredInstructors = instructors;

    // Filtro de aprendices del directorio por instructor asignado
    const filteredAprendices = users.filter(user => {
        if (user.role?.rol_name !== 'Aprendiz') return false;
        if (!filtroInstructor) return true;
        return asignaciones.some(a => a.fk_id_aprendiz === user.id_usuario && a.fk_id_instructor === Number(filtroInstructor));
    });

    // Filtro de equipos por nombre, apellido, email, tipo de equipo, marca, modelo, color y serial
    const filteredEquipment = equipmentList.filter(item => {
        const search = searchTermEquipment.toLowerCase();
        const userName = `${item.user?.user_name} ${item.user?.user_lastname}`.toLowerCase();
        return (
            userName.includes(search) ||
            item.equipo_type.toLowerCase().includes(search) ||
            item.equipo_brand.toLowerCase().includes(search) ||
            item.equipo_serial.toLowerCase().includes(search) ||
            item.user?.user_identification?.toLowerCase().includes(search)
        );
    });

    const handleLogout = async () => {
        // Logica para el log-out asincronica 
        try {
            await axios.post('/api/logout');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            navigate('/');
        } catch (error) {
            console.error('Error al cerrar sesión', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            navigate('/');
        }
    };
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
        setEditingUser(user.id_usuario);
        setFormData({
            user_identification: user.user_identification || '',
            user_name: user.user_name || '',
            user_lastname: user.user_lastname || '',
            user_email: user.user_email || '',
            user_password: '',
            user_coursenumber: user.user_coursenumber || '',
            user_program: user.user_program || '',
            fk_id_rol: user.fk_id_rol || '',
            profile_photo_path: user.profile_photo_path || null
        });
    };
    // Funcion para cancelar la edicion de un usuario
    const handleCancelEdit = () => {
        setEditingUser(null);
        setFormErrors({});
        setFormData({
            user_identification: '',
            user_name: '',
            user_lastname: '',
            user_email: '',
            user_password: '',
            user_coursenumber: '',
            user_program: '',
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

            setUsers(users.map(u => u.id_usuario === editingUser ? response.data : u));

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
    // Funcion para exportar el historial de ingresos a CSV
    const handleExportCSV = async () => {
        try {
            const params = new URLSearchParams();
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);

            const response = await axios.get(`/api/admin/ingresos/export?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `historial_ingresos_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showAlert('Exportación completada');
        } catch (error) {
            showAlert('Error al exportar: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    // ---- Funciones del directorio (aprendices e instructores) ----
    const handleAsignarOpen = (aprendiz) => {
        const prev = asignaciones.find(a => a.fk_id_aprendiz === aprendiz.id_usuario);
        setAsignarAprendiz(aprendiz);
        setAsignacionData({
            fk_id_instructor: prev?.fk_id_instructor || '',
            jornada: prev?.jornada || ''
        });
    };

    const handleAsignacionChange = (e) => {
        setAsignacionData({
            ...asignacionData,
            [e.target.name]: e.target.value
        });
    };

    const handleAsignarSubmit = async (e) => {
        e.preventDefault();
        if (!asignarAprendiz) return;
        try {
            await axios.post('/api/admin/aprendiz-instructores', {
                ...asignacionData,
                fk_id_aprendiz: asignarAprendiz.id_usuario
            });
            showAlert('Asignación guardada con éxito');
            setAsignarAprendiz(null);
            await fetchAsignaciones();
        } catch (error) {
            showAlert('Error al guardar asignación: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleAsignacionDelete = async (id) => {
        const confirmed = await showConfirm('¿Quieres quitar la asignación de este aprendiz?');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/aprendiz-instructores/${id}`);
                showAlert('Asignación eliminada');
                await fetchAsignaciones();
            } catch (error) {
                showAlert('Error al eliminar asignación', 'error');
            }
        }
    };

    const aprendizAsignado = (aprendizId) => asignaciones.find(a => a.fk_id_aprendiz === aprendizId);

    // Funcion para eliminar un usuario
    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este usuario?');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/users/${id}`);
                setUsers(users.filter(u => u.id_usuario !== id));
                showAlert('Usuario eliminado');
            } catch (error) {
                showAlert('Error al eliminar usuario', 'error');
            }
        }
    };

    if (loading) return <div className="text-white text-center mt-5">Cargando...</div>;

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'users':
                return (
                    <div className="fade-in-up">
                        {editingUser && (
                            <div ref={userFormRef} className="glass-box p-4 mb-5 mx-auto fade-in-up" style={{ maxWidth: '600px' }}>
                                <div className="section-header">
                                    <h3 className="mb-0">Editar Perfil de Usuario</h3>
                                </div>
                                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                                    <form onSubmit={handleUpdate}>
                                        <div className="row">
                                            <div className="col-12 mb-3">

                                                <label className="form-label opacity-75 small">N° Documento</label>
                                                <input type="text" name="user_identification" className={`form-control ${formErrors.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={handleChange} required />
                                                {fieldError('user_identification')}
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
                                                <label className="form-label opacity-75 small">Seguridad (Opcional)</label>
                                                <input type="password" name="user_password" placeholder="Nueva contraseña..." className={`form-control ${formErrors.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={handleChange} />
                                                {fieldError('user_password')}
                                            </div>
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
                                                <span className="material-symbols-outlined">save</span> Actualizar Datos
                                            </button>
                                            <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={handleCancelEdit}>
                                                Cancelar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {!editingUser && (
                            <div className="mx-auto" style={{ maxWidth: '1200px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3 px-3 px-md-4">
                                    <div className="section-header mb-0">
                                        <h3 className="mb-0">Gestión de {userFilter === 'all' ? 'Usuarios' : userFilter}</h3>
                                        <p className="small opacity-50 mb-0">Total: {filteredUsers.length} registros</p>
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
                                                            <img src={user.profile_photo_path} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                                        <span className="text-truncate">Ficha: {user.user_coursenumber}</span>
                                                    </div>
                                                </div>

                                                <div className="d-flex gap-2 px-3 pb-4">
                                                    <button className="btn btn-warning btn-sm action-btn flex-grow-1" onClick={() => handleEditClick(user)}>
                                                        <span className="material-symbols-outlined small">edit</span> Editar
                                                    </button>
                                                    <button className="btn btn-danger btn-sm action-btn flex-grow-1" onClick={() => handleDelete(user.id_usuario)}>
                                                        <span className="material-symbols-outlined small">delete</span> Eliminar
                                                    </button>
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
                            </div>
                        )}
                    </div>
                );
            case 'historial':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                                <div className="section-header mb-0">
                                    <h3 className="mb-0">Historial de Accesos</h3>
                                    <p className="opacity-50 small mb-0">Total: {ingresosMeta.total} registros</p>
                                </div>
                                <div className="input-group search-input-group" style={{ maxWidth: '350px' }}>
                                    <span className="input-group-text">
                                        <span className="material-symbols-outlined">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Buscar usuario o lugar..."
                                        value={searchTermIngresos}
                                        onChange={(e) => setSearchTermIngresos(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') fetchIngresos(1); }}
                                    />
                                </div>
                            </div>

                            <div className="row g-2 mb-3 align-items-end">
                                <div className="col-12 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Tipo</label>
                                    <select className="form-select" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                                        <option value="">Todos</option>
                                        <option value="Entrada">Entrada</option>
                                        <option value="Salida">Salida</option>
                                    </select>
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Desde</label>
                                    <input type="date" className="form-control" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Hasta</label>
                                    <input type="date" className="form-control" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-3 d-flex gap-2">
                                    <button className="btn btn-success action-btn flex-grow-1" onClick={() => fetchIngresos(1)}>
                                        <span className="material-symbols-outlined small">filter_alt</span> Filtrar
                                    </button>
                                    <button className="btn btn-outline-success action-btn" onClick={handleExportCSV} title="Exportar CSV">
                                        <span className="material-symbols-outlined small">download</span>
                                    </button>
                                    <button className="btn btn-outline-secondary action-btn" onClick={() => { setSearchTermIngresos(''); setFilterTipo(''); setFilterDesde(''); setFilterHasta(''); fetchIngresos(1); }}>
                                        <span className="material-symbols-outlined small">restart_alt</span>
                                    </button>
                                </div>
                            </div>

                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '50vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Usuario</th>
                                            <th>Fecha y Hora</th>
                                            <th>Ubicación / Punto</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialLoading ? (
                                            <tr><td colSpan="4" className="text-center py-4"><div className="spinner-border text-success" role="status"></div></td></tr>
                                        ) : filteredIngresos.length > 0 ? filteredIngresos.map(ingreso => (
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
                                            <tr><td colSpan="4" className="text-center py-4 opacity-50">No se encontraron registros de ingreso.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {ingresosMeta.last_page > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
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
            case 'equipo_entry':
                return (
                    <EquipmentForm adminMode onSaved={fetchEquipment} />
                );
            case 'historial_equipos':
                const equiposFiltradosPorRol = filteredEquipment.filter(item => {
                    if (!equipoRolFilter) return true;
                    return item.user?.role?.rol_name === equipoRolFilter;
                });
                const sortedEquipos = [...equiposFiltradosPorRol].sort((a, b) => {
                    const dir = equipoSort.dir === 'asc' ? 1 : -1;
                    let va, vb;
                    switch (equipoSort.key) {
                        case 'dueno':
                            va = `${a.user?.user_name || ''} ${a.user?.user_lastname || ''}`.toLowerCase();
                            vb = `${b.user?.user_name || ''} ${b.user?.user_lastname || ''}`.toLowerCase();
                            break;
                        case 'tipo':
                            va = a.equipo_type.toLowerCase();
                            vb = b.equipo_type.toLowerCase();
                            break;
                        case 'estado':
                            va = a.equipo_status.toLowerCase();
                            vb = b.equipo_status.toLowerCase();
                            break;
                        default:
                            va = a.entry_datetime || '';
                            vb = b.entry_datetime || '';
                    }
                    return va < vb ? -dir : va > vb ? dir : 0;
                });
                const sortHeader = (label, key) => (
                    <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setEquipoSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })}>
                        <span className="d-inline-flex align-items-center gap-1">
                            {label}
                            {equipoSort.key === key && (
                                <span className="material-symbols-outlined small" style={{ fontSize: '14px' }}>{equipoSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                            )}
                        </span>
                    </th>
                );
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                                <div className="section-header mb-0">
                                    <h3 className="mb-0">Historial de Equipos</h3>
                                    <p className="opacity-50 small mb-0">Total: {sortedEquipos.length} equipos</p>
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                    <select className="form-select" style={{ maxWidth: '170px' }} value={equipoRolFilter} onChange={(e) => setEquipoRolFilter(e.target.value)}>
                                        <option value="">Todos los roles</option>
                                        <option value="Instructor">Instructores</option>
                                        <option value="Aprendiz">Aprendices</option>
                                    </select>
                                    <div className="input-group search-input-group" style={{ maxWidth: '300px' }}>
                                        <span className="input-group-text">
                                            <span className="material-symbols-outlined">search</span>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar usuario, equipo o serial..."
                                            value={searchTermEquipment}
                                            onChange={(e) => setSearchTermEquipment(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            {sortHeader('Dueño', 'dueno')}
                                            {sortHeader('Tipo', 'tipo')}
                                            <th>Marca/Modelo</th>
                                            <th>Serial</th>
                                            <th>Propiedad</th>
                                            {sortHeader('Estado', 'estado')}
                                            <th>Accesorios</th>
                                            {sortHeader('Ingreso', 'ingreso')}
                                            <th>Devolución</th>
                                            <th>Comprobante</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedEquipos.length > 0 ? sortedEquipos.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Dueño">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 overflow-hidden flex-shrink-0" style={{ width: '34px', height: '34px', fontSize: '0.75rem', fontWeight: 'bold', color: '#000' }}>
                                                            {item.user?.profile_photo_path ? (
                                                                <img src={item.user.profile_photo_path} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <>{item.user?.user_name?.[0]}{item.user?.user_lastname?.[0]}</>
                                                            )}
                                                        </div>
                                                        <div className="d-flex flex-column">
                                                            <span className="fw-bold">{item.user?.user_name} {item.user?.user_lastname}</span>
                                                            <span className="small opacity-50">{item.user?.user_identification || 'S/N'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td data-label="Tipo"><span className="badge badge-soft-primary px-3 py-2">{item.equipo_type}</span></td>
                                                <td data-label="Marca/Modelo">{item.equipo_brand} {item.equipo_model || ''}</td>
                                                <td data-label="Serial"><code style={{ color: '#86efac' }}>{item.equipo_serial}</code></td>
                                                <td data-label="Propiedad">
                                                    <span className={`badge badge-soft-${item.equipo_propiedad === 'Propio' ? 'info' : 'secondary'} px-2 py-1`}>
                                                        {item.equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado'}
                                                    </span>
                                                </td>
                                                <td data-label="Estado">
                                                    <span className={`badge badge-soft-${item.equipo_status === 'Disponible' ? 'success' : 'warning'} px-2 py-1`}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Accesorios" className="small opacity-75">
                                                    {(item.equipo_accesorios || []).map(a => a?.tipo).filter(Boolean).join(', ') || '—'}
                                                </td>
                                                <td data-label="Ingreso" className="small opacity-75">{item.entry_datetime ? new Date(item.entry_datetime).toLocaleString() : '—'}</td>
                                                <td data-label="Devolución" className="small opacity-75">{item.equipo_return_datetime ? <span className="text-success">{new Date(item.equipo_return_datetime).toLocaleString()}</span> : '—'}</td>
                                                <td data-label="Comprobante">
                                                    <button type="button" className="action-btn btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="10" className="text-center py-4 opacity-50">No se encontraron equipos registrados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'directorio':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="section-header d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                                <div>
                                    <h3 className="mb-0">Directorio de Aprendices e Instructores</h3>
                                    <p className="opacity-50 small mb-0">Consulta y filtra el personal del centro</p>
                                </div>
                            </div>

                            <ul className="nav nav-pills mb-4 gap-2">
                                <li className="nav-item">
                                    <button className={`nav-link ${directorioTab === 'instructores' ? 'active' : ''}`} onClick={() => setDirectorioTab('instructores')}>
                                        <span className="material-symbols-outlined small me-1">school</span> Instructores
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button className={`nav-link ${directorioTab === 'aprendices' ? 'active' : ''}`} onClick={() => setDirectorioTab('aprendices')}>
                                        <span className="material-symbols-outlined small me-1">person</span> Aprendices
                                    </button>
                                </li>
                            </ul>

                            {directorioTab === 'instructores' ? (
                                <>
                                    {filteredInstructors.length > 0 ? (
                                        <div className="row g-3">
                                         {filteredInstructors.map(instructor => {
                                              return (
                                                  <div className="col-md-6 col-lg-4" key={instructor.id_usuario}>
                                                      <div className="glass-box-nested p-4 h-100">
                                                         <div className="d-flex align-items-center gap-3 mb-3">
                                                             <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 shadow-sm overflow-hidden" style={{ width: '48px', height: '48px', fontWeight: 'bold', color: '#000', flexShrink: 0 }}>
                                                                 {instructor.profile_photo_path ? (
                                                                     <img src={instructor.profile_photo_path} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                 ) : (
                                                                     <>{instructor.user_name?.[0]}{instructor.user_lastname?.[0]}</>
                                                                 )}
                                                             </div>
                                                             <div>
                                                                 <h5 className="mb-0">{instructor.user_name} {instructor.user_lastname}</h5>
                                                                 <span className="small opacity-50">{instructor.user_email}</span>
                                                             </div>
                                                         </div>
                                                         <div className="mb-1"><span className="material-symbols-outlined small me-1">id_card</span> {instructor.user_identification || 'S/N'}</div>
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 opacity-50">
                                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>school</span>
                                            <p className="mt-2 mb-0">No se encontraron instructores con esos filtros.</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="row g-2 mb-4 align-items-end">
                                        <div className="col-12 col-md-4">
                                            <label className="form-label opacity-75 small mb-1">Qué instructor tuvo</label>
                                            <select className="form-select" value={filtroInstructor} onChange={(e) => setFiltroInstructor(e.target.value)}>
                                                <option value="">Todos</option>
                                                {instructors.map(instructor => (
                                                    <option key={instructor.id_usuario} value={instructor.id_usuario}>
                                                        {instructor.user_name} {instructor.user_lastname}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-12 col-md-4">
                                            <button className="btn btn-outline-secondary action-btn w-100" onClick={() => setFiltroInstructor('')}>
                                                <span className="material-symbols-outlined small">restart_alt</span> Limpiar filtros
                                            </button>
                                        </div>
                                    </div>

                                    {filteredAprendices.length > 0 ? (
                                        <div className="row g-3">
                                             {filteredAprendices.map(aprendiz => {
                                                 const asignacion = aprendizAsignado(aprendiz.id_usuario);
                                                 return (
                                                     <div className="col-md-6 col-lg-4" key={aprendiz.id_usuario}>
                                                         <div className="glass-box-nested p-4 h-100">
                                                            <div className="d-flex align-items-center gap-3 mb-3">
                                                                <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 shadow-sm overflow-hidden" style={{ width: '48px', height: '48px', fontWeight: 'bold', color: '#000', flexShrink: 0 }}>
                                                                    {aprendiz.profile_photo_path ? (
                                                                        <img src={aprendiz.profile_photo_path} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <>{aprendiz.user_name?.[0]}{aprendiz.user_lastname?.[0]}</>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h5 className="mb-0">{aprendiz.user_name} {aprendiz.user_lastname}</h5>
                                                                    <span className="small opacity-50">{aprendiz.user_email}</span>
                                                                </div>
                                                            </div>
                                                            <div className="user-info-item mb-2"><span className="material-symbols-outlined">id_card</span>{aprendiz.user_identification || 'S/N'}</div>
                                                            <div className="user-info-item mb-2"><span className="material-symbols-outlined">groups</span>Ficha: {aprendiz.user_coursenumber}</div>
                                                            <div className="user-info-item mb-3"><span className="material-symbols-outlined">menu_book</span>{aprendiz.user_program}</div>
                                                            {asignacion ? (
                                                                <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                                                                    <div className="d-flex flex-column">
                                                                        <span className="small opacity-50">Instructor asignado</span>
                                                                        <span className="fw-bold">{asignacion.instructor?.user_name} {asignacion.instructor?.user_lastname}</span>
                                                                        {asignacion.jornada && <span className="small opacity-50">{asignacion.jornada}</span>}
                                                                    </div>
                                                                    <button className="btn btn-danger btn-sm action-btn" title="Quitar asignación" onClick={() => handleAsignacionDelete(asignacion.id_asignacion)}>
                                                                        <span className="material-symbols-outlined">link_off</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <p className="small opacity-50 mb-3">Sin instructor asignado.</p>
                                                            )}
                                                            <button className="btn btn-success action-btn w-100" onClick={() => handleAsignarOpen(aprendiz)}>
                                                                <span className="material-symbols-outlined small">person_add</span> {asignacion ? 'Cambiar instructor' : 'Asignar instructor'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 opacity-50">
                                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>person_off</span>
                                            <p className="mt-2 mb-0">No se encontraron aprendices.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );
            case 'profile':
                return (
                    <div className="fade-in-up glass-box p-5 mx-auto" style={{ maxWidth: '600px' }}>
                        <div className="text-center mb-4">
                            <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-3 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2.5rem', fontWeight: 'bold' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                <label className="form-label opacity-50 small mb-1">Ficha</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_coursenumber}
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
                    </div>
                );
            case 'novedad_form':
                return <Novedades currentUser={currentUser} initialMode="form" />;
            case 'novedad_historial':
                return <Novedades currentUser={currentUser} initialMode="history" />;
            case 'sugerencias':
                return <Sugerencias currentUser={currentUser} />;
            default:
                return null;
        }
    };

    const adminLinks = [
        { label: 'DASHBOARD', icon: 'dashboard', view: 'dashboard' },
        { label: 'NOVEDADES', icon: 'report_problem', view: 'novedad_historial' },
        { label: 'HISTORIAL DE ACCESOS', icon: 'history', view: 'historial' },
        {
            label: 'EQUIPOS',
            icon: 'devices',
            view: 'historial_equipos',
            dropdown: true,
            items: [
                { label: 'Nuevo Registro de Equipo', icon: 'add_circle', view: 'equipo_entry' },
                { label: 'Historial de Equipos', icon: 'history', view: 'historial_equipos' }
            ]
        },
        {
            label: 'GESTIÓN DE USUARIOS',
            icon: 'group',
            view: 'users',
            dropdown: true,
            items: [
                { label: 'Instructores', icon: 'school', filter: 'Instructor', view: 'users' },
                { label: 'Aprendices', icon: 'person', filter: 'Aprendiz', view: 'users' },
                { divider: true },
                { label: 'Ver Todos los Usuarios', icon: 'groups', filter: 'all', view: 'users' }
            ]
        }
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

            {asignarAprendiz && (
                <div className="custom-alert-overlay" style={{ position: 'fixed', inset: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.45)', animation: 'fadeIn 0.25s ease-out' }}>
                    <div className="glass-box modal-glass-box p-4 p-md-5 mx-3" style={{ maxWidth: '480px', width: '100%', animation: 'scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
                        <div className="section-header mb-4">
                            <h3 className="mb-0">Asignar instructor a {asignarAprendiz.user_name} {asignarAprendiz.user_lastname}</h3>
                        </div>
                        <form onSubmit={handleAsignarSubmit}>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Instructor</label>
                                <select name="fk_id_instructor" className="form-select" value={asignacionData.fk_id_instructor} onChange={handleAsignacionChange} required>
                                    <option value="">Seleccione un instructor...</option>
                                    {instructors.map(instructor => (
                                        <option key={instructor.id_usuario} value={instructor.id_usuario}>
                                            {instructor.user_name} {instructor.user_lastname}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Jornada (opcional)</label>
                                <select name="jornada" className="form-select" value={asignacionData.jornada} onChange={handleAsignacionChange}>
                                    <option value="">Sin jornada</option>
                                    {JORNADAS.map(j => (
                                        <option key={j} value={j}>{j}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="d-flex gap-2 mt-4">
                                <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                                    <span className="material-symbols-outlined">save</span> Guardar asignación
                                </button>
                                <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={() => setAsignarAprendiz(null)}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default Admin;
