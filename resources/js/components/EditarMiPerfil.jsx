import React, { useState } from 'react';
import axios from 'axios';
import RecorteFoto from './RecorteFoto';
import { showAlert } from './CustomAlert';

// Edición del perfil propio, compartida por los 4 roles. Misma pantalla,
// mismas secciones y misma respuesta del backend (POST /my-profile con _method=PUT).
const EditarMiPerfil = ({ usuario, mostrarFichaPrograma = false, onCancelar, onGuardado }) => {
    const [formData, setFormData] = useState({
        user_identification: usuario?.user_identification || '',
        user_name: usuario?.user_name || '',
        user_lastname: usuario?.user_lastname || '',
        user_email: usuario?.user_email || '',
        user_password: '',
        user_coursenumber: usuario?.user_coursenumber ?? '',
        user_program: usuario?.user_program || '',
        profile_photo_path: usuario?.profile_photo_path || null,
    });
    const [errores, setErrores] = useState({});
    const [fotoBlob, setFotoBlob] = useState(null);
    const [fotoPreview, setFotoPreview] = useState(null);
    const [archivoRecorte, setArchivoRecorte] = useState(null);
    const [codigo2fa, setCodigo2fa] = useState('');
    const [codigoSolicitado, setCodigoSolicitado] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const cambiar = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        if (errores[e.target.name]) {
            setErrores((prev) => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    const guardar = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const data = new FormData();
            data.append('user_identification', formData.user_identification);
            data.append('user_name', formData.user_name);
            data.append('user_lastname', formData.user_lastname);
            data.append('user_email', formData.user_email);
            if (formData.user_password) data.append('user_password', formData.user_password);
            if (mostrarFichaPrograma) {
                data.append('user_coursenumber', formData.user_coursenumber || '');
                data.append('user_program', formData.user_program || '');
            }
            if (codigo2fa) data.append('two_factor_code', codigo2fa);
            if (fotoBlob) data.append('image', fotoBlob, 'foto.jpg');
            data.append('_method', 'PUT');

            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            showAlert('Perfil actualizado con éxito');
            onGuardado(response.data);
        } catch (error) {
            if (error.response?.data?.errors) setErrores(error.response.data.errors);
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitado(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al actualizar perfil: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        } finally {
            setGuardando(false);
        }
    };

    const errorCampo = (name) => (
        errores[name]
            ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{errores[name][0]}</div>
            : null
    );

    return (
        <div className="fade-in-up mx-auto" style={{ maxWidth: '760px' }}>
            <div className="page-cabecera">
                <div>
                    <h3 className="page-titulo mb-1">Editar perfil</h3>
                    <p className="page-subtitulo mb-0">Foto, datos personales y seguridad</p>
                </div>
                <div className="page-acciones">
                    <button type="button" className="btn btn-outline-secondary action-btn" onClick={onCancelar}>
                        <span className="material-symbols-outlined">arrow_back</span> Volver
                    </button>
                </div>
            </div>

            <form onSubmit={guardar}>
                <section className="glass-box p-4" style={{ maxWidth: 'none' }}>
                    <h4 className="perfil-editar-titulo">Foto de perfil</h4>
                    <div className="perfil-foto-editor">
                        <div className="perfil-avatar perfil-avatar--edicion">
                            {fotoPreview ? (
                                <img src={fotoPreview} alt="Nueva foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : formData.profile_photo_path ? (
                                <img src={formData.profile_photo_path} alt="Foto actual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <>{formData.user_name?.[0]}{formData.user_lastname?.[0]}</>
                            )}
                        </div>
                        <div>
                            <label className="btn btn-outline-success btn-sm">
                                <span className="material-symbols-outlined small me-1">photo_camera</span> Cambiar foto
                                <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) setArchivoRecorte(e.target.files[0]);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            <p className="small opacity-50 mb-0 mt-2">Se recorta en círculo y se guarda en tu cuenta.</p>
                            {errorCampo('image')}
                        </div>
                    </div>
                    {archivoRecorte && (
                        <RecorteFoto
                            archivo={archivoRecorte}
                            alCancelar={() => setArchivoRecorte(null)}
                            alConfirmar={(blob) => {
                                setFotoBlob(blob);
                                setFotoPreview(URL.createObjectURL(blob));
                                setArchivoRecorte(null);
                            }}
                        />
                    )}
                </section>

                <section className="glass-box p-4 mt-3" style={{ maxWidth: 'none' }}>
                    <h4 className="perfil-editar-titulo">Datos personales</h4>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label opacity-75 small">N° documento</label>
                            <input type="text" name="user_identification" className={`form-control ${errores.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={cambiar} required />
                            {errorCampo('user_identification')}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label opacity-75 small">Correo institucional</label>
                            <input type="email" name="user_email" className={`form-control ${errores.user_email ? 'is-invalid' : ''}`} value={formData.user_email} onChange={cambiar} required />
                            {errorCampo('user_email')}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label opacity-75 small">Nombre</label>
                            <input type="text" name="user_name" className={`form-control ${errores.user_name ? 'is-invalid' : ''}`} value={formData.user_name} onChange={cambiar} required />
                            {errorCampo('user_name')}
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label opacity-75 small">Apellido</label>
                            <input type="text" name="user_lastname" className={`form-control ${errores.user_lastname ? 'is-invalid' : ''}`} value={formData.user_lastname} onChange={cambiar} required />
                            {errorCampo('user_lastname')}
                        </div>
                        {mostrarFichaPrograma && (
                            <>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label opacity-75 small">Ficha</label>
                                    <input type="number" name="user_coursenumber" className={`form-control ${errores.user_coursenumber ? 'is-invalid' : ''}`} value={formData.user_coursenumber} onChange={cambiar} required />
                                    {errorCampo('user_coursenumber')}
                                </div>
                                <div className="col-md-8 mb-3">
                                    <label className="form-label opacity-75 small">Programa</label>
                                    <input type="text" name="user_program" className={`form-control ${errores.user_program ? 'is-invalid' : ''}`} value={formData.user_program} onChange={cambiar} required />
                                    {errorCampo('user_program')}
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <section className="glass-box p-4 mt-3" style={{ maxWidth: 'none' }}>
                    <h4 className="perfil-editar-titulo">Seguridad</h4>
                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label opacity-75 small">Nueva contraseña (opcional)</label>
                            <input type="password" name="user_password" placeholder="Mínimo 6 caracteres…" className={`form-control ${errores.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={cambiar} />
                            {errorCampo('user_password')}
                            <small className="opacity-50">Si tienes verificación en dos pasos activa, se enviará un código a tu correo.</small>
                        </div>
                        {codigoSolicitado && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label opacity-75 small">Código de 6 dígitos</label>
                                <input type="text" inputMode="numeric" maxLength="6" placeholder="123456" className={`form-control ${errores.two_factor_code ? 'is-invalid' : ''}`} value={codigo2fa} onChange={(e) => setCodigo2fa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                                {errorCampo('two_factor_code')}
                            </div>
                        )}
                    </div>
                </section>

                <div className="perfil-editar-acciones">
                    <button type="submit" className="btn btn-success action-btn" disabled={guardando}>
                        <span className="material-symbols-outlined">save</span> {guardando ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary action-btn" onClick={onCancelar}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditarMiPerfil;
