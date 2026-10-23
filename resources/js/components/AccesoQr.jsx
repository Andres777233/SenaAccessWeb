import React from 'react';
import { useTema } from '../utils/tema';
import AccesoQrClasico from './clasico/AccesoQrClasico';
import AccesoQrV2 from './v2/AccesoQrV2';

const AccesoQr = (props) => {
    const { esV2 } = useTema();
    return esV2 ? <AccesoQrV2 {...props} /> : <AccesoQrClasico {...props} />;
};

export default AccesoQr;
