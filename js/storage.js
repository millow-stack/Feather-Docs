/**
 * LightPDF Storage & Cache Manager
 * Handles local persistence, cookies, IndexedDB/Cache API document caching, and settings.
 */

const STORAGE_KEYS = {
  SETTINGS: 'lightpdf_settings',
  RECENT_FILES: 'lightpdf_recent_files',
  TAB_SESSION: 'lightpdf_tab_session',
  ANNOTATIONS_PREFIX: 'lightpdf_annos_'
};

export class StorageManager {
  static getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : { theme: 'dark', readingMode: 'normal', scale: 1.0 };
    } catch (e) {
      return { theme: 'dark', readingMode: 'normal', scale: 1.0 };
    }
  }

  static saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      this.setCookie('lightpdf_theme', updated.theme, 365);
    } catch (e) {
      console.warn('Failed to save settings', e);
    }
  }

  static getRecentFiles() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_FILES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static addRecentFile(fileInfo) {
    try {
      let list = this.getRecentFiles();
      list = list.filter(item => item.name !== fileInfo.name);
      list.unshift({
        name: fileInfo.name,
        size: fileInfo.size,
        lastPage: fileInfo.lastPage || 1,
        totalPages: fileInfo.totalPages || 0,
        timestamp: Date.now()
      });
      if (list.length > 15) list.pop();
      localStorage.setItem(STORAGE_KEYS.RECENT_FILES, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save recent file', e);
    }
  }

  // Cache API / IndexedDB document buffer caching
  static async cacheDocumentBuffer(docName, arrayBuffer) {
    try {
      if (!('caches' in window)) return;
      const cache = await caches.open('lightpdf-docs');
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const response = new Response(blob, { headers: { 'Content-Type': 'application/pdf' } });
      await cache.put('/doc/' + encodeURIComponent(docName), response);
    } catch (e) {
      console.warn('Cache API store warning:', e);
    }
  }

  static async getCachedDocumentBuffer(docName) {
    try {
      if (!('caches' in window)) return null;
      const cache = await caches.open('lightpdf-docs');
      const response = await cache.match('/doc/' + encodeURIComponent(docName));
      if (response) {
        return await response.arrayBuffer();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Cookie Helpers
  static setCookie(name, value, days = 30) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Strict`;
  }

  static getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
  }
}
