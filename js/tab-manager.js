/**
 * LightPDF Multi-Tab Document Manager
 * Handles opening, switching, closing, and restoring multiple PDF/DOCX tabs.
 */

export class TabManager {
  constructor(onTabChange, onTabClose) {
    this.tabs = []; // { id, title, buffer, fileName, fileType, state }
    this.activeTabId = null;
    this.onTabChange = onTabChange;
    this.onTabClose = onTabClose;
    this.containerEl = document.getElementById('tabsContainer');
    this.openBtnEl = document.getElementById('openFileBtn');
  }

  /**
   * @param {string} title
   * @param {ArrayBuffer} buffer
   * @param {string} fileName
   * @param {'pdf'|'docx'} fileType
   */
  addTab(title, buffer, fileName, fileType = 'pdf') {
    const tabId = 'tab_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newTab = {
      id: tabId,
      title: title || 'Untitled',
      buffer: buffer,
      fileName: fileName || title || 'document',
      fileType: fileType,
      state: {
        currentPage: 1,
        scale: 1.0,
        rotation: 0,
        scrollTop: 0
      }
    };

    this.tabs.push(newTab);
    this.renderTabBar();
    this.activateTab(tabId);
    return newTab;
  }

  activateTab(tabId) {
    const target = this.tabs.find(t => t.id === tabId);
    if (!target) return;

    // Save state of current active tab before switching
    if (this.activeTabId) {
      const currentTab = this.tabs.find(t => t.id === this.activeTabId);
      if (currentTab && this.onSaveCurrentState) {
        currentTab.state = this.onSaveCurrentState();
      }
    }

    this.activeTabId = tabId;
    this.renderTabBar();

    if (this.onTabChange) {
      this.onTabChange(target);
    }
  }

  closeTab(tabId, e) {
    if (e) e.stopPropagation();

    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const closedTab = this.tabs[index];
    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.max(0, index - 1);
        this.activateTab(this.tabs[nextIndex].id);
      } else {
        this.activeTabId = null;
        if (this.onTabClose) this.onTabClose(closedTab, true);
      }
    }

    this.renderTabBar();
  }

  renderTabBar() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    // Preserve the "Open File" button at the start
    if (this.openBtnEl) {
      this.containerEl.appendChild(this.openBtnEl);
    }

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item' + (tab.id === this.activeTabId ? ' active' : '');

      const iconClass = tab.fileType === 'docx'
        ? 'fa-solid fa-file-word'
        : 'fa-solid fa-file-pdf';

      tabEl.innerHTML = `
        <i class="${iconClass} tab-icon"></i>
        <span class="tab-title" title="${tab.title}">${tab.title}</span>
        <button class="tab-close-btn" title="Close tab"><i class="fa-solid fa-xmark"></i></button>
      `;

      tabEl.onclick = () => this.activateTab(tab.id);
      const closeBtn = tabEl.querySelector('.tab-close-btn');
      closeBtn.onclick = (e) => this.closeTab(tab.id, e);

      this.containerEl.appendChild(tabEl);
    });
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }
}
