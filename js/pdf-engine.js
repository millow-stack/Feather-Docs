/**
 * LightPDF Engine (Production Hardened & Fully Self-Contained)
 * Uses locally bundled pdf.min.mjs and pdf.worker.min.mjs.
 * Handles encrypted password-protected PDFs, virtualized canvas rendering, and instance memory cleanup.
 */

import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "../vendor/pdfjs/pdf.worker.min.mjs";

export class PDFEngine {
  constructor() {
    this.pdfDoc = null;
    this.fileName = '';
    this.fileData = null;
    this.scale = 1.0;
    this.rotation = 0;
    this.currentPage = 1;
    this.renderedPages = new Map(); // pageNo -> { viewport, rendered: bool }
    this.textContents = new Map();
    this.intersectionObserver = null;
    this.onPasswordRequired = null; // Callback when password is required
  }

  async loadDocument(arrayBuffer, fileName = 'document.pdf', password = null) {
    this.destroy(); // Clean up previous document instance if any

    this.fileData = arrayBuffer;
    this.fileName = fileName;
    this.renderedPages.clear();
    this.textContents.clear();
    this.scale = 1.0;
    this.rotation = 0;
    this.currentPage = 1;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      password: password
    });

    loadingTask.onPassword = (updatePassword, reason) => {
      if (this.onPasswordRequired) {
        this.onPasswordRequired(updatePassword, reason);
      }
    };

    try {
      this.pdfDoc = await loadingTask.promise;
      return this.pdfDoc;
    } catch (err) {
      if (err.name === 'PasswordException') {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw err;
    }
  }

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.pdfDoc) {
      try {
        this.pdfDoc.destroy();
      } catch (e) {}
      this.pdfDoc = null;
    }
    this.renderedPages.clear();
    this.textContents.clear();
  }

  get numPages() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  async getMetadata() {
    if (!this.pdfDoc) return null;
    try {
      const meta = await this.pdfDoc.getMetadata();
      return {
        title: meta.info?.Title || this.fileName,
        author: meta.info?.Author || 'Unknown',
        creator: meta.info?.Creator || 'N/A',
        producer: meta.info?.Producer || 'N/A',
        creationDate: meta.info?.CreationDate || 'N/A',
        numPages: this.numPages,
        pdfVersion: meta.info?.PDFFormatVersion || '1.7',
        isEncrypted: meta.info?.IsEncrypted || false
      };
    } catch (e) {
      return { title: this.fileName, numPages: this.numPages };
    }
  }

  async getOutline() {
    if (!this.pdfDoc) return [];
    try {
      return (await this.pdfDoc.getOutline()) || [];
    } catch (e) {
      return [];
    }
  }

  async setupPagePlaceholders(containerEl) {
    containerEl.innerHTML = '';
    if (!this.pdfDoc) return;

    const firstPage = await this.pdfDoc.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: this.scale, rotation: this.rotation });

    for (let pageNo = 1; pageNo <= this.numPages; pageNo++) {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page-canvas-wrapper';
      pageWrapper.dataset.page = pageNo;

      pageWrapper.style.width = Math.floor(firstViewport.width) + 'px';
      pageWrapper.style.height = Math.floor(firstViewport.height) + 'px';

      const canvas = document.createElement('canvas');
      pageWrapper.appendChild(canvas);
      containerEl.appendChild(pageWrapper);

      this.renderedPages.set(pageNo, { rendered: false, viewport: firstViewport });
    }

    this.setupVirtualizationObserver(containerEl);
  }

  setupVirtualizationObserver(containerEl) {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNo = parseInt(entry.target.dataset.page, 10);
        if (entry.isIntersecting) {
          this.renderPageCanvas(pageNo, entry.target);
        } else {
          const pageData = this.renderedPages.get(pageNo);
          if (pageData && pageData.rendered) {
            const canvas = entry.target.querySelector('canvas');
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            pageData.rendered = false;
          }
        }
      });
    }, {
      root: containerEl.parentNode,
      rootMargin: '400px 0px 400px 0px',
      threshold: 0.01
    });

    containerEl.querySelectorAll('.page-canvas-wrapper').forEach(el => {
      this.intersectionObserver.observe(el);
    });
  }

  async renderPageCanvas(pageNo, pageWrapper) {
    const pageData = this.renderedPages.get(pageNo);
    if (!this.pdfDoc || (pageData && pageData.rendered)) return;

    try {
      const page = await this.pdfDoc.getPage(pageNo);
      const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });

      pageWrapper.style.width = Math.floor(viewport.width) + 'px';
      pageWrapper.style.height = Math.floor(viewport.height) + 'px';

      let canvas = pageWrapper.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        pageWrapper.appendChild(canvas);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const ctx = canvas.getContext('2d');
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
      };

      await page.render(renderContext).promise;
      await this.renderTextLayer(page, viewport, pageWrapper);

      this.renderedPages.set(pageNo, { viewport, rendered: true, width: viewport.width, height: viewport.height });
    } catch (e) {
      console.warn(`Render error on page ${pageNo}:`, e);
    }
  }

  async renderTextLayer(page, viewport, pageWrapper) {
    let textLayerDiv = pageWrapper.querySelector('.textLayer');
    if (textLayerDiv) {
      textLayerDiv.innerHTML = '';
    } else {
      textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      pageWrapper.appendChild(textLayerDiv);
    }

    try {
      const textContent = await page.getTextContent();
      this.textContents.set(page.pageNumber, textContent);

      textLayerDiv.style.width = Math.floor(viewport.width) + 'px';
      textLayerDiv.style.height = Math.floor(viewport.height) + 'px';

      for (const item of textContent.items) {
        if (!item.str || !item.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.fontSize = fontHeight + 'px';
        span.style.left = tx[4] + 'px';
        span.style.top = (tx[5] - fontHeight) + 'px';
        textLayerDiv.appendChild(span);
      }
    } catch (e) {
      console.warn('Text layer error:', e);
    }
  }

  async renderThumbnail(pageNo, containerEl, onClickCallback) {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(pageNo);

    const card = document.createElement('div');
    card.className = 'thumb-card';
    card.dataset.page = pageNo;
    if (pageNo === this.currentPage) card.classList.add('active');

    const canvas = document.createElement('canvas');
    const label = document.createElement('div');
    label.className = 'thumb-num';
    label.textContent = `Page ${pageNo}`;

    card.appendChild(canvas);
    card.appendChild(label);
    containerEl.appendChild(card);

    const viewport = page.getViewport({ scale: 0.18, rotation: this.rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    page.render({ canvasContext: ctx, viewport }).promise.catch(() => {});

    card.addEventListener('click', () => {
      if (onClickCallback) onClickCallback(pageNo);
    });
  }

  async renderAllThumbnails(containerEl, onClickCallback) {
    containerEl.innerHTML = '';
    for (let i = 1; i <= this.numPages; i++) {
      await this.renderThumbnail(i, containerEl, onClickCallback);
    }
  }

  async getPageText(pageNo) {
    if (this.textContents.has(pageNo)) {
      return this.textContents.get(pageNo);
    }
    if (!this.pdfDoc) return null;
    const page = await this.pdfDoc.getPage(pageNo);
    const content = await page.getTextContent();
    this.textContents.set(pageNo, content);
    return content;
  }
}
