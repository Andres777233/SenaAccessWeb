import axios from 'axios';

// Descarga un archivo generado por la API (PDF, Excel o Word) usando el
// token de la sesión y el nombre indicado.
export const descargarArchivo = async (url, params, nombre) => {
    const response = await axios.get(url, { params, responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
};

export const nombreExportado = (base, formato) => {
    const fecha = new Date().toISOString().slice(0, 10);
    const extension = formato === 'xlsx' ? 'xlsx' : formato === 'docx' ? 'doc' : 'pdf';
    return `${base}_${fecha}.${extension}`;
};
