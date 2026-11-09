import React from 'react';

// Perfil compartido por los 4 roles: portada de cuenta, datos en fichas y el
// bloque de seguridad que cada panel decide mostrar. Solo cambia la vista:
// los datos y las acciones son los mismos de siempre.
const tieneValor = (valor) => {
    if (valor === null || valor === undefined) return false;
    const texto = String(valor).trim();
    return texto !== '' && texto !== '0' && texto !== '—';
};

const DatoPerfil = ({ icono, etiqueta, valor }) => (
    <div className="perfil-dato">
        <span className="material-symbols-outlined">{icono}</span>
        <div className="perfil-dato-texto">
            <small>{etiqueta}</small>
            <strong>{valor}</strong>
        </div>
    </div>
);

const PerfilSena = ({ usuario, rol, onEditar, seguridad = null }) => {
    const nombre = `${usuario?.user_name || ''} ${usuario?.user_lastname || ''}`.trim() || 'Usuario';
    const iniciales = `${usuario?.user_name?.[0] || ''}${usuario?.user_lastname?.[0] || ''}`;
    const esAprendiz = (rol || '').toLowerCase() === 'aprendiz';
    // El funcionario no cursa ficha: su user_program es el área/dependencia.
    const esFuncionario = (rol || '').toLowerCase() === 'funcionario';

    const datos = [
        { icono: 'badge', etiqueta: 'Documento', valor: usuario?.user_identification },
        { icono: 'mail', etiqueta: 'Correo', valor: usuario?.user_email },
        { icono: 'call', etiqueta: 'Teléfono', valor: usuario?.user_telefono },
        ...(esAprendiz || tieneValor(usuario?.user_coursenumber)
            ? [{ icono: 'groups', etiqueta: 'Ficha', valor: usuario?.user_coursenumber }]
            : []),
        ...(tieneValor(usuario?.user_program)
            ? [{ icono: 'school', etiqueta: esFuncionario ? 'Área / Dependencia' : 'Programa', valor: usuario?.user_program }]
            : []),
        ...(tieneValor(usuario?.user_jornada)
            ? [{
                icono: 'schedule',
                etiqueta: 'Jornada',
                valor: `${usuario.user_jornada}${tieneValor(usuario.user_jornada_sabado) ? ` · Sábado: ${usuario.user_jornada_sabado}` : ''}`,
            }]
            : []),
    ].filter((d) => tieneValor(d.valor));

    return (
        <div className="perfil-sena fade-in-up mx-auto">
            <section className="perfil-hero">
                <div className="perfil-portada" aria-hidden="true">
                    <span className="perfil-portada-marca">SENA ACCESS</span>
                    <span className="perfil-portada-estado">
                        <i /> Cuenta activa
                    </span>
                </div>

                <div className="perfil-hero-cuerpo">
                    <div className="perfil-avatar-marco">
                        <div className="perfil-avatar">
                            {usuario?.profile_photo_path ? (
                                <img src={usuario.profile_photo_path} alt="Foto de perfil" loading="lazy" />
                            ) : (
                                <>{iniciales}</>
                            )}
                        </div>
                    </div>

                    <div className="perfil-hero-info">
                        <span className="perfil-rol">{rol || 'Usuario'}</span>
                        <h3>{nombre}</h3>
                        <p>{usuario?.user_email || 'Sin correo registrado'}</p>
                        <div className="perfil-hero-acciones">
                            <button type="button" className="btn btn-success action-btn" onClick={onEditar}>
                                <span className="material-symbols-outlined">edit</span> Editar perfil
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {datos.length > 0 && (
                <section className="perfil-panel">
                    <div className="perfil-panel-cabecera">
                        <span className="material-symbols-outlined">person</span>
                        <h4>Información personal</h4>
                        <span className="perfil-panel-conteo">{datos.length} datos</span>
                    </div>
                    <div className="perfil-datos-grid">
                        {datos.map((d) => (
                            <DatoPerfil key={d.etiqueta} icono={d.icono} etiqueta={d.etiqueta} valor={d.valor} />
                        ))}
                    </div>
                </section>
            )}

            {seguridad && (
                <section className="perfil-panel perfil-panel--seguridad">
                    <div className="perfil-panel-cabecera">
                        <span className="material-symbols-outlined">shield</span>
                        <h4>Seguridad de la cuenta</h4>
                    </div>
                    <div className="perfil-seguridad">{seguridad}</div>
                </section>
            )}
        </div>
    );
};

export default PerfilSena;
