// Turns a finished report (a complete HTML document string) into a PDF file and saves it
// straight to the device, with no new tab and no print dialog.
//
// jsPDF can't lay out Hebrew / right-to-left text itself, so the report is first laid out by
// the browser (in a hidden frame, where Hebrew and RTL come out right), drawn onto a canvas,
// and that picture is cut into A4 pages. The libraries are loaded only when a report is
// actually requested, so they don't weigh on the main bundle.

const PAGE_WIDTH_PX = 794; // an A4 page's width at 96 dpi

export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  return downloadHtmlsAsPdf([html], fileName);
}

/** Several reports, one after another, in a single PDF (each report starts on a new page). */
export async function downloadHtmlsAsPdf(htmls: string[], fileName: string): Promise<void> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  let firstPage = true;

  for (const html of htmls) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;height:1200px;border:0;visibility:hidden`;
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument;
      if (!doc) throw new Error('no document for the PDF frame');
      doc.open();
      doc.write(html);
      doc.close();
      // the on-screen "download" button (it only makes sense in a browser tab)
      doc.querySelectorAll('.download-footer').forEach(el => el.remove());

      // wait for images (the logo) and fonts before drawing
      await Promise.all(Array.from(doc.images).map(img => (img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = img.onerror = () => res(); }))));
      await doc.fonts?.ready;

      const body = doc.body;
      body.style.background = '#fff';
      body.style.margin = '0';
      const height = Math.max(body.scrollHeight, 400);
      frame.style.height = `${height}px`;

      const canvas = await toCanvas(body, { pixelRatio: 2, backgroundColor: '#ffffff', width: PAGE_WIDTH_PX, height, cacheBust: true });

      const ratio = pageW / canvas.width; // canvas px -> pt
      const sliceH = Math.floor(pageH / ratio); // canvas px that fit on one page
      for (let y = 0; y < canvas.height; y += sliceH) {
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = Math.min(sliceH, canvas.height - y);
        const ctx = part.getContext('2d');
        if (!ctx) throw new Error('no 2d canvas context');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, part.width, part.height);
        ctx.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
        if (!firstPage) pdf.addPage();
        firstPage = false;
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, part.height * ratio);
      }
    } finally {
      frame.remove();
    }
  }
  pdf.save(fileName);
}
