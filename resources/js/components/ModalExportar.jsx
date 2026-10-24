import React from 'react';

// Modal compartido de exportación: formato + descarga. El padre decide la
// ruta y le pasa el formato elegido; aquí solo se elige y se confirma.
const ETIQUETAS = { pdf: 'PDF', xlsx: 'Excel', docx: 'Word' };
const ICONOS = { pdf: 'picture_as_pdf', xlsx: 'table_view', docx: 'description' };

const ModalExportar = ({
    abierto,
    titulo = 'Exportar',
    detalle = 'Elige el formato del archivo.',
    formatos = ['pdf'],
    formato,
    onFormato,
    onCerrar,
    onExportar,
    exportando = false,
}) => {
    if (!abierto) return null;

    return (
        <>
            <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" onClick={onCerrar}>
                <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content glass-box modal-glass-box" style={{ maxWidth: '480px' }}>
                        <div className="modal-header border-0 pb-0">
                            <h5 className="modal-title fw-bold">{titulo}</h5>
                            <button type="button" className="btn-close" onClick={onCerrar} aria-label="Cerrar"></button>
                        </div>
                        <div className="modal-body">
                            <p className="small opacity-75">{detalle}</p>
                            <div className="d-grid gap-2">
                                {formatos.map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        className={`btn ${formato === f ? 'btn-success' : 'btn-outline-success'} action-btn d-flex align-items-center gap-2`}
                                        onClick={() => onFormato(f)}
                                    >
                                        <span className="material-symbols-outlined">{ICONOS[f] || 'download'}</span>
                                        {ETIQUETAS[f] || f.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer border-0 pt-0 d-flex gap-2">
                            <button type="button" className="btn btn-outline-secondary action-btn flex-grow-1" onClick={onCerrar}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn-success action-btn flex-grow-1" onClick={onExportar} disabled={exportando}>
                                {exportando ? 'Generando…' : 'Descargar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </>
    );
};

export default ModalExportar;
