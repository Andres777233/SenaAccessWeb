import React from 'react';

// Perfil compartido por los 4 roles: hero de cuenta, datos en una sola
// tarjeta y el bloque de seguridad que cada panel decide mostrar.
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

    const datos = [
        { icono: 'badge', etiqueta: 'Documento', valor: usuario?.user_identification },
        { icono: 'mail', etiqueta: 'Correo', valor: usuario?.user_email },
        { icono: 'call', etiqueta: 'Teléfono', valor: usuario?.user_telefono },
        ...(esAprendiz || tieneValor(usuario?.user_coursenumber)
            ? [{ icono: 'groups', etiqueta: 'Ficha', valor: usuario?.user_coursenumber }]
            : []),
        ...(tieneValor(usuario?.user_program)
            ? [{ icono: 'school', etiqueta: 'Programa', valor: usuario?.user_program }]
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
        <div className="perfil-sena fade-in-up mx-auto" style={{ maxWidth: '860px' }}>
            <section className="perfil-hero glass-box">
                <div className="perfil-avatar">
                    {usuario?.profile_photo_path ? (
                        <img src={usuario.profile_photo_path} alt="Foto de perfil" loading="lazy" />
                    ) : (
                        <>{iniciales}</>
                    )}
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
            </section>

            {datos.length > 0 && (
                <section className="perfil-datos-card glass-box">
                    <div className="perfil-seccion-cabecera">
                        <h4>Información</h4>
                    </div>
                    <div className="perfil-datos-grid">
                        {datos.map((d) => (
                            <DatoPerfil key={d.etiqueta} icono={d.icono} etiqueta={d.etiqueta} valor={d.valor} />
                        ))}
                    </div>
                </section>
            )}

            {seguridad && <div className="perfil-seguridad">{seguridad}</div>}
        </div>
    );
};

export default PerfilSena;
