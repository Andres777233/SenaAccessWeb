import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

// QR de portería para proyectar (tema nuevo): grande, con cuenta atrás y PIN
// de respaldo. Se renueva solo cada 30 s para que nadie pueda reutilizarlo.
const AccesoQrV2 = () => {
    const [tipo, setTipo] = useState('entrada');
    const [qrUrl, setQrUrl] = useState('');
    const [segundos, setSegundos] = useState(30);
    const [error, setError] = useState('');
    const [pin, setPin] = useState(null);
    const [pinError, setPinError] = useState('');
    const [generandoPin, setGenerandoPin] = useState(false);
    const tipoRef = useRef(tipo);
    tipoRef.current = tipo;

    const cargar = async (t) => {
        try {
            const { data } = await axios.get(`/api/acceso/qr/${t}`);
            const url = await QRCode.toDataURL(data.qr_payload, {
                width: 640,
                margin: 1,
                errorCorrectionLevel: 'M',
                color: { dark: '#04140a', light: '#ffffff' },
            });
            if (tipoRef.current !== t) return;
            setQrUrl(url);
            setSegundos(Math.max(1, data.expira_en - Math.floor(Date.now() / 1000)));
            setError('');
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo generar el QR.');
        }
    };

    useEffect(() => {
        cargar(tipo);
        const id = setInterval(() => cargar(tipo), 25000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo]);

    useEffect(() => {
        const id = setInterval(() => setSegundos((s) => (s <= 1 ? 30 : s - 1)), 1000);
        return () => clearInterval(id);
    }, []);

    const generarPin = async () => {
        setGenerandoPin(true);
        try {
            const { data } = await axios.post('/api/admin/pines-acceso', { tipo });
            setPin(data);
            setPinError('');
        } catch (e) {
            setPinError(e.response?.data?.message || 'No se pudo generar el PIN.');
        } finally {
            setGenerandoPin(false);
        }
    };

    const porcentaje = Math.max(0, Math.min(100, (segundos / 30) * 100));

    return (
        <div className="v2-canvas v2-canvas--pantalla">
            <div className="v2-pagehead">
                <div>
                    <h1>Acceso QR</h1>
                    <p>Proyecta esta pantalla en portería. El código se renueva cada 30 segundos.</p>
                </div>
                <div className="v2-pagehead-actions">
                    <div className="v2-segmented" role="tablist" aria-label="Tipo de movimiento">
                        <button type="button" role="tab" aria-selected={tipo === 'entrada'} className={tipo === 'entrada' ? 'is-on' : ''} onClick={() => setTipo('entrada')}>
                            Entrada
                        </button>
                        <button type="button" role="tab" aria-selected={tipo === 'salida'} className={tipo === 'salida' ? 'is-on' : ''} onClick={() => setTipo('salida')}>
                            Salida
                        </button>
                    </div>
                </div>
            </div>

            <div className="v2-access">
                <section className="v2-access-card" style={{ alignItems: 'center' }}>
                    {error ? (
                        <div className="v2-alert v2-alert--err">
                            <span className="material-symbols-outlined">error</span>
                            <div>{error}</div>
                        </div>
                    ) : qrUrl ? (
                        <>
                            <div className={`v2-projector-qr ${tipo === 'salida' ? 'is-out' : ''}`}>
                                <img src={qrUrl} alt={`QR de ${tipo} vigente`} />
                            </div>
                            <div className={`v2-countdown ${porcentaje <= 25 ? 'is-low' : ''}`} aria-hidden="true">
                                <i style={{ width: `${porcentaje}%` }} />
                            </div>
                            <p className="v2-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                                {tipo === 'entrada' ? 'Entrada' : 'Salida'} · se renueva en {segundos}s
                            </p>
                            <p className="v2-muted" style={{ fontSize: '0.76rem', margin: 0, textAlign: 'center', maxWidth: '38ch' }}>
                                El aprendiz o instructor lo escanea desde su app o desde la web y queda en el historial.
                            </p>
                        </>
                    ) : (
                        <div className="v2-empty">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Generando QR…</span>
                            </div>
                        </div>
                    )}
                </section>

                <section className="v2-access-card">
                    <div>
                        <h2>PIN sin cámara</h2>
                        <p className="v2-access-sub">Para quien no puede escanear: dicta este PIN de 6 dígitos. Dura 5 minutos y sirve una sola vez.</p>
                    </div>

                    {pin ? (
                        <div className="v2-code">
                            <div className="v2-pin" aria-label={`PIN ${pin.pin}`}>
                                {String(pin.pin).split('').map((d, i) => <b key={i}>{d}</b>)}
                            </div>
                            <p className="v2-muted" style={{ fontSize: '0.76rem', margin: 0 }}>
                                PIN de {pin.tipo} generado correctamente.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="v2-pin" aria-hidden="true">
                                {[0, 1, 2, 3, 4, 5].map((i) => <b key={i} style={{ opacity: 0.35 }}>–</b>)}
                            </div>
                            <button type="button" className="v2-btn v2-btn--ghost v2-btn--block" onClick={generarPin} disabled={generandoPin}>
                                <span className="material-symbols-outlined">pin</span>
                                {generandoPin ? 'Generando…' : `Generar PIN de ${tipo}`}
                            </button>
                        </>
                    )}

                    {pinError && (
                        <div className="v2-alert v2-alert--err">
                            <span className="material-symbols-outlined">error</span>
                            <div>{pinError}</div>
                        </div>
                    )}

                    <ol className="v2-steps">
                        <li><b>1</b><span>Proyecta el QR o dicta el PIN.</span></li>
                        <li><b>2</b><span>Verifica que el usuario quede registrado en el historial.</span></li>
                        <li><b>3</b><span>La salida se marca con el QR de salida, nunca al cerrar la app.</span></li>
                    </ol>
                </section>
            </div>
        </div>
    );
};

export default AccesoQrV2;
