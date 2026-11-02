// Turns finished reports (complete HTML document strings) into PDF files and saves them
// straight to the device, with no new tab and no print dialog.
//
// jsPDF can't lay out Hebrew / right-to-left text itself, so each report is first laid out by
// the browser (in a hidden frame, where Hebrew and RTL come out right), drawn onto a canvas,
// and that picture is cut into A4 pages. The libraries are loaded only when a report is
// actually requested, so they don't weigh on the main bundle.

import type { jsPDF as JsPdf } from 'jspdf';

const PAGE_WIDTH_PX = 794; // an A4 page's width at 96 dpi
// Browsers (iPhones above all) refuse canvases that are too big, so a report taller than this
// is drawn one page at a time instead of as a single tall picture.
const MAX_SINGLE_CANVAS_CSS_PX = 3600;

type ToCanvas = typeof import('html-to-image')['toCanvas'];

/** Draws one report onto the given PDF, starting on a fresh page unless it is the first. */
async function addReport(pdf: JsPdf, toCanvas: ToCanvas, html: string, firstPage: boolean): Promise<void> {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
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

    const ratio = pageW / PAGE_WIDTH_PX; // css px -> pt
    const pageCssH = Math.floor(pageH / ratio); // css px that fit on one page
    let isFirst = firstPage;
    const addSlice = (canvas: HTMLCanvasElement, srcY: number, srcH: number) => {
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = srcH;
      const ctx = part.getContext('2d');
      if (!ctx) throw new Error('no 2d canvas context');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, part.width, part.height);
      ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      if (!isFirst) pdf.addPage();
      isFirst = false;
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (srcH / canvas.width) * pageW);
    };

    if (height <= MAX_SINGLE_CANVAS_CSS_PX) {
      const canvas = await toCanvas(body, { pixelRatio: 2, backgroundColor: '#ffffff', width: PAGE_WIDTH_PX, height, cacheBust: true });
      const sliceH = Math.floor(pageCssH * (canvas.width / PAGE_WIDTH_PX)); // canvas px per page
      for (let y = 0; y < canvas.height; y += sliceH) addSlice(canvas, y, Math.min(sliceH, canvas.height - y));
    } else {
      // one page-sized canvas per page: the body is shifted up by the pages already drawn
      for (let y = 0; y < height; y += pageCssH) {
        const sliceCss = Math.min(pageCssH, height - y);
        const canvas = await toCanvas(body, {
          pixelRatio: 2, backgroundColor: '#ffffff', width: PAGE_WIDTH_PX, height: sliceCss, cacheBust: true,
          style: { transform: `translateY(-${y}px)`, transformOrigin: 'top left' },
        });
        addSlice(canvas, 0, canvas.height);
      }
    }
  } finally {
    frame.remove();
  }
}

async function loadLibs() {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  return { toCanvas, jsPDF };
}

export async function downloadHtmlAsPdf(html: string, fileName: string): Promise<void> {
  return downloadHtmlsAsPdf([html], fileName);
}

/** Several reports, one after another, in a single PDF (each report starts on a new page). */
export async function downloadHtmlsAsPdf(htmls: string[], fileName: string): Promise<void> {
  const { toCanvas, jsPDF } = await loadLibs();
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  for (let i = 0; i < htmls.length; i++) await addReport(pdf, toCanvas, htmls[i], i === 0);
  pdf.save(fileName);
}

/** Saves a blob to the device as a file, the way an ordinary download link would. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * One PDF per report, all packed into a single .zip - lighter on the phone than one huge PDF,
 * and each person's report stays its own file. `onProgress` is told how many are done.
 */
export async function downloadHtmlsAsZip(
  items: { html: string; fileName: string }[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const [{ toCanvas, jsPDF }, { default: JSZip }] = await Promise.all([loadLibs(), import('jszip')]);
  const zip = new JSZip();
  const used = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    await addReport(pdf, toCanvas, items[i].html, true);
    let name = items[i].fileName;
    for (let n = 2; used.has(name); n++) name = items[i].fileName.replace(/\.pdf$/i, '') + ` (${n}).pdf`;
    used.add(name);
    zip.file(name, pdf.output('arraybuffer'));
    onProgress?.(i + 1, items.length);
  }
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), zipName);
}
