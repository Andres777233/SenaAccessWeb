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
            <div className="acc-view">
                <div className="section-header">
                    <h3 className="mb-0">Validar ingreso</h3>
                    <p className="small opacity-75 mb-0">Carnet, carnet digital, código de ingreso (QR/PIN) y QR de invitado en un solo lugar.</p>
                </div>

                <div className="aviso-sena">
                    <span className="material-symbols-outlined">info</span>
                    <div>
                        <strong>Ojo con el código de SALIDA</strong>
                        <p className="mb-0">
                            Si validas un código de salida, el usuario no podrá registrar una nueva ENTRADA
                            hasta 24 horas después. Revisa el sentido del código antes de validar.
                        </p>
                    </div>
                </div>

                <div className="row g-4">
                    <div className="col-12 col-lg-7">
                        <div className="glass-box p-4 h-100">
                            <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                                <div>
                                    <h4 className="fw-bold mb-1">Escáner de ingreso</h4>
                                    <p className="small opacity-75 mb-0">Apunta al carnet, al código de ingreso o al QR del invitado.</p>
                                </div>
                                <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">
                                    {validos} VÁLIDOS HOY
                                </span>
                            </div>

                            <div className="btn-group mb-3" role="group" aria-label="Método de validación">
                                <button type="button" className={`btn ${modo === 'camara' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setModo('camara'); setFase('inicio'); setResultado(null); }}>
                                    Cámara
                                </button>
                                <button type="button" className={`btn ${modo === 'codigo' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setModo('codigo'); setFase('inicio'); setResultado(null); detenerCamara(); }}>
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
                                                <p className="fw-bold text-white mb-0">Cámara apagada</p>
                                                <p>Apunta al carnet, al código de ingreso o al QR del invitado.</p>
                                                <button type="button" className="btn btn-glow mt-2" onClick={iniciarCamara} disabled={ocupado}>
                                                    {ocupado ? 'VALIDANDO…' : 'ABRIR CÁMARA'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {errorCamara && <div className="alert alert-warning small mt-3 mb-0 py-2">{errorCamara}</div>}

                                    {escaneando && (
                                        <button type="button" className="btn btn-outline-success w-100 mt-3" onClick={detener}>
                                            <span className="material-symbols-outlined small align-middle me-1">stop_circle</span>
                                            Detener cámara
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <label className="form-label" htmlFor="acc-porteria">Código, PIN o documento</label>
                                    <div className="input-group">
                                        <input
                                            id="acc-porteria"
                                            type="text"
                                            className="form-control"
                                            placeholder="PIN de 6 dígitos, documento o código del QR"
                                            value={texto}
                                            onChange={(e) => setTexto(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') validar(texto); }}
                                        />
                                        <button type="button" className="btn btn-success fw-bold px-3" onClick={() => validar(texto)} disabled={ocupado || !texto.trim()}>
                                            {ocupado ? 'VALIDANDO…' : 'VALIDAR'}
                                        </button>
                                    </div>
                                    <p className="small opacity-50 mt-2 mb-0">Se detecta solo: PIN de 6 dígitos, documento del carnet o código del invitado.</p>
                                </>
                            )}

                            {fase === 'listo' && resultado && (
                                <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-danger'} mt-3 mb-0`}>
                                    <div className="fw-bold">
                                        {resultado.ok ? (resultado.duplicado ? 'Acceso repetido' : 'Acceso registrado') : 'No se pudo validar'}
                                    </div>
                                    <div className="small">{resultado.mensaje}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="col-12 col-lg-5">
                        <div className="glass-box p-4 h-100">
                            <h4 className="fw-bold mb-1">Persona</h4>
                            <p className="small opacity-75 mb-3">La última validación de esta sesión.</p>

                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10 h-100">
                                        <span className="form-label d-block mb-1 opacity-50">VÁLIDOS</span>
                                        <div className="fw-bold">{validos}</div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10 h-100">
                                        <span className="form-label d-block mb-1 opacity-50">RECHAZADOS</span>
                                        <div className="fw-bold">{rechazados}</div>
                                    </div>
                                </div>
                            </div>

                            {resultado?.persona ? (
                                <div className="acc-persona mb-3">
                                    <div className="acc-avatar">
                                        {resultado.persona.foto
                                            ? <img src={resultado.persona.foto} alt="" />
                                            : inicialesDe(resultado.persona.nombre?.split(' ')[0], resultado.persona.nombre?.split(' ')[1])}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <strong className="d-block text-truncate">{resultado.persona.nombre}</strong>
                                        <small className="opacity-75 d-block text-truncate">
                                            {resultado.persona.identificacion || 'Sin documento'} · {resultado.persona.rol || 'Usuario'}
                                        </small>
                                    </div>
                                    <span className="small fw-bold">{resultado.hora}</span>
                                </div>
                            ) : (
                                <p className="small opacity-50 mb-3">Aún no has validado a nadie en esta sesión.</p>
                            )}

                            <h5 className="fw-bold mb-1">Validados ahora</h5>
                            <p className="small opacity-75 mb-2">Últimos escaneos de esta sesión.</p>

                            {historial.length === 0 ? (
                                <p className="text-center small opacity-50 py-3 mb-0">Nada por aquí todavía</p>
                            ) : historial.map((h, i) => (
                                <div className="acc-fila" key={`${h.hora}-${i}`}>
                                    <div className="acc-avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                                        {h.ok ? (h.persona ? inicialesDe(h.persona.nombre?.split(' ')[0], h.persona.nombre?.split(' ')[1]) : 'OK') : '!'}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <strong className="d-block text-truncate">{h.persona?.nombre || (h.ok ? 'Acceso' : 'Código rechazado')}</strong>
                                        <small className="d-block text-truncate">
                                            {h.ok
                                                ? (h.canal === 'carnet' ? 'Carnet' : h.canal === 'invitado' ? 'Invitado' : 'Código / PIN')
                                                : h.mensaje}
                                        </small>
                                    </div>
                                    <span className="acc-fila-hora">{h.hora}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-box p-4 mt-4">
                    <h4 className="fw-bold mb-1">Cómo validar</h4>
                    <p className="small opacity-75 mb-3">Un solo escáner reconoce todo lo que llega a portería.</p>
                    <ul className="list-unstyled small opacity-75 mb-0">
                        <li className="d-flex gap-2 mb-1"><span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span><span><strong>Carnet digital:</strong> escanea el QR del usuario y queda su Entrada registrada al instante.</span></li>
                        <li className="d-flex gap-2 mb-1"><span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span><span><strong>Ingreso:</strong> el usuario genera un QR o PIN en la puerta y tú lo validas aquí.</span></li>
                        <li className="d-flex gap-2"><span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>check_circle</span><span><strong>Invitado:</strong> el QR del invitado se consume una sola vez y caduca a la hora.</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default QrInvitado;
