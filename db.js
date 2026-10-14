const DB_NAME = 'SiraelDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Nastavení (jméno, parametry)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Knihovna odpovědí
        if (!db.objectStoreNames.contains('library')) {
          const libStore = db.createObjectStore('library', { keyPath: 'id', autoIncrement: true });
          libStore.createIndex('category', 'category', { unique: false });
          libStore.createIndex('title', 'title', { unique: false });
        }

        // Paměť (dlouhodobá a krátkodobá)
        if (!db.objectStoreNames.contains('memory')) {
          const memStore = db.createObjectStore('memory', { keyPath: 'id', autoIncrement: true });
          memStore.createIndex('type', 'type', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject('Chyba při otevírání IndexedDB: ' + event.target.errorCode);
      };
    });
  }

  // --- Správa Nastavení ---
  async getSetting(key, defaultValue = null) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  // --- Knihovna Odpovědí ---
  async getAllLibraryItems() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('library', 'readonly');
      const store = tx.objectStore('library');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async saveLibraryItem(item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('library', 'readwrite');
      const store = tx.objectStore('library');
      item.updatedAt = new Date().toISOString();
      if (!item.createdAt) item.createdAt = item.updatedAt;
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async deleteLibraryItem(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('library', 'readwrite');
      const store = tx.objectStore('library');
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  // --- Paměť ---
  async getAllMemory() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('memory', 'readonly');
      const store = tx.objectStore('memory');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async saveMemoryItem(item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('memory', 'readwrite');
      const store = tx.objectStore('memory');
      item.timestamp = new Date().toISOString();
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e);
    });
  }

  async deleteMemoryItem(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('memory', 'readwrite');
      const store = tx.objectStore('memory');
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }
}

window.appDb = new Database();
