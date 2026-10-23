import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { horaBogota, etiquetaDia, esHoyBogota } from '../utils/formato';

// Marcar entrada/salida con el QR de portería (aprendiz, instructor y la
// puerta de entrada). Usa html5-qrcode para que la cámara funcione también en
// Firefox, y deja pegar el código cuando no hay cámara.
const EscanearAcceso = ({ contexto = 'panel', onRegistrado, ocultarCabecera = false }) => {
    const [modo, setModo] = useState('camara');
    const [fase, setFase] = useState('inicio'); // inicio | camara | validando | ok | error
    const [resultado, setResultado] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [errorCamara, setErrorCamara] = useState('');
    const [dia, setDia] = useState(null);
    const [movimientos, setMovimientos] = useState([]);
    const instancia = useRef(null);
    const idRef = useRef(`lector-qr-${Math.random().toString(36).slice(2, 9)}`);

    const cargarEstado = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/acceso/estado');
            setDia(data);
        } catch (_) {
            /* sin conexión se mantiene el estado anterior */
        }
    }, []);

    const cargarMovimientos = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/my-ingresos');
            const lista = Array.isArray(data) ? data : (data.data || []);
            setMovimientos(
                lista
                    .filter((m) => esHoyBogota(m.ingreso_datetime))
                    .sort((a, b) => new Date(b.ingreso_datetime) - new Date(a.ingreso_datetime))
                    .slice(0, 6)
            );
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
        return () => { detenerCamara(); };
    }, [cargarEstado, cargarMovimientos, detenerCamara]);

    const validar = useCallback(async (valor) => {
        const limpio = (valor ?? '').trim();
        if (!limpio) {
            setFase('error');
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
    }, [cargarEstado, cargarMovimientos, onRegistrado]);

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
                () => { /* cuadro sin QR */ }
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

    const reiniciar = () => {
        setResultado(null);
        setFase('inicio');
    };

    const escaneando = fase === 'camara';
    const ocupado = fase === 'validando';
    const entrada = dia?.entrada_hoy;
    const ultimo = dia?.ultimo;

    const tarjetaScanner = (
        <section className="acc-card">
            <div className="acc-head">
                <div>
                    <h3 className="acc-title">{contexto === 'puerta' ? 'Escanea el QR de portería' : 'Marcar entrada / salida'}</h3>
                    <p className="acc-sub">
                        {contexto === 'puerta'
                            ? 'Con la cámara del equipo o pegando el código.'
                            : 'Apunta la cámara al QR que proyecta portería. Si no abre, pega el código.'}
                    </p>
                </div>
            </div>

            <div className="acc-tabs" role="tablist" aria-label="Método para registrar el acceso">
                <button type="button" role="tab" aria-selected={modo === 'camara'} className={`acc-tab ${modo === 'camara' ? 'is-on' : ''}`} onClick={() => { setModo('camara'); reiniciar(); }}>
                    Cámara
                </button>
                <button type="button" role="tab" aria-selected={modo === 'codigo'} className={`acc-tab ${modo === 'codigo' ? 'is-on' : ''}`} onClick={() => { setModo('codigo'); reiniciar(); detenerCamara(); setFase('inicio'); }}>
                    Pegar código
                </button>
            </div>

            {modo === 'camara' ? (
                <>
                    <div className="acc-stage">
                        <div id={idRef.current} style={{ width: '100%', height: '100%' }} />
                        {!escaneando && (
                            <div className="acc-stage-empty">
                                <span className="material-symbols-outlined">qr_code_scanner</span>
                                <strong>Cámara apagada</strong>
                                <span>Apunta al QR que proyecta portería: el registro es automático.</span>
                                <button type="button" className="btn btn-primary-login px-4 py-2 mt-2" onClick={iniciarCamara} disabled={ocupado}>
                                    <span className="material-symbols-outlined small me-1">photo_camera</span>
                                    {ocupado ? 'Validando…' : 'Abrir cámara'}
                                </button>
                            </div>
                        )}
                        {escaneando && (
                            <>
                                <div className="acc-corners" aria-hidden="true"><i /><i /><i /><i /></div>
                                <div className="acc-line" aria-hidden="true" />
                            </>
                        )}
                    </div>

                    {errorCamara && (
                        <div className="acc-alert acc-alert--warn">
                            <span className="material-symbols-outlined">videocam_off</span>
                            <div>{errorCamara}</div>
                        </div>
                    )}

                    {escaneando && (
                        <div className="acc-actions">
                            <button type="button" className="btn btn-outline-success" onClick={detener}>
                                <span className="material-symbols-outlined small me-1">stop_circle</span>
                                Detener cámara
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div>
                        <label className="form-label" htmlFor="acc-codigo">Código del QR</label>
                        <div className="acc-row">
                            <input
                                id="acc-codigo"
                                type="text"
                                className="form-control"
                                placeholder="Pega aquí el contenido del QR"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') validar(codigo); }}
                            />
                            <button type="button" className="btn btn-primary-login px-4" onClick={() => validar(codigo)} disabled={ocupado || !codigo.trim()}>
                                {ocupado ? 'Validando…' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                    <p className="acc-time">El código cambia cada 30 segundos: cópialo justo después de escanearlo.</p>
                </>
            )}

            {fase === 'ok' && resultado && (
                <div className="acc-ok">
                    <div className="acc-ok-mark">
                        <span className="material-symbols-outlined">check</span>
                    </div>
                    <h3>{resultado.message}</h3>
                    <p>{resultado.duplicado ? 'Tu entrada de hoy ya estaba registrada.' : `Registrado a las ${horaBogota(new Date())}.`}</p>
                    <button type="button" className="btn btn-outline-success btn-sm mt-2" onClick={reiniciar}>
                        Registrar otro movimiento
                    </button>
                </div>
            )}

            {(fase === 'error' || (resultado && !resultado.ok)) && (
                <div className="acc-alert acc-alert--err">
                    <span className="material-symbols-outlined">error</span>
                    <div>
                        <strong>No se pudo registrar</strong>
                        {resultado?.message}
                    </div>
                </div>
            )}
        </section>
    );

    if (contexto === 'puerta') {
        return tarjetaScanner;
    }

    return (
        <div className="fade-in-up">
            <div className="acc-grid">
                {tarjetaScanner}

                <section className="acc-card">
                    <div className="acc-head">
                        <div>
                            <h3 className="acc-title">Tu día</h3>
                            <p className="acc-sub">{etiquetaDia()}</p>
                        </div>
                        <span className="acc-tag">{entrada ? 'Dentro' : 'Sin entrada'}</span>
                    </div>

                    <div className={`acc-status ${entrada ? '' : 'acc-status--fuera'}`} style={{ justifyContent: 'flex-start' }}>
                        <span className="material-symbols-outlined" style={{ color: entrada ? 'var(--primary-color)' : '#ffc107' }}>
                            {entrada ? 'login' : 'schedule'}
                        </span>
                        <div style={{ textAlign: 'left' }}>
                            <strong style={{ display: 'block' }}>
                                {entrada ? 'Entrada registrada' : 'Aún sin entrada hoy'}
                            </strong>
                            <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                                {entrada
                                    ? `A la(s) ${horaBogota(dia?.entrada?.fecha)}${dia?.entrada?.lugar ? ` · ${dia.entrada.lugar}` : ''}`
                                    : 'Escanea el QR de portería para abrir tu jornada.'}
                            </span>
                        </div>
                    </div>

                    <div className="acc-metas">
                        <div className="acc-meta">
                            <span>Último movimiento</span>
                            <strong>{ultimo ? ultimo.tipo : '—'}</strong>
                        </div>
                        <div className="acc-meta">
                            <span>Hora</span>
                            <strong>{ultimo?.fecha ? horaBogota(ultimo.fecha) : '—'}</strong>
                        </div>
                    </div>

                    <ol className="acc-steps">
                        <li><b>1</b><span>Muestra o escanea el QR de portería.</span></li>
                        <li><b>2</b><span>Espera el aviso verde de confirmación.</span></li>
                        <li><b>3</b><span>La salida también se registra así al terminar el día.</span></li>
                    </ol>

                    <div>
                        <h4 className="acc-title" style={{ fontSize: '0.92rem' }}>Movimientos de hoy</h4>
                        {movimientos.length === 0 ? (
                            <div className="acc-empty">
                                <span className="material-symbols-outlined">history</span>
                                Todavía no tienes movimientos registrados hoy
                            </div>
                        ) : (
                            <div className="acc-list">
                                {movimientos.map((m) => (
                                    <div className="acc-item" key={m.id_ingreso}>
                                        <span className="acc-tag">{m.ingreso_type}</span>
                                        <div style={{ minWidth: 0 }}>
                                            <div className="acc-item-name">{m.ingreso_place || 'CCyS'}</div>
                                            <div className="acc-item-sub">Registrado por ti</div>
                                        </div>
                                        <div className="acc-item-time">{horaBogota(m.ingreso_datetime)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default EscanearAcceso;
