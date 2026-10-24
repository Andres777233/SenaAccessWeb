import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { horaBogota, etiquetaDia, esHoyBogota } from '../utils/formato';

// Marcar entrada/salida con el QR de portería (aprendiz, instructor y la
// puerta de entrada). Sigue el mismo lenguaje visual que el resto del panel:
// tarjetas de vidrio, botones y badges de siempre.
const EscanearAcceso = ({ contexto = 'panel', onRegistrado, accion = null }) => {
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
        <div className="glass-box p-4 h-100 d-flex flex-column">
            <div className="d-flex align-items-start justify-content-between gap-3 acc-head-accion">
                <div>
                    <h4 className="fw-bold mb-1">{contexto === 'puerta' ? 'Escanea el QR de portería' : 'Escanea el QR de portería'}</h4>
                    <p className="small opacity-75 mb-0">
                        {contexto === 'puerta'
                            ? 'Con la cámara del equipo o pegando el código.'
                            : 'Apunta la cámara al QR que proyecta portería. Si no abre, pega el código.'}
                    </p>
                </div>
                {accion}
            </div>

            <div className="btn-group mt-3 mb-3" role="group" aria-label="Método para registrar el acceso">
                <button type="button" className={`btn ${modo === 'camara' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setModo('camara'); reiniciar(); }}>
                    Cámara
                </button>
                <button type="button" className={`btn ${modo === 'codigo' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setModo('codigo'); reiniciar(); detenerCamara(); setFase('inicio'); }}>
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
                                <p className="fw-bold text-white mb-0">Cámara apagada</p>
                                <p>Apunta al QR que proyecta portería: el registro es automático.</p>
                                <button type="button" className="btn btn-glow mt-2" onClick={iniciarCamara} disabled={ocupado}>
                                    {ocupado ? 'VALIDANDO…' : 'ABRIR CÁMARA'}
                                </button>
                            </div>
                        )}
                    </div>

                    {errorCamara && (
                        <div className="alert alert-warning small mt-3 mb-0 py-2">{errorCamara}</div>
                    )}

                    {escaneando && (
                        <button type="button" className="btn btn-outline-success w-100 mt-3" onClick={detener}>
                            <span className="material-symbols-outlined small align-middle me-1">stop_circle</span>
                            Detener cámara
                        </button>
                    )}
                </>
            ) : (
                <>
                    <label className="form-label" htmlFor="acc-codigo">Código del QR</label>
                    <div className="input-group">
                        <input
                            id="acc-codigo"
                            type="text"
                            className="form-control"
                            placeholder="Pega aquí el contenido del QR"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') validar(codigo); }}
                        />
                        <button type="button" className="btn btn-success fw-bold px-3" onClick={() => validar(codigo)} disabled={ocupado || !codigo.trim()}>
                            {ocupado ? 'VALIDANDO…' : 'REGISTRAR'}
                        </button>
                    </div>
                    <p className="small opacity-50 mt-2 mb-0">El código cambia cada 30 segundos: cópialo justo después de escanearlo.</p>
                </>
            )}

            {fase === 'ok' && resultado && (
                <div className="alert alert-success mt-3 mb-0">
                    <div className="d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span>
                        <div>
                            <div className="fw-bold">{resultado.message}</div>
                            <div className="small">
                                {resultado.duplicado ? 'Tu entrada de hoy ya estaba registrada.' : `Registrado a las ${horaBogota(new Date())}.`}
                            </div>
                        </div>
                    </div>
                    <button type="button" className="btn btn-outline-success btn-sm mt-2" onClick={reiniciar}>
                        Registrar otro movimiento
                    </button>
                </div>
            )}

            {(fase === 'error' || (resultado && !resultado.ok)) && (
                <div className="alert alert-danger mt-3 mb-0 small">
                    <span className="material-symbols-outlined small align-middle me-1">error</span>
                    {resultado?.message}
                </div>
            )}
        </div>
    );

    if (contexto === 'puerta') {
        return tarjetaScanner;
    }

    return (
        <div className="fade-in-up">
            <div className="acc-view">
                <div className="section-header">
                    <h3 className="mb-0">Salida QR</h3>
                    <p className="small opacity-75 mb-0">Registra tu entrada o salida con el QR de portería. Queda en tu historial al instante.</p>
                </div>

                <div className="row g-4">
                    <div className="col-12 col-lg-7">{tarjetaScanner}</div>

                    <div className="col-12 col-lg-5">
                        <div className="glass-box p-4 mb-4">
                            <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                                <div>
                                    <h4 className="fw-bold mb-0">Tu día</h4>
                                    <p className="small opacity-75 mb-0">{etiquetaDia()}</p>
                                </div>
                                <span className={`badge border ${entrada ? 'bg-success bg-opacity-25 text-success border-success border-opacity-50' : 'bg-secondary bg-opacity-25 text-light border-secondary border-opacity-50'}`}>
                                    {entrada ? 'DENTRO' : 'SIN ENTRADA'}
                                </span>
                            </div>

                            <div className={`acc-dia mb-3 ${entrada ? '' : 'acc-dia--fuera'}`}>
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

                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10 h-100">
                                        <span className="form-label d-block mb-1 opacity-50">ÚLTIMO MOVIMIENTO</span>
                                        <div className="fw-bold">{ultimo ? ultimo.tipo : '—'}</div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10 h-100">
                                        <span className="form-label d-block mb-1 opacity-50">HORA</span>
                                        <div className="fw-bold">{ultimo?.fecha ? horaBogota(ultimo.fecha) : '—'}</div>
                                    </div>
                                </div>
                            </div>

                            <ul className="list-unstyled small opacity-75 mb-0">
                                <li className="d-flex gap-2 mb-1">
                                    <span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span>
                                    Muestra o escanea el QR de portería.
                                </li>
                                <li className="d-flex gap-2 mb-1">
                                    <span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span>
                                    Espera el aviso verde de confirmación.
                                </li>
                                <li className="d-flex gap-2">
                                    <span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span>
                                    La salida también se registra así al terminar el día.
                                </li>
                            </ul>
                        </div>

                        <div className="glass-box p-4">
                            <h4 className="fw-bold mb-1">Movimientos de hoy</h4>
                            <p className="small opacity-75 mb-3">Lo que ya quedó en tu historial</p>

                            {movimientos.length === 0 ? (
                                <p className="text-center small opacity-50 py-3 mb-0">Todavía no tienes movimientos registrados hoy</p>
                            ) : movimientos.map((m) => (
                                <div className="acc-fila" key={m.id_ingreso}>
                                    <span className={`badge border ${m.ingreso_type === 'Entrada' ? 'bg-success bg-opacity-25 text-success border-success border-opacity-50' : 'bg-warning bg-opacity-25 text-warning border-warning border-opacity-50'}`}>
                                        {m.ingreso_type}
                                    </span>
                                    <div>
                                        <strong>{m.ingreso_place || 'CCyS'}</strong>
                                        <br />
                                        <small>Registrado por ti</small>
                                    </div>
                                    <span className="acc-fila-hora">{horaBogota(m.ingreso_datetime)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EscanearAcceso;
