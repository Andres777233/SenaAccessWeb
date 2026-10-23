import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import BotonTema from './BotonTema';
import EscanearAcceso from './EscanearAcceso';
import CodigoAcceso from './CodigoAcceso';
import { showAlert } from './CustomAlert';

// Día actual en Bogotá como YYYY-MM-DD (el servidor guarda hora Bogotá).
const diaBogota = (fecha) => {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(fecha instanceof Date ? fecha : new Date(fecha));
    } catch (_) {
        return new Date().toISOString().slice(0, 10);
    }
};

// Puerta de entrada: tras el login, quien no tenga Entrada de hoy debe
// escanear el QR de portería antes de entrar a su panel. El Admin operativo
// y el superadmin no pasan por aquí.
const PuertaAcceso = () => {
    const navigate = useNavigate();
    const [verificando, setVerificando] = useState(false);

    const entrarAlPanel = () => {
        const role = (localStorage.getItem('user_role') || '').toLowerCase();
        if (role === 'superadmin') navigate('/admin');
        else if (role === 'instructor') navigate('/instructor');
        else if (role === 'aprendiz') navigate('/aprendiz');
        else if (role === 'admin') navigate('/portero');
        else navigate('/loading');
    };

    const verificarYEntrar = async () => {
        setVerificando(true);
        try {
            const { data } = await axios.get('/api/my-ingresos');
            const lista = Array.isArray(data) ? data : (data.data || []);
            const hoy = diaBogota(new Date());
            const tieneEntrada = lista.some((m) => m.ingreso_type === 'Entrada' && diaBogota(m.ingreso_datetime) === hoy);
            if (tieneEntrada) {
                entrarAlPanel();
            } else {
                showAlert('Aún no tienes Entrada de hoy. Escanea el QR de portería.', 'error');
            }
        } catch (_) {
            showAlert('No se pudo verificar tu entrada. Intenta de nuevo.', 'error');
        } finally {
            setVerificando(false);
        }
    };

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
                <div className="glass-box puerta-card">
                    <BotonTema />
                    <EscanearAcceso />
                    <CodigoAcceso />
                    <button type="button" className="btn btn-glow w-100 fw-bold py-3 mt-3 btn-press" onClick={verificarYEntrar} disabled={verificando}>
                        {verificando ? 'VERIFICANDO...' : 'YA MARQUÉ, ENTRAR'}
                    </button>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default PuertaAcceso;
export { diaBogota };
