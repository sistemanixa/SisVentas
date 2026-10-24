(function install(root) {
  'use strict';
  const EPS = 0.5;
  const defaultAtoms = 'tr,thead,tfoot,img,svg,canvas,header,.header,.firma,.firmas,.signatures,.sign,.total,.totales,.resumen,.monto-box,.amount,.data,.info-grid,.validez,footer,.footer,[data-print-keep]';
  function css() {
    return '@media print{thead{display:table-header-group}tfoot{display:table-row-group}tr,img,svg,canvas,[data-print-keep]{break-inside:avoid;page-break-inside:avoid}table,tbody{break-inside:auto}img{max-width:100%;max-height:261mm;object-fit:contain}p,li{orphans:3;widows:3}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv-print-allow-split{break-inside:auto!important;page-break-inside:auto!important}}';
  }
  function native(doc) {
    if (!doc || !doc.body || !doc.defaultView) return;
    const probe = doc.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:1px;height:261mm';
    doc.body.appendChild(probe);
    try {
      const limit = probe.getBoundingClientRect().height;
      if (!(limit > 0)) return;
      for (const node of doc.body.querySelectorAll('*')) {
        const style = doc.defaultView.getComputedStyle(node);
        if (/avoid/.test(style.breakInside || style.pageBreakInside) || node.classList.contains('sv-print-allow-split')) {
          node.classList.toggle('sv-print-allow-split', node.getBoundingClientRect().height > limit);
        }
      }
    } finally { probe.remove(); }
  }
  async function ready(element, options) {
    options = options || {};
    const doc = element && (element.ownerDocument || element.nodeType === 9 && element) || root.document;
    if (!doc) return;
    const win = doc.defaultView || root;
    // The caller's clock survives removal of a child iframe/popup. A timeout
    // scheduled on that child could otherwise disappear before settling ready.
    const clock = typeof root.setTimeout === 'function' ? root : win;
    let timer, cancelled = false;
    const cleanup = [];
    const timeout = new Promise((resolve, reject) => { timer = clock.setTimeout(() => { cancelled = true; reject(Error('El documento todavía tiene recursos sin cargar. Esperá y volvé a intentar.')); }, options.timeoutMs || 10000); });
    const images = Array.from((element || doc).querySelectorAll('img'));
    try {
      await Promise.race([Promise.all([
        doc.fonts && doc.fonts.ready ? Promise.resolve(doc.fonts.ready) : Promise.resolve(),
        ...images.map(img => img.decode ? Promise.resolve().then(() => img.decode()).then(() => { if (!img.naturalWidth) throw Error('No se pudo cargar una imagen del documento. Volvé a intentar.'); }) : img.complete ? (img.naturalWidth ? Promise.resolve() : Promise.reject(Error('No se pudo cargar una imagen del documento. Volvé a intentar.'))) : new Promise((resolve, reject) => {
          const loaded = () => img.naturalWidth ? resolve() : reject(Error('No se pudo cargar una imagen del documento. Volvé a intentar.'));
          const failed = () => reject(Error('No se pudo cargar una imagen del documento. Volvé a intentar.'));
          img.addEventListener('load', loaded, { once: true });
          img.addEventListener('error', failed, { once: true });
          cleanup.push(() => { img.removeEventListener('load', loaded); img.removeEventListener('error', failed); });
        }))
      ]), timeout]);
      if (cancelled || win.closed) throw Error('Se cerró la vista del documento.');
    } finally { clock.clearTimeout(timer); cleanup.forEach(fn => fn()); }
  }
  // Geometry is expressed in CSS pixels. Long blocks fall back to text-line
  // boundaries; no page is removed and every source interval is retained.
  function plan(height, pageHeight, geometry) {
    if (!(height > 0) || !(pageHeight > 2)) throw Error('El documento no tiene dimensiones válidas para imprimir.');
    geometry = geometry || {};
    const atoms = geometry.atoms || [], lines = geometry.lines || [], tables = geometry.tables || [];
    const forced = (geometry.forced || []).filter(n => n > EPS && n < height - EPS).sort((a, b) => a - b);
    const pages = [];
    let start = 0;
    while (start < height) {
      const table = tables.find(t => start >= t.headBottom - EPS && start < t.bottom - EPS && t.headBottom > t.top);
      const repeat = table && table.headBottom - table.top < pageHeight / 2 ? { top: table.top, bottom: table.headBottom } : null;
      const capacity = pageHeight - (repeat ? repeat.bottom - repeat.top : 0);
      let end = Math.min(height, start + capacity);
      const explicit = forced.find(n => n > start + EPS && n < end - EPS);
      if (explicit !== undefined) end = explicit;
      const moveBefore = regions => {
        for (let count = 0; count <= regions.length; count++) {
          const crossing = regions.filter(r => r.top > start + EPS && r.top < end - EPS && r.bottom > end + EPS && r.bottom - r.top <= capacity + EPS);
          if (!crossing.length) break;
          end = Math.min(...crossing.map(r => r.top));
        }
      };
      if (end < height - EPS) {
        for (let attempt = 0; attempt <= atoms.length + lines.length; attempt++) {
          const before = end; moveBefore(atoms); moveBefore(lines);
          if (end === before) break;
        }
      }
      if (!(end > start)) throw Error('No se pudo distribuir el contenido entre páginas.');
      pages.push({ start, end, repeat });
      if (pages.length > 300) throw Error('El documento supera las 300 páginas. Dividí la impresión en partes.');
      start = end;
    }
    return pages;
  }
  function geometry(element, selectors) {
    const doc = element.ownerDocument, win = doc.defaultView;
    const base = element.getBoundingClientRect();
    const rect = r => ({ top: Math.max(0, r.top - base.top), bottom: Math.min(base.height, r.bottom - base.top) });
    const atoms = [], lines = [], tables = [], forced = [];
    for (const node of element.querySelectorAll(defaultAtoms + (selectors ? ',' + selectors : ''))) {
      const box = node.getBoundingClientRect();
      if (box.width && box.height) atoms.push(rect(box));
    }
    for (const table of element.querySelectorAll('table')) {
      const header = table.tHead;
      if (!header || !header.getBoundingClientRect().height) continue;
      const head = rect(header.getBoundingClientRect()), area = rect(table.getBoundingClientRect());
      tables.push({ top: head.top, headBottom: head.bottom, bottom: area.bottom });
      const first = table.tBodies[0] && table.tBodies[0].rows[0];
      if (first) atoms.push({ top: head.top, bottom: rect(first.getBoundingClientRect()).bottom });
    }
    const walker = doc.createTreeWalker(element, win.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(node.parentElement.tagName)) continue;
      const range = doc.createRange(); range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (box.width && box.height) lines.push(rect(box));
    }
    for (const node of element.querySelectorAll('*')) {
      const style = win.getComputedStyle(node), box = rect(node.getBoundingClientRect());
      if (/^(page|always|left|right)$/.test(style.breakBefore || style.pageBreakBefore)) forced.push(box.top);
      if (/^(page|always|left|right)$/.test(style.breakAfter || style.pageBreakAfter)) forced.push(box.bottom);
    }
    return { atoms, lines, tables, forced };
  }
  function margins(value) {
    const list = Array.isArray(value) ? value : [value || 0];
    const result = list.length === 1 ? [list[0], list[0], list[0], list[0]] : list.length === 2 ? [list[0], list[1], list[0], list[1]] : list.slice();
    if (result.length !== 4 || result.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0) || result[1] + result[3] >= 210 || result[0] + result[2] >= 297) throw Error('Los márgenes del PDF no son válidos.');
    return result;
  }
  async function pdf(element, options) {
    options = options || {};
    if (!element || !element.ownerDocument) throw Error('No se encontró el documento para exportar.');
    const doc = element.ownerDocument, win = doc.defaultView || root;
    const engine = win.html2pdf;
    if (typeof engine !== 'function') throw Error('No se pudo cargar el generador de PDF.');
    const margin = margins(options.margin === undefined ? options.margins : options.margin);
    const width = Number(options.widthPx) || Math.ceil(element.getBoundingClientRect().width) || 794;
    if (!(width > 0 && width <= 4096)) throw Error('El ancho de impresión no es válido.');
    const innerWidth = 210 - margin[1] - margin[3], innerHeight = 297 - margin[0] - margin[2];
    const pageHeight = innerHeight * width / innerWidth;
    await ready(element, options);
    const host = doc.createElement('div'), clone = element.cloneNode(true);
    host.style.cssText = 'position:fixed;left:0;top:0;margin:0;padding:0;background:#fff;z-index:2147483647;pointer-events:none;overflow:visible;width:' + width + 'px';
    clone.style.setProperty('box-sizing', 'border-box');
    clone.style.setProperty('width', width + 'px');
    clone.style.setProperty('min-height', '0');
    clone.style.setProperty('height', 'auto');
    clone.style.setProperty('max-height', 'none');
    clone.style.setProperty('margin', '0');
    clone.style.setProperty('overflow', 'visible');
    // Establish a formatting context: first-child margins must not shift the
    // canvas origin relative to the geometry used for every page boundary.
    clone.style.setProperty('display', 'flow-root');
    clone.querySelectorAll('.no-print,.acciones-recibo,.acciones-doc,.actions,.toolbar,[data-html2canvas-ignore],script,noscript').forEach(node => node.remove());
    host.appendChild(clone); doc.body.appendChild(host);
    try {
      const style = doc.createElement('style');
      style.textContent = 'tfoot{display:table-row-group}'; host.prepend(style);
      await ready(clone, options);
      for (const img of clone.querySelectorAll('img')) {
        const box = img.getBoundingClientRect(), limit = Math.max(1, pageHeight - 2);
        if (box.height > limit) {
          img.style.setProperty('width', box.width * limit / box.height + 'px', 'important');
          img.style.setProperty('height', limit + 'px', 'important');
        }
      }
      const height = clone.getBoundingClientRect().height;
      const pages = plan(height, pageHeight, geometry(clone, options.atomicSelectors));
      const image = Object.assign({ type: 'jpeg', quality: 0.98 }, options.image);
      const settings = Object.assign({ scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' }, options.html2canvas, { scrollX: 0, scrollY: 0, x: 0, width, windowWidth: width });
      const output = await engine().set({ jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(doc.createElement('div')).toPdf().get('pdf');
      async function capture(top, bottom) {
        const worker = engine().set({ margin: 0, html2canvas: Object.assign({}, settings, { y: top, height: bottom - top }) }).from(clone).toCanvas();
        const canvas = await worker.get('canvas');
        if (!canvas || !canvas.width || !canvas.height) throw Error('No se pudo capturar el documento completo.');
        return canvas;
      }
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i], canvas = await capture(page.start, page.end);
        if (i) output.addPage();
        let y = margin[0];
        if (page.repeat) {
          const header = await capture(page.repeat.top, page.repeat.bottom);
          const mm = (page.repeat.bottom - page.repeat.top) * innerWidth / width;
          output.addImage(header.toDataURL('image/' + image.type, image.quality), image.type.toUpperCase(), margin[3], y, innerWidth, mm, undefined, 'FAST');
          y += mm;
        }
        const mm = (page.end - page.start) * innerWidth / width;
        output.addImage(canvas.toDataURL('image/' + image.type, image.quality), image.type.toUpperCase(), margin[3], y, innerWidth, mm, undefined, 'FAST');
      }
      return output.output('blob');
    } finally { host.remove(); }
  }
  const api = { ready, css, pdf, plan, native, source: () => '(' + install.toString() + ')(globalThis);' };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SVPrintLayout = api;
  if (root.document && typeof root.addEventListener === 'function') root.addEventListener('beforeprint', () => native(root.document));
})(typeof globalThis === 'object' ? globalThis : this);
