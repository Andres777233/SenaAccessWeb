import React from 'react';
import { useTema } from '../utils/tema';
import StatsDashboardClasico from './clasico/StatsDashboardClasico';
import StatsDashboardV2 from './v2/StatsDashboardV2';

const StatsDashboard = (props) => {
    const { esV2 } = useTema();
    return esV2 ? <StatsDashboardV2 {...props} /> : <StatsDashboardClasico {...props} />;
};

export default StatsDashboard;
