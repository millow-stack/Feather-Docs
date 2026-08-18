/**
 * LightPDF Search Engine
 * Performs fast multi-page text searches, caching text contents and highlighting query matches.
 */

export class SearchEngine {
  constructor(pdfEngine) {
    this.pdfEngine = pdfEngine;
    this.query = '';
    this.results = []; // Array of { pageNo, snippet, matchIndex }
    this.currentMatchIndex = -1;
  }

  async search(query, onProgress) {
    this.query = query.trim();
    this.results = [];
    this.currentMatchIndex = -1;

    if (!this.query || !this.pdfEngine.pdfDoc) return [];

    const lowerQuery = this.query.toLowerCase();
    const totalPages = this.pdfEngine.numPages;

    for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
      const textContent = await this.pdfEngine.getPageText(pageNo);
      if (!textContent || !textContent.items) continue;

      let fullPageText = '';
      for (const item of textContent.items) {
        fullPageText += item.str + ' ';
      }

      const lowerText = fullPageText.toLowerCase();
      let index = lowerText.indexOf(lowerQuery);

      while (index !== -1) {
        // Extract surrounding context snippet
        const start = Math.max(0, index - 25);
        const end = Math.min(fullPageText.length, index + this.query.length + 30);
        let snippet = fullPageText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < fullPageText.length) snippet = snippet + '...';

        this.results.push({
          pageNo,
          snippet,
          charIndex: index
        });

        index = lowerText.indexOf(lowerQuery, index + lowerQuery.length);
      }

      if (onProgress) {
        onProgress(pageNo, totalPages, this.results.length);
      }
    }

    return this.results;
  }

  highlightPageMatches(pageNo, containerEl) {
    const textLayer = containerEl.querySelector(`[data-page="${pageNo}"] .textLayer`);
    if (!textLayer || !this.query) return;

    const lowerQuery = this.query.toLowerCase();
    const spans = textLayer.querySelectorAll('span');

    spans.forEach(span => {
      const text = span.textContent;
      const lower = text.toLowerCase();
      if (lower.includes(lowerQuery)) {
        // Highlight matching text span
        const regex = new RegExp(`(${this.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        span.innerHTML = text.replace(regex, '<mark class="highlight">$1</mark>');
      }
    });
  }

  clearHighlights(containerEl) {
    containerEl.querySelectorAll('.textLayer mark').forEach(mark => {
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
  }
}
