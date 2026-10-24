import React, { useMemo, useState } from 'react';

// Selector buscable de usuarios. Sustituye los <select multiple> nativos
// (listas interminables) por una lista con avatar, documento y estado.
const SelectorUsuarios = ({
    usuarios = [],
    seleccionados = [],
    onChange,
    placeholder = 'Buscar por nombre, correo o documento…',
    vacio = 'No hay usuarios para mostrar.',
    maxAltura = 260,
}) => {
    const [busqueda, setBusqueda] = useState('');
    const elegidos = useMemo(() => new Set(seleccionados), [seleccionados]);

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return usuarios;
        return usuarios.filter((u) => (
            `${u.user_name || ''} ${u.user_lastname || ''} ${u.user_email || ''} ${u.user_identification || ''}`
                .toLowerCase()
                .includes(q)
        ));
    }, [usuarios, busqueda]);

    const alternar = (id) => {
        if (elegidos.has(id)) onChange(seleccionados.filter((x) => x !== id));
        else onChange([...seleccionados, id]);
    };

    return (
        <div className="selector-usuarios">
            <div className="buscador-sena">
                <span className="material-symbols-outlined">search</span>
                <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                />
                {busqueda && (
                    <button type="button" className="buscador-limpiar" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                )}
            </div>

            <div className="selector-lista" style={{ maxHeight: `${maxAltura}px` }}>
                {filtrados.length === 0 ? (
                    <p className="selector-vacio mb-0">{vacio}</p>
                ) : filtrados.map((u) => {
                    const activo = elegidos.has(u.id_usuario);
                    return (
                        <button
                            key={u.id_usuario}
                            type="button"
                            className={`selector-item ${activo ? 'activo' : ''}`}
                            onClick={() => alternar(u.id_usuario)}
                            aria-pressed={activo}
                        >
                            <span className="selector-avatar">
                                {u.profile_photo_path ? (
                                    <img src={u.profile_photo_path} alt="" loading="lazy" />
                                ) : (
                                    <>{u.user_name?.[0]}{u.user_lastname?.[0]}</>
                                )}
                            </span>
                            <span className="selector-datos">
                                <strong>{u.user_name} {u.user_lastname}</strong>
                                <small>
                                    {u.user_email}
                                    {u.user_identification ? ` · ${u.user_identification}` : ''}
                                </small>
                            </span>
                            <span className="material-symbols-outlined selector-check">
                                {activo ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="selector-resumen">
                <span>{seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}</span>
                {seleccionados.length > 0 && (
                    <button type="button" className="selector-limpiar" onClick={() => onChange([])}>
                        Limpiar
                    </button>
                )}
            </div>
        </div>
    );
};

export default SelectorUsuarios;
