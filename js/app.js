/**
 * LightPDF App Orchestrator (Production Ready & Self-Contained)
 * Supports PDF and DOCX documents with local vendor libraries.
 * Features: multi-tab, password-protected PDFs, XSS sanitization,
 *           theme cycling (Dark→Light→Sepia→Night), annotations,
 *           search, and global error boundaries.
 */

import { PDFEngine } from './pdf-engine.js';
import { DOCXEngine } from './docx-engine.js';
import { StorageManager } from './storage.js';
import { AnnotationEngine } from './annotation-engine.js';
import { SearchEngine } from './search-engine.js';
import { TouchEngine } from './touch-gestures.js';
import { TabManager } from './tab-manager.js';
import { getSamplePDFArrayBuffer } from './sample-pdf.js';
import { Utils } from './utils.js';

class LightPDFApp {
  constructor() {
    this.pdfEngine = new PDFEngine();
    this.docxEngine = new DOCXEngine();
    this.annotationEngine = new AnnotationEngine();
    this.searchEngine = new SearchEngine(this.pdfEngine);
    this.settings = StorageManager.getSettings();

    // Track which engine type is active
    this.activeEngineType = null; // 'pdf' | 'docx' | null

    // Tab Manager Setup
    this.tabManager = new TabManager(
      (activeTab) => this.switchTab(activeTab),
      (closedTab, isLast) => this.handleTabClosed(closedTab, isLast)
    );
    this.tabManager.onSaveCurrentState = () => this.getCurrentState();

    this.pendingPasswordCallback = null;
    this.els = {};
    this.initDOM();
    this.applySettings();
    this.bindEvents();
    this.setupAndroidCompat();
    this.setupGlobalErrorHandlers();
    this.loadSampleOrRecent();
  }

  initDOM() {
    this.els = {
      app: document.querySelector('.app-container'),
      openFileBtn: document.getElementById('openFileBtn'),
      fileInput: document.getElementById('fileInput'),
      samplePdfBtn: document.getElementById('samplePdfBtn'),
      prevPageBtn: document.getElementById('prevPageBtn'),
      nextPageBtn: document.getElementById('nextPageBtn'),
      pageInput: document.getElementById('pageInput'),
      pageCount: document.getElementById('pageCount'),
      zoomOutBtn: document.getElementById('zoomOutBtn'),
      zoomInBtn: document.getElementById('zoomInBtn'),
      zoomFitBtn: document.getElementById('zoomFitBtn'),
      zoomValue: document.getElementById('zoomValue'),
      rotateBtn: document.getElementById('rotateBtn'),
      themeBtn: document.getElementById('themeBtn'),
      sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
      annoToggleBtn: document.getElementById('annoToggleBtn'),
      printBtn: document.getElementById('printBtn'),
      downloadBtn: document.getElementById('downloadBtn'),
      shareBtn: document.getElementById('shareBtn'),
      fullscreenBtn: document.getElementById('fullscreenBtn'),
      infoBtn: document.getElementById('infoBtn'),

      sidebar: document.getElementById('sidebar'),
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabPanels: document.querySelectorAll('.sidebar-panel'),
      thumbsContainer: document.getElementById('thumbsContainer'),
      outlineTree: document.getElementById('outlineTree'),

      searchInput: document.getElementById('searchInput'),
      searchBtn: document.getElementById('searchBtn'),
      searchResults: document.getElementById('searchResults'),

      stage: document.getElementById('stage'),
      pagesContainer: document.getElementById('pagesContainer'),
      emptyState: document.getElementById('emptyState'),
      toastStatus: document.getElementById('toastStatus'),

      annotationBar: document.getElementById('annotationBar'),
      toolPen: document.getElementById('toolPen'),
      toolHighlight: document.getElementById('toolHighlight'),
      toolEraser: document.getElementById('toolEraser'),
      colorPicker: document.getElementById('colorPicker'),
      strokeWidthSelect: document.getElementById('strokeWidthSelect'),
      clearAnnoBtn: document.getElementById('clearAnnoBtn'),

      infoModal: document.getElementById('infoModal'),
      closeInfoModal: document.getElementById('closeInfoModal'),
      metadataContent: document.getElementById('metadataContent'),

      passwordModal: document.getElementById('passwordModal'),
      closePasswordModal: document.getElementById('closePasswordModal'),
      pdfPasswordInput: document.getElementById('pdfPasswordInput'),
      submitPasswordBtn: document.getElementById('submitPasswordBtn')
    };

    // Touch engine for mobile
    this.touchEngine = new TouchEngine(
      this.els.stage,
      (type, step = 0.15) => {
        if (type === 'in') this.setZoom(this.getActiveScale() + step);
        else if (type === 'out') this.setZoom(this.getActiveScale() - step);
        else if (type === 'toggle-fit') this.fitToWidth();
      }
    );

    // Password Required Callback from PDF Engine
    this.pdfEngine.onPasswordRequired = (updatePassword, reason) => {
      this.pendingPasswordCallback = updatePassword;
      this.els.passwordModal.classList.add('active');
      this.els.pdfPasswordInput.focus();
    };
  }

  // --- Helpers for dual-engine support ---

  getActiveScale() {
    if (this.activeEngineType === 'pdf') return this.pdfEngine.scale;
    return 1.0;
  }

  getActiveNumPages() {
    if (this.activeEngineType === 'pdf') return this.pdfEngine.numPages;
    if (this.activeEngineType === 'docx') return this.docxEngine.numPages;
    return 0;
  }

  getActiveCurrentPage() {
    if (this.activeEngineType === 'pdf') return this.pdfEngine.currentPage;
    if (this.activeEngineType === 'docx') return this.docxEngine.currentPage;
    return 0;
  }

  /** Determine file type from filename extension */
  static getFileType(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (ext === 'docx') return 'docx';
    return 'pdf';
  }

  // --- Global Error Handling ---

  setupGlobalErrorHandlers() {
    window.onerror = (msg, url, lineNo, colNo, error) => {
      console.error('[Production Error Boundary]', msg, error);
      this.showToast('An unexpected error occurred. Please try again.', 4000);
      return false;
    };

    window.onunhandledrejection = (e) => {
      console.warn('[Unhandled Promise Rejection]', e.reason);
    };
  }

  // --- Toast Notifications ---

  showToast(message, duration = 3000) {
    if (!message) {
      this.els.toastStatus.style.display = 'none';
      return;
    }
    this.els.toastStatus.innerHTML = `<div class="spinner"></div><span>${Utils.escapeHTML(message)}</span>`;
    this.els.toastStatus.style.display = 'flex';

    if (duration > 0) {
      setTimeout(() => {
        if (this.els.toastStatus.textContent.includes(message)) {
          this.els.toastStatus.style.display = 'none';
        }
      }, duration);
    }
  }

  triggerHaptic() {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(12); } catch (e) {}
    }
  }

  // --- Theme Management (Fixed Cycling) ---

  applySettings() {
    // Remove all theme classes, then apply the correct one
    document.body.classList.remove('theme-dark', 'theme-light', 'reading-sepia', 'reading-night');

    const theme = this.settings.theme || 'dark';
    const mode = this.settings.readingMode || 'normal';

    if (mode === 'sepia') {
      document.body.classList.add('reading-sepia');
    } else if (mode === 'night') {
      document.body.classList.add('reading-night');
    } else if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.add('theme-dark');
    }
  }

  cycleTheme() {
    const theme = this.settings.theme || 'dark';
    const mode = this.settings.readingMode || 'normal';

    // Cycle order: Dark → Light → Sepia → Night → Dark
    if (theme === 'dark' && mode === 'normal') {
      this.settings.theme = 'light';
      this.settings.readingMode = 'normal';
    } else if (theme === 'light' && mode === 'normal') {
      this.settings.theme = 'dark';
      this.settings.readingMode = 'sepia';
    } else if (mode === 'sepia') {
      this.settings.theme = 'dark';
      this.settings.readingMode = 'night';
    } else {
      this.settings.theme = 'dark';
      this.settings.readingMode = 'normal';
    }

    StorageManager.saveSettings(this.settings);
    this.applySettings();
  }

  // --- Event Binding ---

  bindEvents() {
    // Open File(s) — now from the tab bar button
    this.els.openFileBtn.onclick = () => {
      this.triggerHaptic();
      this.els.fileInput.click();
    };

    if (this.els.samplePdfBtn) {
      this.els.samplePdfBtn.onclick = () => {
        this.triggerHaptic();
        this.loadSampleDocument();
      };
    }

    this.els.fileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach(file => this.openFile(file));
      }
      // Reset so the same file can be re-opened
      e.target.value = '';
    };

    // Drag and Drop (Multi-file)
    ['dragenter', 'dragover'].forEach(name => {
      this.els.stage.addEventListener(name, (e) => {
        e.preventDefault();
        this.els.emptyState.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      this.els.stage.addEventListener(name, (e) => {
        e.preventDefault();
        this.els.emptyState.classList.remove('drag-over');
      });
    });
    this.els.stage.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach(file => this.openFile(file));
      }
    });

    // Password Submit Handler
    this.els.submitPasswordBtn.onclick = () => {
      const pwd = this.els.pdfPasswordInput.value;
      if (pwd && this.pendingPasswordCallback) {
        this.pendingPasswordCallback(pwd);
        this.els.passwordModal.classList.remove('active');
        this.els.pdfPasswordInput.value = '';
      }
    };
    this.els.closePasswordModal.onclick = () => {
      this.els.passwordModal.classList.remove('active');
      this.els.pdfPasswordInput.value = '';
    };

    // Navigation
    this.els.prevPageBtn.onclick = () => {
      this.triggerHaptic();
      this.goToPage(this.getActiveCurrentPage() - 1);
    };
    this.els.nextPageBtn.onclick = () => {
      this.triggerHaptic();
      this.goToPage(this.getActiveCurrentPage() + 1);
    };
    this.els.pageInput.onchange = () => {
      const page = parseInt(this.els.pageInput.value, 10);
      if (!isNaN(page)) this.goToPage(page);
    };

    // Zoom Controls
    this.els.zoomInBtn.onclick = () => {
      this.triggerHaptic();
      this.setZoom(this.getActiveScale() + 0.15);
    };
    this.els.zoomOutBtn.onclick = () => {
      this.triggerHaptic();
      this.setZoom(this.getActiveScale() - 0.15);
    };
    this.els.zoomFitBtn.onclick = () => {
      this.triggerHaptic();
      this.fitToWidth();
    };

    // Rotation (PDF only)
    if (this.els.rotateBtn) {
      this.els.rotateBtn.onclick = () => {
        if (this.activeEngineType !== 'pdf') return;
        this.triggerHaptic();
        this.pdfEngine.rotation = (this.pdfEngine.rotation + 90) % 360;
        this.pdfEngine.setupPagePlaceholders(this.els.pagesContainer);
      };
    }

    // Sidebar Toggle & Tabs
    this.els.sidebarToggleBtn.onclick = () => {
      this.triggerHaptic();
      this.els.sidebar.classList.toggle('collapsed');
      this.els.sidebarToggleBtn.classList.toggle('btn-active');
    };

    this.els.tabBtns.forEach(btn => {
      btn.onclick = () => {
        this.triggerHaptic();
        this.els.tabBtns.forEach(b => b.classList.remove('active'));
        this.els.tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPanel = document.getElementById(btn.dataset.tab);
        if (targetPanel) targetPanel.classList.add('active');
      };
    });

    // Theme Switcher — fixed cycle
    this.els.themeBtn.onclick = () => {
      this.triggerHaptic();
      this.cycleTheme();
    };

    // Annotation Tools
    this.els.annoToggleBtn.onclick = () => {
      this.triggerHaptic();
      this.els.annotationBar.classList.toggle('hidden');
      this.els.annoToggleBtn.classList.toggle('btn-active');
      if (this.els.annotationBar.classList.contains('hidden')) {
        this.annotationEngine.setTool('select');
      } else {
        this.annotationEngine.setTool('pen');
        this.els.toolPen.classList.add('btn-active');
      }
    };

    this.els.toolPen.onclick = () => {
      this.clearToolButtons();
      this.els.toolPen.classList.add('btn-active');
      this.annotationEngine.setTool('pen');
    };

    this.els.toolHighlight.onclick = () => {
      this.clearToolButtons();
      this.els.toolHighlight.classList.add('btn-active');
      this.annotationEngine.setTool('highlight');
    };

    this.els.toolEraser.onclick = () => {
      this.clearToolButtons();
      this.els.toolEraser.classList.add('btn-active');
      this.annotationEngine.setTool('eraser');
    };

    this.els.colorPicker.oninput = (e) => this.annotationEngine.setColor(e.target.value);
    this.els.strokeWidthSelect.onchange = (e) => this.annotationEngine.setStrokeWidth(parseInt(e.target.value, 10));
    this.els.clearAnnoBtn.onclick = () => this.annotationEngine.clearPage(this.getActiveCurrentPage());

    // Search Engine
    const triggerSearch = async () => {
      const q = this.els.searchInput.value.trim();
      if (!q) return;

      // For DOCX: simple text search
      if (this.activeEngineType === 'docx') {
        this.searchDocxText(q);
        return;
      }

      this.showToast('Searching document text…', 0);
      this.els.searchResults.innerHTML = '';
      this.searchEngine.clearHighlights(this.els.pagesContainer);

      const results = await this.searchEngine.search(q, (page, total, matches) => {
        this.showToast(`Scanning page ${page}/${total} (${matches} matches)…`, 0);
      });

      this.showToast(`Search complete: ${results.length} matches found.`, 3000);

      if (results.length === 0) {
        this.els.searchResults.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No text matches found.</div>';
        return;
      }

      results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div class="search-result-page">Page ${res.pageNo}</div>
          <div class="search-result-snippet">${Utils.escapeHTML(res.snippet)}</div>
        `;
        item.onclick = () => {
          this.goToPage(res.pageNo);
          this.searchEngine.highlightPageMatches(res.pageNo, this.els.pagesContainer);
        };
        this.els.searchResults.appendChild(item);
      });

      this.searchEngine.highlightPageMatches(this.pdfEngine.currentPage, this.els.pagesContainer);
    };

    this.els.searchBtn.onclick = triggerSearch;
    this.els.searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') triggerSearch();
    };

    // Print & Download
    this.els.printBtn.onclick = () => window.print();
    this.els.downloadBtn.onclick = () => this.downloadDocument();

    if (this.els.shareBtn) {
      this.els.shareBtn.onclick = async () => {
        this.triggerHaptic();
        const activeTab = this.tabManager.getActiveTab();
        if (navigator.share && activeTab && activeTab.buffer) {
          try {
            const mimeType = activeTab.fileType === 'docx'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/pdf';
            const blob = new Blob([activeTab.buffer], { type: mimeType });
            const file = new File([blob], activeTab.fileName, { type: mimeType });
            await navigator.share({ title: activeTab.fileName, files: [file] });
          } catch (e) {
            console.log('Share notice:', e);
          }
        } else {
          this.downloadDocument();
        }
      };
    }

    // Fullscreen Mode
    this.els.fullscreenBtn.onclick = () => {
      this.triggerHaptic();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    // Document Info Modal
    this.els.infoBtn.onclick = async () => {
      this.triggerHaptic();
      let meta;
      if (this.activeEngineType === 'docx') {
        meta = this.docxEngine.getMetadata();
      } else {
        meta = await this.pdfEngine.getMetadata();
      }
      if (!meta) return;
      this.els.metadataContent.innerHTML = `
        <div class="metadata-label">File Name:</div><div class="metadata-value">${Utils.escapeHTML(meta.title)}</div>
        <div class="metadata-label">Author:</div><div class="metadata-value">${Utils.escapeHTML(meta.author)}</div>
        <div class="metadata-label">Pages:</div><div class="metadata-value">${meta.numPages}</div>
        <div class="metadata-label">Creator:</div><div class="metadata-value">${Utils.escapeHTML(meta.creator)}</div>
        <div class="metadata-label">Format:</div><div class="metadata-value">${Utils.escapeHTML(meta.pdfVersion)}</div>
      `;
      this.els.infoModal.classList.add('active');
    };
    this.els.closeInfoModal.onclick = () => this.els.infoModal.classList.remove('active');

    // Stage Scroll Observer
    this.els.stage.addEventListener('scroll', () => this.onStageScroll());

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        this.goToPage(this.getActiveCurrentPage() + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        this.goToPage(this.getActiveCurrentPage() - 1);
      } else if (e.key === '+' || e.key === '=') {
        this.setZoom(this.getActiveScale() + 0.15);
      } else if (e.key === '-' || e.key === '_') {
        this.setZoom(this.getActiveScale() - 0.15);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.els.sidebar.classList.remove('collapsed');
        document.querySelector('[data-tab="tabSearch"]').click();
        this.els.searchInput.focus();
      } else if (e.key === 'Escape') {
        this.els.infoModal.classList.remove('active');
        this.els.passwordModal.classList.remove('active');
        this.els.annotationBar.classList.add('hidden');
      }
    });
  }

  // --- DOCX Text Search ---

  searchDocxText(query) {
    const plain = this.docxEngine.getPlainText();
    if (!plain) {
      this.els.searchResults.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No text content available.</div>';
      return;
    }

    const lowerQuery = query.toLowerCase();
    const lowerText = plain.toLowerCase();
    const matches = [];
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      const start = Math.max(0, pos - 30);
      const end = Math.min(plain.length, pos + query.length + 30);
      matches.push({ position: pos, snippet: plain.substring(start, end) });
      pos += query.length;
    }

    this.showToast(`Search complete: ${matches.length} matches found.`, 3000);
    this.els.searchResults.innerHTML = '';

    if (matches.length === 0) {
      this.els.searchResults.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No text matches found.</div>';
      return;
    }

    matches.forEach((res, i) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="search-result-page">Match ${i + 1}</div>
        <div class="search-result-snippet">${Utils.escapeHTML(res.snippet)}</div>
      `;
      this.els.searchResults.appendChild(item);
    });
  }

  // --- Android Compatibility ---

  setupAndroidCompat() {
    window.history.pushState({ page: 1 }, '');
    window.onpopstate = () => {
      if (this.els.infoModal.classList.contains('active')) {
        this.els.infoModal.classList.remove('active');
        window.history.pushState({ page: 1 }, '');
      } else if (this.els.passwordModal.classList.contains('active')) {
        this.els.passwordModal.classList.remove('active');
        window.history.pushState({ page: 1 }, '');
      } else if (!this.els.annotationBar.classList.contains('hidden')) {
        this.els.annotationBar.classList.add('hidden');
        window.history.pushState({ page: 1 }, '');
      } else if (!this.els.sidebar.classList.contains('collapsed') && window.innerWidth < 768) {
        this.els.sidebar.classList.add('collapsed');
        window.history.pushState({ page: 1 }, '');
      }
    };
  }

  clearToolButtons() {
    [this.els.toolPen, this.els.toolHighlight, this.els.toolEraser].forEach(b => b.classList.remove('btn-active'));
  }

  // --- File Opening (PDF + DOCX) ---

  async openFile(file) {
    if (!file) return;

    const fileType = LightPDFApp.getFileType(file.name);
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['pdf', 'docx'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      alert('Please select a PDF or DOCX file.');
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      if (!confirm('This is a large file (>200MB). Do you wish to continue loading?')) return;
    }

    this.showToast(`Opening ${file.name}…`, 0);
    try {
      const buffer = await file.arrayBuffer();
      StorageManager.addRecentFile({ name: file.name, size: file.size, totalPages: 0 });
      StorageManager.cacheDocumentBuffer(file.name, buffer);

      this.tabManager.addTab(file.name, buffer, file.name, fileType);
    } catch (err) {
      console.error(err);
      this.showToast(`Failed to load ${fileType.toUpperCase()} file.`, 4000);
    }
  }

  getCurrentState() {
    return {
      currentPage: this.getActiveCurrentPage(),
      scale: this.getActiveScale(),
      rotation: this.activeEngineType === 'pdf' ? this.pdfEngine.rotation : 0,
      scrollTop: this.els.stage.scrollTop
    };
  }

  // --- Tab Switching (PDF + DOCX) ---

  async switchTab(activeTab) {
    if (!activeTab || !activeTab.buffer) return;
    this.showToast(`Switching to ${activeTab.title}…`, 0);

    try {
      if (activeTab.fileType === 'docx') {
        await this.switchToDocx(activeTab);
      } else {
        await this.switchToPdf(activeTab);
      }
      this.showToast('');
    } catch (err) {
      if (err.message === 'PASSWORD_REQUIRED') {
        this.showToast('Password required to view document.');
      } else {
        console.error(err);
        this.showToast('Failed to switch document tab.', 3000);
      }
    }
  }

  async switchToPdf(activeTab) {
    this.activeEngineType = 'pdf';

    await this.pdfEngine.loadDocument(activeTab.buffer, activeTab.fileName);
    this.pdfEngine.scale = activeTab.state.scale || 1.0;
    this.pdfEngine.rotation = activeTab.state.rotation || 0;
    this.pdfEngine.currentPage = activeTab.state.currentPage || 1;

    this.els.emptyState.style.display = 'none';
    this.els.pagesContainer.style.display = 'flex';
    this.els.pagesContainer.classList.remove('docx-mode');
    this.updatePageUI();

    await this.pdfEngine.setupPagePlaceholders(this.els.pagesContainer);
    this.renderSidebarData();

    if (activeTab.state.scrollTop) {
      this.els.stage.scrollTop = activeTab.state.scrollTop;
    }
  }

  async switchToDocx(activeTab) {
    this.activeEngineType = 'docx';

    this.showToast('Converting DOCX…', 0);
    await this.docxEngine.loadDocument(activeTab.buffer, activeTab.fileName);

    this.els.emptyState.style.display = 'none';
    this.els.pagesContainer.style.display = 'flex';
    this.els.pagesContainer.classList.add('docx-mode');

    this.docxEngine.renderToContainer(this.els.pagesContainer);
    this.updatePageUI();

    // Clear PDF-specific sidebar data
    this.els.thumbsContainer.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">Thumbnails not available for DOCX files.</div>';
    this.els.outlineTree.innerHTML = '<li style="padding:8px;color:var(--text-muted);font-size:0.85rem;">Outline not available for DOCX files.</li>';

    if (activeTab.state.scrollTop) {
      this.els.stage.scrollTop = activeTab.state.scrollTop;
    }
  }

  handleTabClosed(closedTab, isLast) {
    if (isLast) {
      this.pdfEngine.destroy();
      this.docxEngine.destroy();
      this.activeEngineType = null;
      this.els.emptyState.style.display = 'flex';
      this.els.pagesContainer.style.display = 'none';
      this.els.pagesContainer.classList.remove('docx-mode');
      this.els.thumbsContainer.innerHTML = '';
      this.els.outlineTree.innerHTML = '';
      this.els.searchResults.innerHTML = '';
      this.els.pageInput.value = 0;
      this.els.pageCount.textContent = '/ 0';
    }
  }

  // --- Sidebar ---

  async renderSidebarData() {
    if (this.activeEngineType !== 'pdf') return;

    await this.pdfEngine.renderAllThumbnails(this.els.thumbsContainer, (pageNo) => {
      this.goToPage(pageNo);
    });

    const outline = await this.pdfEngine.getOutline();
    this.els.outlineTree.innerHTML = '';
    if (!outline || outline.length === 0) {
      this.els.outlineTree.innerHTML = '<li style="padding:8px;color:var(--text-muted);font-size:0.85rem;">No outline found.</li>';
      return;
    }

    const renderItems = (items, container) => {
      items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'outline-item';
        li.innerHTML = `<span><i class="fa-solid fa-bookmark" style="font-size:0.7rem;margin-right:6px;color:var(--accent)"></i>${Utils.escapeHTML(item.title)}</span>`;
        li.onclick = async () => {
          if (item.dest) {
            const pageIdx = typeof item.dest === 'string'
              ? await this.pdfEngine.pdfDoc.getPageIndex(item.dest)
              : item.dest[0];
            this.goToPage(pageIdx + 1);
          }
        };
        container.appendChild(li);
        if (item.items && item.items.length > 0) {
          const ul = document.createElement('ul');
          ul.style.paddingLeft = '14px';
          li.appendChild(ul);
          renderItems(item.items, ul);
        }
      });
    };

    renderItems(outline, this.els.outlineTree);
  }

  // --- Page Navigation ---

  goToPage(pageNo) {
    const numPages = this.getActiveNumPages();
    if (numPages === 0) return;
    const target = Math.max(1, Math.min(numPages, pageNo));

    if (this.activeEngineType === 'pdf') {
      this.pdfEngine.currentPage = target;
    } else if (this.activeEngineType === 'docx') {
      this.docxEngine.currentPage = target;
    }

    const pageEl = this.els.pagesContainer.querySelector(`[data-page="${target}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.updatePageUI();
  }

  onStageScroll() {
    if (this.activeEngineType !== 'pdf') return;

    const pages = this.els.pagesContainer.querySelectorAll('.page-canvas-wrapper');
    const stageRect = this.els.stage.getBoundingClientRect();

    pages.forEach(page => {
      const rect = page.getBoundingClientRect();
      if (rect.top <= stageRect.top + stageRect.height / 2 && rect.bottom >= stageRect.top + stageRect.height / 2) {
        const pNum = parseInt(page.dataset.page, 10);
        if (this.pdfEngine.currentPage !== pNum) {
          this.pdfEngine.currentPage = pNum;
          this.updatePageUI();
        }
      }
    });
  }

  updatePageUI() {
    const currentPage = this.getActiveCurrentPage();
    const numPages = this.getActiveNumPages();

    this.els.pageInput.value = currentPage;
    this.els.pageCount.textContent = `/ ${numPages}`;
    this.els.prevPageBtn.disabled = currentPage <= 1;
    this.els.nextPageBtn.disabled = currentPage >= numPages;

    if (this.activeEngineType === 'pdf') {
      this.els.thumbsContainer.querySelectorAll('.thumb-card').forEach(card => {
        card.classList.toggle('active', parseInt(card.dataset.page, 10) === currentPage);
      });
    }
  }

  // --- Zoom ---

  setZoom(scale) {
    if (this.activeEngineType !== 'pdf') return;
    const newScale = Math.max(0.3, Math.min(3.5, scale));
    this.pdfEngine.scale = newScale;
    this.updateZoomLabel();
    this.pdfEngine.setupPagePlaceholders(this.els.pagesContainer);
  }

  fitToWidth() {
    if (this.activeEngineType !== 'pdf') return;
    const stageWidth = this.els.stage.clientWidth - 48;
    const pageObj = this.pdfEngine.renderedPages.get(1);
    if (pageObj && pageObj.width) {
      const baseWidth = pageObj.width / this.pdfEngine.scale;
      this.setZoom(stageWidth / baseWidth);
    } else {
      this.setZoom(1.0);
    }
  }

  updateZoomLabel() {
    this.els.zoomValue.textContent = `${Math.round(this.getActiveScale() * 100)}%`;
  }

  // --- Download ---

  downloadDocument() {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab || !activeTab.buffer) return;

    const mimeType = activeTab.fileType === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    const blob = new Blob([activeTab.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.fileName || 'document';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // --- Sample Document ---

  async loadSampleDocument() {
    this.showToast('Loading sample document…', 0);
    try {
      const buffer = getSamplePDFArrayBuffer();
      this.tabManager.addTab('Sample_Document.pdf', buffer, 'Sample_Document.pdf', 'pdf');
      this.showToast('Sample PDF loaded in tab.', 2500);
    } catch (err) {
      console.error(err);
      this.showToast('Failed to load sample document.', 3000);
    }
  }

  async loadSampleOrRecent() {
    this.showToast('Ready. Open a PDF or DOCX to begin.', 2500);
  }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  window.lightPDFApp = new LightPDFApp();
});
