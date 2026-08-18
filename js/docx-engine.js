/**
 * LightPDF DOCX Engine
 * Renders .docx files in the browser using mammoth.js for HTML conversion.
 * Produces a scrollable HTML page that integrates with the existing viewer stage.
 */

export class DOCXEngine {
  constructor() {
    this.fileName = '';
    this.fileData = null;
    this.htmlContent = '';
    this.plainText = '';
    this.numPages = 1;
    this.currentPage = 1;
    this.mammothLoaded = false;
  }

  async ensureMammoth() {
    if (this.mammothLoaded) return;
    if (typeof mammoth === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './vendor/mammoth/mammoth.browser.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    this.mammothLoaded = true;
  }

  async loadDocument(arrayBuffer, fileName = 'document.docx') {
    this.fileData = arrayBuffer;
    this.fileName = fileName;
    this.currentPage = 1;

    await this.ensureMammoth();

    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer: arrayBuffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1.docx-h1",
          "p[style-name='Heading 2'] => h2.docx-h2",
          "p[style-name='Heading 3'] => h3.docx-h3"
        ]
      }
    );

    const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });

    this.htmlContent = htmlResult.value;
    this.plainText = textResult.value;
    this.warnings = htmlResult.messages;
    return htmlResult;
  }

  renderToContainer(containerEl) {
    containerEl.innerHTML = '';

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-canvas-wrapper docx-page';
    pageWrapper.dataset.page = '1';

    const docxContent = document.createElement('div');
    docxContent.className = 'docx-rendered-content';
    docxContent.innerHTML = this.htmlContent;

    pageWrapper.appendChild(docxContent);
    containerEl.appendChild(pageWrapper);

    this.numPages = 1;
    return pageWrapper;
  }

  getMetadata() {
    return {
      title: this.fileName,
      author: 'N/A',
      creator: 'Microsoft Word',
      producer: 'mammoth.js',
      numPages: this.numPages,
      pdfVersion: 'N/A (DOCX)',
      isEncrypted: false
    };
  }

  getPlainText() {
    return this.plainText;
  }

  destroy() {
    this.htmlContent = '';
    this.plainText = '';
    this.fileData = null;
    this.numPages = 1;
    this.currentPage = 1;
  }
}
