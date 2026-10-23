import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { horaBogota, inicialesDe } from '../utils/formato';

// Validación de accesos en portería: un solo escáner resuelve el carnet del
// usuario, el código/PIN generado en la web y el QR de invitado. Al escanear
// un carnet se registra la Entrada del dueño, así la persona que está en la
// web pasa sola a su panel.
const QrInvitado = () => {
    const [modo, setModo] = useState('camara');
    const [fase, setFase] = useState('inicio'); // inicio | camara | validando | listo
    const [texto, setTexto] = useState('');
    const [resultado, setResultado] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [errorCamara, setErrorCamara] = useState('');
    const instancia = useRef(null);
    const idRef = useRef(`lector-porteria-${Math.random().toString(36).slice(2, 9)}`);

    const detenerCamara = useCallback(async () => {
        const inst = instancia.current;
        instancia.current = null;
        if (!inst) return;
        try {
            if (inst.isScanning) await inst.stop();
            inst.clear();
        } catch (_) { /* ya estaba detenida */ }
    }, []);

    useEffect(() => () => { detenerCamara(); }, [detenerCamara]);

    const normalizar = (data) => {
        if (data?.usuario) return data.usuario;
        if (data?.user) {
            const u = data.user;
            return {
                nombre: `${u.user_name || ''} ${u.user_lastname || ''}`.trim() || 'Invitado',
                identificacion: u.user_identification,
                rol: u.role?.rol_name || 'Invitado',
                foto: u.profile_photo_path,
            };
        }
        return null;
    };

    const validar = async (valor) => {
        const limpio = (valor ?? '').trim();
        if (!limpio) return;
        setFase('validando');
        setResultado(null);

        const esJson = limpio.startsWith('{');
        const esCodigo = limpio.startsWith('SENA-ACCESO:');
        const esPin = /^\d{6}$/.test(limpio);
        const pareceDocumento = /^\d{7,15}$/.test(limpio);
        const pedir = async (url, cuerpo) => (await axios.post(url, cuerpo)).data;

        try {
            let data;
            let canal;

            if (esJson || pareceDocumento) {
                canal = 'carnet';
                data = await pedir('/api/acceso/carnet', { carnet: limpio });
            } else if (esCodigo) {
                canal = 'codigo';
                data = await pedir('/api/acceso/validar-codigo', { codigo: limpio });
            } else if (esPin) {
                canal = 'pin';
                try {
                    data = await pedir('/api/acceso/validar-codigo', { pin: limpio });
                } catch (e) {
                    // Un documento de 6 dígitos también es válido: segundo intento.
                    if (e.response?.status === 422 || e.response?.status === 404) {
                        data = await pedir('/api/acceso/carnet', { carnet: limpio });
                        canal = 'carnet';
                    } else {
                        throw e;
                    }
                }
            } else {
                canal = 'invitado';
                data = await pedir('/api/validate-guest-qr', { qr_token: limpio });
            }

            const persona = normalizar(data);
            const registro = {
                ok: true,
                mensaje: data.message || 'Acceso validado.',
                persona,
                canal,
                hora: horaBogota(new Date()),
                duplicado: !!data.duplicado,
            };
            setResultado(registro);
            setHistorial((prev) => [registro, ...prev].slice(0, 8));
            setTexto('');
            setFase('listo');
        } catch (e) {
            const registro = {
                ok: false,
                mensaje: e.response?.data?.message || 'No se pudo validar el código. Intenta de nuevo.',
                persona: null,
                canal: 'desconocido',
                hora: horaBogota(new Date()),
            };
            setResultado(registro);
            setHistorial((prev) => [registro, ...prev].slice(0, 8));
            setFase('listo');
        }
    };

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
                async (lectura) => {
                    await detenerCamara();
                    validar(lectura);
                },
                () => { /* cuadro sin QR */ }
            );
        } catch (e) {
            instancia.current = null;
            setFase('inicio');
            const nombre = e?.name || '';
            setErrorCamara(
                nombre === 'NotAllowedError'
                    ? 'Permiso de cámara denegado. Habilítalo en el navegador o usa el código manual.'
                    : nombre === 'NotFoundError'
                        ? 'No encontramos una cámara en este equipo. Usa el código manual.'
                        : 'No se pudo abrir la cámara. Revisa los permisos o usa el código manual.'
            );
        }
    };

    const detener = async () => {
        await detenerCamara();
        setFase('inicio');
    };

    const escaneando = fase === 'camara';
    const ocupado = fase === 'validando';
    const validos = historial.filter((h) => h.ok).length;
    const rechazados = historial.length - validos;

    return (
        <div className="fade-in-up">
            <div className="acc-grid">
                <section className="acc-card">
                    <div className="acc-head">
                        <div>
                            <h3 className="acc-title">Validar acceso</h3>
                            <p className="acc-sub">Carnet del usuario, código de la web y QR de invitado.</p>
                        </div>
                        <span className="acc-tag">{validos} válidos hoy</span>
                    </div>

                    <div className="acc-tabs" role="tablist" aria-label="Método de validación">
                        <button type="button" role="tab" aria-selected={modo === 'camara'} className={`acc-tab ${modo === 'camara' ? 'is-on' : ''}`} onClick={() => { setModo('camara'); setFase('inicio'); setResultado(null); detenerCamara(); }}>
                            Cámara
                        </button>
                        <button type="button" role="tab" aria-selected={modo === 'codigo'} className={`acc-tab ${modo === 'codigo' ? 'is-on' : ''}`} onClick={() => { setModo('codigo'); setFase('inicio'); setResultado(null); detenerCamara(); }}>
                            Código o PIN
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
                                        <span>Apunta al carnet, al código de la web o al QR del invitado.</span>
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
                                <label className="form-label" htmlFor="acc-porteria">Código, PIN o documento</label>
                                <div className="acc-row">
                                    <input
                                        id="acc-porteria"
                                        type="text"
                                        className="form-control"
                                        placeholder="PIN de 6 dígitos, documento o código del QR"
                                        value={texto}
                                        onChange={(e) => setTexto(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') validar(texto); }}
                                    />
                                    <button type="button" className="btn btn-primary-login px-4" onClick={() => validar(texto)} disabled={ocupado || !texto.trim()}>
                                        {ocupado ? 'Validando…' : 'Validar'}
                                    </button>
                                </div>
                            </div>
                            <p className="acc-time">Detectamos el tipo solo: PIN de 6 dígitos, documento del carnet o código del invitado.</p>
                        </>
                    )}

                    {fase === 'listo' && resultado && (
                        <div className={`acc-alert ${resultado.ok ? 'acc-alert--ok' : 'acc-alert--err'}`}>
                            <span className="material-symbols-outlined">{resultado.ok ? 'check_circle' : 'error'}</span>
                            <div style={{ flex: 1 }}>
                                <strong>{resultado.ok ? (resultado.duplicado ? 'Acceso repetido' : 'Acceso registrado') : 'No se pudo validar'}</strong>
                                {resultado.mensaje}
                            </div>
                        </div>
                    )}
                </section>

                <section className="acc-card">
                    <div className="acc-head">
                        <div>
                            <h3 className="acc-title">Persona</h3>
                            <p className="acc-sub">La última validación de esta sesión.</p>
                        </div>
                    </div>

                    <div className="acc-metas">
                        <div className="acc-meta">
                            <span>Válidos</span>
                            <strong>{validos}</strong>
                        </div>
                        <div className="acc-meta">
                            <span>Rechazados</span>
                            <strong>{rechazados}</strong>
                        </div>
                    </div>

                    {resultado?.persona ? (
                        <div className="acc-persona">
                            <div className="acc-avatar">
                                {resultado.persona.foto
                                    ? <img src={resultado.persona.foto} alt="" />
                                    : inicialesDe(resultado.persona.nombre?.split(' ')[0], resultado.persona.nombre?.split(' ')[1])}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <span className="acc-persona-name">{resultado.persona.nombre}</span>
                                <span className="acc-persona-sub">
                                    {resultado.persona.identificacion || 'Sin documento'} · {resultado.persona.rol || 'Usuario'}
                                </span>
                            </div>
                            <span className="acc-item-time">{resultado.hora}</span>
                        </div>
                    ) : (
                        <div className="acc-empty">
                            <span className="material-symbols-outlined">badge</span>
                            Sin validaciones todavía
                        </div>
                    )}

                    <div>
                        <h4 className="acc-title" style={{ fontSize: '0.92rem' }}>Validados ahora</h4>
                        {historial.length === 0 ? (
                            <div className="acc-empty">
                                <span className="material-symbols-outlined">history</span>
                                Nada por aquí todavía
                            </div>
                        ) : (
                            <div className="acc-list">
                                {historial.map((h, i) => (
                                    <div className="acc-item" key={`${h.hora}-${i}`}>
                                        <div className="acc-avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                                            {h.ok ? (h.persona ? inicialesDe(h.persona.nombre?.split(' ')[0], h.persona.nombre?.split(' ')[1]) : 'OK') : '!'}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div className="acc-item-name">{h.persona?.nombre || (h.ok ? 'Acceso' : 'Código rechazado')}</div>
                                            <div className="acc-item-sub">
                                                {h.ok
                                                    ? (h.canal === 'carnet' ? 'Carnet' : h.canal === 'invitado' ? 'Invitado' : 'Código / PIN')
                                                    : h.mensaje}
                                            </div>
                                        </div>
                                        <div className="acc-item-time">{h.hora}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="acc-card mt-3">
                <div className="acc-head">
                    <div>
                        <h3 className="acc-title">Cómo validar</h3>
                        <p className="acc-sub">Un solo escáner reconoce todo lo que llega a portería.</p>
                    </div>
                </div>
                <ol className="acc-steps">
                    <li><b>1</b><span><strong>Carnet digital:</strong> escanea el QR del usuario y queda su Entrada registrada al instante.</span></li>
                    <li><b>2</b><span><strong>Código de la web:</strong> el usuario genera un QR o PIN en la puerta y tú lo validas aquí.</span></li>
                    <li><b>3</b><span><strong>Invitado:</strong> el QR del invitado se consume una sola vez y caduca a la hora.</span></li>
                </ol>
            </div>
        </div>
    );
};

export default QrInvitado;
