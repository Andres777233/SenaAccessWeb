import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { horaBogota, inicialesDe } from '../../utils/formato';

// Validación de accesos en portería (tema nuevo). Un solo escáner resuelve
// todo lo que llega: carnet del usuario, código/PIN generado en la web y QR
// de invitado. Al escanear un carnet se registra la Entrada del dueño, así la
// persona que está en la web pasa sola a su panel.
const QrInvitadoV2 = () => {
    const [modo, setModo] = useState('camara');
    const [fase, setFase] = useState('inicio'); // inicio | camara | validando | listo
    const [texto, setTexto] = useState('');
    const [resultado, setResultado] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [errorCamara, setErrorCamara] = useState('');
    const instancia = useRef(null);
    const idRef = useRef(`v2-porteria-${Math.random().toString(36).slice(2, 9)}`);

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

    const registrar = (entrada) => {
        setHistorial((prev) => [entrada, ...prev].slice(0, 8));
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
            registrar(registro);
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
            registrar(registro);
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

    return (
        <div className="v2-canvas">
            <div className="v2-pagehead">
                <div>
                    <h1>Validar acceso</h1>
                    <p>Un escáner para el carnet del usuario, el código de la web y el QR de invitado.</p>
                </div>
                <div className="v2-pagehead-actions">
                    <span className="v2-tag">{historial.filter((h) => h.ok).length} válidos en esta sesión</span>
                </div>
            </div>

            <div className="v2-access">
                <section className="v2-access-card">
                    <div className="v2-segmented" role="tablist" aria-label="Método de validación">
                        <button type="button" role="tab" aria-selected={modo === 'camara'} className={modo === 'camara' ? 'is-on' : ''} onClick={() => { setModo('camara'); setFase('inicio'); setResultado(null); detenerCamara(); }}>
                            Cámara
                        </button>
                        <button type="button" role="tab" aria-selected={modo === 'codigo'} className={modo === 'codigo' ? 'is-on' : ''} onClick={() => { setModo('codigo'); setFase('inicio'); setResultado(null); detenerCamara(); }}>
                            Código o PIN
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
                                        <span>Apunta al carnet, al código de la web o al QR del invitado.</span>
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
                                <label className="form-label" htmlFor="v2-porteria-codigo">Código, PIN o documento</label>
                                <div className="v2-input-row">
                                    <input
                                        id="v2-porteria-codigo"
                                        type="text"
                                        className="form-control"
                                        placeholder="PIN de 6 dígitos, documento o código del QR"
                                        value={texto}
                                        onChange={(e) => setTexto(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') validar(texto); }}
                                    />
                                    <button type="button" className="v2-btn v2-btn--primary" onClick={() => validar(texto)} disabled={ocupado || !texto.trim()}>
                                        {ocupado ? 'Validando…' : 'Validar'}
                                    </button>
                                </div>
                            </div>
                            <p className="v2-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                                Detectamos solo el tipo: PIN de 6 dígitos, documento del carnet o código del invitado.
                            </p>
                        </>
                    )}

                    {fase === 'listo' && resultado && (
                        <div className={`v2-alert ${resultado.ok ? 'v2-alert--ok' : 'v2-alert--err'}`}>
                            <span className="material-symbols-outlined">{resultado.ok ? 'check_circle' : 'error'}</span>
                            <div style={{ flex: 1 }}>
                                <strong>{resultado.ok ? (resultado.duplicado ? 'Acceso repetido' : 'Acceso registrado') : 'No se pudo validar'}</strong>
                                {resultado.mensaje}
                            </div>
                        </div>
                    )}
                </section>

                <section className="v2-access-card">
                    <div>
                        <h2>Persona</h2>
                        <p className="v2-access-sub">La última validación de esta sesión.</p>
                    </div>

                    <div className="v2-day-meta">
                        <div className="v2-meta">
                            <span className="v2-meta-label">Válidos</span>
                            <span className="v2-meta-value">{historial.filter((h) => h.ok).length}</span>
                        </div>
                        <div className="v2-meta">
                            <span className="v2-meta-label">Rechazados</span>
                            <span className="v2-meta-value">{historial.filter((h) => !h.ok).length}</span>
                        </div>
                    </div>

                    {resultado?.persona ? (
                        <div className="v2-persona">
                            <div className="v2-avatar" style={{ width: 46, height: 46, fontSize: '0.92rem' }}>
                                {resultado.persona.foto
                                    ? <img src={resultado.persona.foto} alt="" />
                                    : inicialesDe(resultado.persona.nombre?.split(' ')[0], resultado.persona.nombre?.split(' ')[1])}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <strong className="v2-persona-name">{resultado.persona.nombre}</strong>
                                <span className="v2-persona-sub">
                                    {resultado.persona.identificacion || 'Sin documento'} · {resultado.persona.rol || 'Usuario'}
                                </span>
                            </div>
                            <span className={`v2-tag ${resultado.ok ? 'v2-tag--in' : ''}`}>{resultado.hora}</span>
                        </div>
                    ) : (
                        <div className="v2-empty" style={{ padding: '10px 6px' }}>
                            <span className="material-symbols-outlined">badge</span>
                            Sin validaciones todavía
                        </div>
                    )}

                    <div>
                        <h2 style={{ fontSize: '0.9rem' }}>Validados ahora</h2>
                        <p className="v2-access-sub">Últimos escaneos de esta sesión.</p>
                    </div>

                    {historial.length === 0 ? (
                        <div className="v2-empty">
                            <span className="material-symbols-outlined">history</span>
                            Nada por aquí todavía
                        </div>
                    ) : (
                        <div className="v2-list">
                            {historial.map((h, i) => (
                                <div className="v2-row" key={`${h.hora}-${i}`}>
                                    <div className="v2-avatar" style={{ width: 30, height: 30, fontSize: '0.68rem' }}>
                                        {h.ok ? (h.persona ? inicialesDe(h.persona.nombre?.split(' ')[0], h.persona.nombre?.split(' ')[1]) : 'OK') : '!'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div className="v2-row-name">{h.persona?.nombre || (h.ok ? 'Acceso' : 'Código rechazado')}</div>
                                        <div className="v2-row-sub">{h.ok ? (h.canal === 'carnet' ? 'Carnet' : h.canal === 'invitado' ? 'Invitado' : 'Código / PIN') : h.mensaje}</div>
                                    </div>
                                    <div className="v2-row-right">
                                        <div className="v2-row-time">{h.hora}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="v2-panel">
                <div className="v2-panel-head">
                    <div>
                        <h2 className="v2-panel-title">Cómo validar</h2>
                        <p className="v2-panel-sub">Un solo escáner reconoce todo lo que llega a portería</p>
                    </div>
                </div>
                <div className="v2-grid-3">
                    <ol className="v2-steps">
                        <li><b>1</b><span><strong className="v2-strong">Carnet digital.</strong> Escanea el QR del usuario y queda su Entrada registrada al instante.</span></li>
                    </ol>
                    <ol className="v2-steps">
                        <li><b>2</b><span><strong className="v2-strong">Código de la web.</strong> El usuario genera un QR o PIN en la puerta y tú lo validas aquí.</span></li>
                    </ol>
                    <ol className="v2-steps">
                        <li><b>3</b><span><strong className="v2-strong">Invitado.</strong> El QR del invitado se consume una sola vez y caduca a la hora.</span></li>
                    </ol>
                </div>
            </section>
        </div>
    );
};

export default QrInvitadoV2;
