/** Abre un archivo en otra pestaña o lo descarga. */
export function abrirBlob(blob: Blob, nombre: string, descargar: boolean): void {
  const url = URL.createObjectURL(blob);
  if (descargar) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
