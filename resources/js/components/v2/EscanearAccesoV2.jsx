import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { horaBogota, etiquetaDia, esHoyBogota } from '../../utils/formato';

// Escáner del tema nuevo. Usa html5-qrcode (funciona en Firefox, Chrome, Edge
// y Safari) en lugar de BarcodeDetector, que solo existe en navegadores
// Chromium. Registra Entrada o Salida contra el QR de portería.
const EscanearAccesoV2 = ({ contexto = 'panel', onRegistrado }) => {
    const [modo, setModo] = useState('camara');
    const [fase, setFase] = useState('inicio'); // inicio | camara | validando | ok | error
    const [resultado, setResultado] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [errorCamara, setErrorCamara] = useState('');
    const [dia, setDia] = useState(null);
    const [movimientos, setMovimientos] = useState([]);
    const instancia = useRef(null);
    const idRef = useRef(`v2-lector-${Math.random().toString(36).slice(2, 9)}`);

    const cargarEstado = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/acceso/estado');
            setDia(data);
        } catch (_) {
            /* la tarjeta se queda con el estado anterior */
        }
    }, []);

    // Movimientos del día: llena la pantalla con información útil después de
    // marcar y evita el bloque vacío debajo de las tarjetas.
    const cargarMovimientos = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/my-ingresos');
            const lista = Array.isArray(data) ? data : (data.data || []);
            const hoy = lista
                .filter((m) => esHoyBogota(m.ingreso_datetime))
                .sort((a, b) => new Date(b.ingreso_datetime) - new Date(a.ingreso_datetime))
                .slice(0, 6);
            setMovimientos(hoy);
        } catch (_) {
            /* sin historial disponible */
        }
    }, []);

    const detenerCamara = useCallback(async () => {
        const inst = instancia.current;
        instancia.current = null;
        if (!inst) return;
        try {
            if (inst.isScanning) await inst.stop();
            inst.clear();
        } catch (_) {
            /* ya estaba detenida */
        }
    }, []);

    useEffect(() => {
        cargarEstado();
        cargarMovimientos();
        return () => {
            detenerCamara();
        };
    }, [cargarEstado, cargarMovimientos, detenerCamara]);

    const validar = useCallback(async (valor) => {
        const limpio = (valor ?? '').trim();
        if (!limpio) {
            setFase('inicio');
            setResultado({ ok: false, message: 'Pega el código del QR para continuar.' });
            return;
        }
        setFase('validando');
        setResultado(null);
        try {
            const { data } = await axios.post('/api/acceso/validar', { qr_payload: limpio });
            setResultado({ ok: true, message: data.message, duplicado: !!data.duplicado });
            setFase('ok');
            setCodigo('');
            cargarEstado();
            cargarMovimientos();
            if (onRegistrado) onRegistrado(data);
        } catch (e) {
            setResultado({ ok: false, message: e.response?.data?.message || 'No se pudo registrar. Intenta de nuevo.' });
            setFase('error');
        }
    }, [cargarEstado, onRegistrado]);

    const iniciarCamara = async () => {
        setErrorCamara('');
        setResultado(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            setErrorCamara('Este navegador no permite abrir la cámara. Usa el código manual.');
            setModo('codigo');
            return;
        }
        setFase('camara');
        try {
            const inst = new Html5Qrcode(idRef.current);
            instancia.current = inst;
            await inst.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 230, height: 230 } },
                async (texto) => {
                    await detenerCamara();
                    validar(texto);
                },
                () => { /* cuadro sin QR: se ignora */ }
            );
        } catch (e) {
            instancia.current = null;
            setFase('inicio');
            const nombre = e?.name || '';
            if (nombre === 'NotAllowedError' || String(e).includes('Permission')) {
                setErrorCamara('Permiso de cámara denegado. Habilítalo en el navegador o usa el código manual.');
            } else if (nombre === 'NotFoundError') {
                setErrorCamara('No encontramos una cámara en este equipo. Usa el código manual.');
            } else {
                setErrorCamara('No se pudo abrir la cámara. Revisa los permisos o usa el código manual.');
            }
        }
    };

    const detener = async () => {
        await detenerCamara();
        setFase('inicio');
    };

    const reintentar = () => {
        setResultado(null);
        setFase('inicio');
    };

    const escaneando = fase === 'camara';
    const ocupado = fase === 'validando';
    const entrada = dia?.entrada_hoy;
    const ultimo = dia?.ultimo;

    const tarjetaScanner = (
        <section className="v2-access-card">
            <div>
                <h2>{contexto === 'puerta' ? 'Escanea el QR de portería' : 'Escanear QR de portería'}</h2>
                <p className="v2-access-sub">Apunta la cámara al QR que proyecta portería. Si no abre, pega el código.</p>
            </div>

            <div className="v2-segmented" role="tablist" aria-label="Método para registrar el acceso">
                <button type="button" role="tab" aria-selected={modo === 'camara'} className={modo === 'camara' ? 'is-on' : ''} onClick={() => { setModo('camara'); reintentar(); }}>
                    Cámara
                </button>
                <button type="button" role="tab" aria-selected={modo === 'codigo'} className={modo === 'codigo' ? 'is-on' : ''} onClick={() => { setModo('codigo'); reintentar(); detenerCamara(); setFase('inicio'); }}>
                    Pegar código
                </button>
            </div>

            {modo === 'camara' ? (
                <>
                    <div className="v2-scanner">
                        <div id={idRef.current} style={{ width: '100%', height: '100%' }} />
                        {!escaneando && (
                            <div className="v2-scanner-empty" style={{ position: 'absolute', inset: 0, justifyContent: 'center' }}>
                                <span className="material-symbols-outlined">qr_code_scanner</span>
                                <strong>Cámara apagada</strong>
                                <span>Apunta al QR que proyecta portería y el registro es automático.</span>
                                <button type="button" className="v2-btn v2-btn--primary" onClick={iniciarCamara} disabled={ocupado}>
                                    <span className="material-symbols-outlined">photo_camera</span>
                                    {ocupado ? 'Validando…' : 'Abrir cámara'}
                                </button>
                            </div>
                        )}
                        {escaneando && (
                            <>
                                <div className="v2-frame" aria-hidden="true"><i /><i /><i /><i /></div>
                                <div className="v2-scanline" aria-hidden="true" />
                            </>
                        )}
                    </div>

                    {errorCamara && (
                        <div className="v2-alert v2-alert--warn">
                            <span className="material-symbols-outlined">videocam_off</span>
                            <div>{errorCamara}</div>
                        </div>
                    )}

                    {escaneando && (
                        <div className="v2-actions-row">
                            <button type="button" className="v2-btn v2-btn--ghost" onClick={detener}>
                                <span className="material-symbols-outlined">stop_circle</span>
                                Detener cámara
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div>
                        <label className="form-label" htmlFor="v2-codigo">Código del QR</label>
                        <div className="v2-input-row">
                            <input
                                id="v2-codigo"
                                type="text"
                                className="form-control"
                                placeholder="Pega aquí el contenido del QR"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') validar(codigo); }}
                            />
                            <button type="button" className="v2-btn v2-btn--primary" onClick={() => validar(codigo)} disabled={ocupado || !codigo.trim()}>
                                {ocupado ? 'Validando…' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                    <p className="v2-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                        El código cambia cada 30 segundos: cópialo justo después de escanearlo.
                    </p>
                </>
            )}

            {fase === 'ok' && resultado && (
                <div className="v2-success">
                    <div className="v2-success-mark">
                        <span className="material-symbols-outlined">check</span>
                    </div>
                    <h3>{resultado.message}</h3>
                    <p>{resultado.duplicado ? 'Tu entrada de hoy ya estaba registrada.' : `Registrado a las ${horaBogota(new Date())}.`}</p>
                    <button type="button" className="v2-btn v2-btn--ghost v2-btn--sm" onClick={reintentar}>
                        Registrar otro movimiento
                    </button>
                </div>
            )}

            {(fase === 'error' || (resultado && !resultado.ok)) && (
                <div className="v2-alert v2-alert--err">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <strong>No se pudo registrar</strong>
                        {resultado?.message}
                    </div>
                </div>
            )}
        </section>
    );

    const tarjetaEstado = (
        <section className="v2-access-card v2-access-card--estado">
            <div>
                <h2>Tu día</h2>
                <p className="v2-access-sub">{etiquetaDia(new Date())}</p>
            </div>

            <div className={`v2-day-status ${entrada ? 'is-in' : 'is-out'}`}>
                <span className="material-symbols-outlined">{entrada ? 'login' : 'schedule'}</span>
                <div>
                    <strong>{entrada ? 'Entrada registrada' : 'Aún sin entrada hoy'}</strong>
                    <span>
                        {entrada
                            ? `A la(s) ${horaBogota(dia?.entrada?.fecha)}${dia?.entrada?.lugar ? ` · ${dia.entrada.lugar}` : ''}`
                            : 'Escanea el QR de portería para abrir tu jornada.'}
                    </span>
                </div>
            </div>

            <div className="v2-day-meta">
                <div className="v2-meta">
                    <span className="v2-meta-label">Último movimiento</span>
                    <span className="v2-meta-value">{ultimo ? ultimo.tipo : '—'}</span>
                </div>
                <div className="v2-meta">
                    <span className="v2-meta-label">Hora</span>
                    <span className="v2-meta-value">{ultimo?.fecha ? horaBogota(ultimo.fecha) : '—'}</span>
                </div>
            </div>

            <ol className="v2-steps">
                <li><b>1</b><span>Muestra o escanea el QR de portería.</span></li>
                <li><b>2</b><span>Espera el aviso verde de confirmación.</span></li>
                <li><b>3</b><span>La salida también se registra así al terminar el día.</span></li>
            </ol>
        </section>
    );

    if (contexto === 'puerta') {
        return tarjetaScanner;
    }

    return (
        <div className="v2-canvas">
            <div className="v2-pagehead">
                <div>
                    <h1>Marcar acceso</h1>
                    <p>Registra tu entrada o salida con el QR de portería. Queda en tu historial al instante.</p>
                </div>
            </div>
            <div className="v2-access">
                {tarjetaScanner}
                {tarjetaEstado}
            </div>

            <section className="v2-panel">
                <div className="v2-panel-head">
                    <div>
                        <h2 className="v2-panel-title">Movimientos de hoy</h2>
                        <p className="v2-panel-sub">Entradas y salidas que ya quedaron en tu historial</p>
                    </div>
                    <span className="v2-tag">{movimientos.length} hoy</span>
                </div>

                {movimientos.length === 0 ? (
                    <div className="v2-empty">
                        <span className="material-symbols-outlined">history</span>
                        Todavía no tienes movimientos registrados hoy
                    </div>
                ) : (
                    <div className="v2-list">
                        {movimientos.map((m) => (
                            <div className="v2-row" key={m.id_ingreso}>
                                <span className={`v2-tag ${m.ingreso_type === 'Entrada' ? 'v2-tag--in' : 'v2-tag--out'}`}>
                                    {m.ingreso_type}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <div className="v2-row-name">{m.ingreso_place || 'CCyS'}</div>
                                    <div className="v2-row-sub">Registrado por ti</div>
                                </div>
                                <div className="v2-row-right">
                                    <div className="v2-row-time">{horaBogota(m.ingreso_datetime)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default EscanearAccesoV2;
