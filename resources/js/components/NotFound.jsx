import React from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import BotonTema from './BotonTema';

const NotFound = () => (
    <div className="auth-page fade-in-up">
        <main className="auth-main">
            <div className="glass-box auth-card text-center" style={{ maxWidth: '480px' }}>
                <BotonTema />
                <span className="material-symbols-outlined text-success" style={{ fontSize: '56px' }}>
                    explore_off
                </span>
                <h2 className="fw-bold mt-2">Página no encontrada</h2>
                <p className="opacity-75 mb-4">La ruta que buscas no existe o cambió de lugar.</p>
                <div className="d-grid gap-2">
                    <Link to="/login" className="btn btn-glow btn-primary-login w-100 fw-bold py-3 text-decoration-none">
                        VOLVER AL LOGIN
                    </Link>
                    <Link to="/" className="btn btn-glow w-100 py-3 text-decoration-none">
                        IR AL INICIO
                    </Link>
                </div>
            </div>
        </main>
        <Footer />
    </div>
);

export default NotFound;
