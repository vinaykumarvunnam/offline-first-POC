class OfflineDataStore {
  constructor(dbName = 'posDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.changeListeners = new Map();
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    this.retryTimeout = null;
    this.backoff = 1000; // ms, initial backoff
    this.maxBackoff = 30000;

    this.initPromise = this._init();
    window.addEventListener('online', () => this._flushQueue());
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  async _init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("orders"))
          db.createObjectStore("orders", { keyPath: "id" });
        if (!db.objectStoreNames.contains("products"))
          db.createObjectStore("products", { keyPath: "id" });
        if (!db.objectStoreNames.contains("printJobs"))
          db.createObjectStore("printJobs", { keyPath: "id" });
      };
      request.onsuccess = e => { this.db = e.target.result; resolve(); };
      request.onerror = e => reject(e.target.error);
    });
  }

  async _withReady(fn) {
    if (!this.db) await this.initPromise;
    return fn();
  }

  // Read-through cache: always loads from local IndexedDB
  async get(store, key) {
    return this._withReady(() =>
      new Promise((resolve, reject) => {
        const req = this.db.transaction(store).objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
      })
    );
  }

  async getAll(store, indexName) {
    return this._withReady(() =>
      new Promise((resolve, reject) => {
        const req = indexName
          ? this.db.transaction(store).objectStore(store).index(indexName).getAll()
          : this.db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = e => reject(e.target.error);
      })
    );
  }

  // Transactional put; can be rolled back by deleting the entry
  async put(store, value) {
    return this._withReady(() =>
      new Promise((resolve, reject) => {
        const tx = this.db.transaction(store, 'readwrite');
        tx.oncomplete = () => resolve(true);
        tx.onerror = e => reject(e.target.error);
        tx.objectStore(store).put(value);
        this._emit(store, { type: 'put', value });
      })
    );
  }

  // Queue a write when offline, or write + sync if online
  async queueWrite(store, value) {
    if (this.isOnline) {
      try {
        await this.put(store, value);
        await this._syncToServer(store, value);
      } catch (err) {
        // Network error or conflict: Queue for retry
        this.offlineQueue.push({ store, value, tryCount: 0 });
        this._emit(store, { type: 'queued-write', value });
      }
    } else {
      this.offlineQueue.push({ store, value, tryCount: 0 });
      await this.put(store, value);
      this._emit(store, { type: 'queued-write', value });
    }
  }

  // Retry logic with exponential backoff
  async _flushQueue() {
    this.isOnline = true;
    let failures = [];
    this._emit('system', { type: 'begin-flush', queue: this.offlineQueue.length });
    for (const job of this.offlineQueue) {
      try {
        await this.put(job.store, job.value); // idempotent write
        await this._syncToServer(job.store, job.value);
        job.tryCount = 0;
      } catch (e) {
        job.tryCount += 1;
        failures.push(job);
      }
    }
    this.offlineQueue = failures;
    if (failures.length > 0) {
      this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
      this.retryTimeout = setTimeout(() => this._flushQueue(), this.backoff);
    } else {
      this.backoff = 1000; // reset
      this.retryTimeout = null;
    }
    this._emit('system', { type: 'end-flush', failures });
  }

  // Stub for server sync, with basic conflict handling
  async _syncToServer(store, value) {
    // Conflict resolution can be last-write-wins, timestamp, or merge
    return Promise.resolve();
  }

  // Subscribe to changes (event-driven)
  onChange(store, callback) {
    if (!this.changeListeners.has(store)) this.changeListeners.set(store, []);
    this.changeListeners.get(store).push(callback);
  }
  _emit(store, payload) {
    if (this.changeListeners.has(store)) {
      this.changeListeners.get(store).forEach(cb => cb(payload));
    }
  }

  // Example referential integrity: delete all orders for a product
  async deleteProductWithOrders(productId) {
    return this._withReady(() => new Promise((resolve, reject) => {
      const tx = this.db.transaction(['products', 'orders'], 'readwrite');
      tx.objectStore('products').delete(productId);
      const ordersStore = tx.objectStore('orders');
      const req = ordersStore.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          const order = cursor.value;
          if (order.items && order.items.some(item => item.id === productId))
            ordersStore.delete(order.id);
          cursor.continue();
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = reject;
    }));
  }
}
