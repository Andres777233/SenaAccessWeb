import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StatsDashboard = ({ currentUser = null }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const isAdmin = currentUser?.role?.rol_name === 'admin';

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const url = isAdmin ? '/api/admin/stats' : '/api/my-stats';
                const response = await axios.get(url);
                setStats(response.data);
                setError('');
            } catch (err) {
                setError('No se pudieron cargar los datos del dashboard.');
            } finally {
                setLoading(false);
            }
        };
        if (currentUser) fetchStats();
    }, [isAdmin, currentUser]);

    useEffect(() => {
        const handleFocus = () => {
            fetchStats();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchStats();
            }
        };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [currentUser]);

    const firstName = currentUser?.user_name || 'Usuario';

    const kpis = isAdmin ? [
        { label: 'Ingresos Hoy', value: stats?.ingresos_hoy ?? 0, icon: 'login' },
        { label: 'Usuarios', value: stats?.usuarios_totales ?? 0, icon: 'group' },
        { label: 'Equipos Activos', value: stats?.equipos_activos ?? 0, icon: 'devices' },
        { label: 'Novedades', value: stats?.novedades_totales ?? 0, icon: 'report_problem' },
    ] : [
        { label: 'Mis Ingresos Hoy', value: stats?.ingresos_hoy ?? 0, icon: 'login' },
        { label: 'Mis Entradas', value: stats?.distribucion_por_tipo?.Entrada ?? 0, icon: 'meeting_room' },
        { label: 'Mis Salidas', value: stats?.distribucion_por_tipo?.Salida ?? 0, icon: 'logout' },
        { label: 'Mis Novedades', value: stats?.novedades_totales ?? 0, icon: 'report_problem' },
    ];

    const ultimosAccesos = stats?.ultimos_accesos ?? [];

    return (
        <div className="fade-in-up mx-auto" style={{ maxWidth: isAdmin ? '1400px' : '1200px' }}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-4">
                <h2 className="mb-0" style={{ fontWeight: '800', letterSpacing: '-1px' }}>
                    Bienvenido, <span style={{ color: 'var(--primary-color)' }}>{firstName}</span>
                </h2>
            </div>

            {error && (
                <div className="glass-box p-4 mb-4 text-center opacity-75">
                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '40px' }}>cloud_off</span>
                    {error}
                </div>
            )}

            <div className="stats-container mx-auto">
                {kpis.map(kpi => (
                    <div className="stat-card" key={kpi.label}>
                        <div className="stat-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>{kpi.icon}</span>
                        </div>
                        <div className="stat-info">
                            <h4>{kpi.label}</h4>
                            <p>{loading ? '—' : kpi.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="glass-box p-4 mx-auto" style={{ maxWidth: '100%' }}>
                <div className="section-header mb-3">
                    <h3 className="mb-0">Últimos Accesos</h3>
                    <p className="opacity-50 small mb-0">Los 5 registros más recientes</p>
                </div>
                <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '40vh' }}>
                    <table className="table admin-table table-cards mb-0">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Fecha y Hora</th>
                                <th>Ubicación / Punto</th>
                                <th>Tipo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" className="text-center py-4"><div className="spinner-border text-success" role="status"></div></td></tr>
                            ) : ultimosAccesos.length > 0 ? ultimosAccesos.map(ingreso => (
                                <tr key={ingreso.id_ingreso}>
                                    <td data-label="Usuario">
                                        <div className="d-flex flex-column">
                                            <span className="fw-bold">{ingreso.user?.user_name} {ingreso.user?.user_lastname}</span>
                                            <span className="small opacity-50">{ingreso.user?.user_email}</span>
                                        </div>
                                    </td>
                                    <td data-label="Fecha y Hora">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="material-symbols-outlined opacity-50" style={{ fontSize: '18px' }}>calendar_today</span>
                                            {new Date(ingreso.ingreso_datetime).toLocaleString()}
                                        </div>
                                    </td>
                                    <td data-label="Ubicación">
                                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2" style={{ fontSize: '0.75rem' }}>
                                            {ingreso.ingreso_place}
                                        </span>
                                    </td>
                                    <td data-label="Tipo">
                                        <span className={`badge px-3 py-2 ${ingreso.ingreso_type === 'Entrada' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${ingreso.ingreso_type === 'Entrada' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                            {ingreso.ingreso_type}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="text-center py-4 opacity-50">Aún no hay registros de acceso.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StatsDashboard;