import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { showAlert } from '../CustomAlert';

// Código de un solo uso para que portería registre la entrada del usuario.
// La pantalla de la puerta escucha el estado y pasa sola al panel.
const CodigoAccesoV2 = ({ contexto = 'puerta' }) => {
    const [codigo, setCodigo] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [restante, setRestante] = useState(300);
    const [porcentaje, setPorcentaje] = useState(100);
    const [expirado, setExpirado] = useState(false);

    const generar = async () => {
        setCargando(true);
        try {
            const { data } = await axios.post('/api/acceso/generar');
            const qr = await QRCode.toDataURL(data.qr_payload, {
                margin: 1,
                width: 420,
                errorCorrectionLevel: 'M',
                color: { dark: '#04140a', light: '#ffffff' },
            });
            setCodigo({ pin: data.pin, qr, expira: data.expira_en });
        } catch (error) {
            showAlert(error.response?.data?.message || 'No se pudo generar el código.', 'error');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        if (!codigo) return undefined;
        const tick = () => {
            const ms = new Date(codigo.expira).getTime() - Date.now();
            const r = Math.max(0, Math.floor(ms / 1000));
            setRestante(r);
            setPorcentaje(Math.max(0, Math.min(100, (r / 300) * 100)));
            setExpirado(ms <= 0);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [codigo]);

    const copiarPin = async () => {
        try {
            await navigator.clipboard.writeText(String(codigo.pin));
            showAlert('PIN copiado');
        } catch (_) {
            showAlert(`El PIN es ${codigo.pin}`, 'info');
        }
    };

    if (!codigo) {
        return (
            <section className="v2-access-card">
                <div>
                    <h2>Muestra tu código</h2>
                    <p className="v2-access-sub">Genera un QR y un PIN de un solo uso. Portería lo escanea o lo digita.</p>
                </div>
                <div className="v2-code">
                    <div className="v2-code-qr v2-code-qr--vacio" aria-hidden="true">
                        <span className="material-symbols-outlined" style={{ fontSize: 46 }}>qr_code_2</span>
                        <span>Tu QR aparecerá aquí</span>
                    </div>
                    <p className="v2-muted" style={{ fontSize: '0.78rem', maxWidth: '30ch', margin: 0 }}>
                        El código dura 5 minutos y se invalida al usarse una vez.
                    </p>
                </div>
                <button type="button" className="v2-btn v2-btn--ghost v2-btn--block" onClick={generar} disabled={cargando}>
                    <span className="material-symbols-outlined">bolt</span>
                    {cargando ? 'Generando…' : 'Generar mi código'}
                </button>
            </section>
        );
    }

    return (
        <section className="v2-access-card">
            <div>
                <h2>Muestra tu código</h2>
                <p className="v2-access-sub">QR o PIN en portería. Se renueva solo cuando vence.</p>
            </div>

            <div className="v2-code">
                <div className="v2-code-qr">
                    <img src={codigo.qr} alt={`Código QR de acceso, PIN ${codigo.pin}`} />
                </div>

                <div className="v2-pin" aria-label={`PIN ${codigo.pin}`}>
                    {String(codigo.pin).split('').map((d, i) => <b key={i}>{d}</b>)}
                </div>

                <div className={`v2-countdown ${porcentaje <= 25 ? 'is-low' : ''}`} aria-hidden="true">
                    <i style={{ width: `${porcentaje}%` }} />
                </div>

                <p className={`v2-muted ${expirado ? 'text-danger' : ''}`} style={{ fontSize: '0.78rem', margin: 0 }}>
                    {expirado
                        ? 'Código vencido. Genera uno nuevo.'
                        : `Vence en ${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`}
                </p>
            </div>

            <div className="v2-actions-row">
                <button type="button" className="v2-btn v2-btn--ghost" onClick={copiarPin}>
                    <span className="material-symbols-outlined">content_copy</span>
                    Copiar PIN
                </button>
                <button type="button" className="v2-btn v2-btn--primary" onClick={generar} disabled={cargando}>
                    <span className="material-symbols-outlined">refresh</span>
                    {cargando ? 'Generando…' : 'Generar otro'}
                </button>
            </div>

            {contexto === 'puerta' && (
                <div className="v2-wait">
                    <span className="v2-pulse" aria-hidden="true" />
                    Esta pantalla pasa sola a tu panel cuando portería lo escanee.
                </div>
            )}
        </section>
    );
};

export default CodigoAccesoV2;
