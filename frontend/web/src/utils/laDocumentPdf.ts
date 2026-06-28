export function openLaDocumentHtml(html: string, title: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    document.body.removeChild(iframe);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    window.open(URL.createObjectURL(blob), '_blank');
    return;
  }

  frameWindow.document.open();
  frameWindow.document.write(html);
  frameWindow.document.close();
  frameWindow.document.title = title;

  frameWindow.focus();
  setTimeout(() => {
    frameWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 500);
  }, 400);
}

export function downloadLaDocumentHtml(html: string, fileName: string): void {
  const safe = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safe}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
