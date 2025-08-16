class SyncEngine {
  constructor(dataStore, apiBase) {
    this.ds = dataStore;
    this.apiBase = apiBase;
    this.lastSync = {};
    this.listeners = {};
    // Keep local change cache for fast detection
    this.localChangeCache = {};
  }

  // Event subscription for status updates
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  _emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // Main sync routine
  async syncStore(store) {
    this._emit("sync-start", { store });

    const lastSyncTime = this.lastSync[store] || 0;
    try {
      // 1. Detect local changes since last sync
      const localChanges = await this._getLocalChanges(store, lastSyncTime);

      // 2. Upload (push) local changes
      for (let item of localChanges) {
        await fetch(`${this.apiBase}/${store}`, {
          method: "POST",
          body: JSON.stringify(item),
          headers: { "Content-Type": "application/json" }
        });
      }

      // 3. Download (pull) server changes (partial sync)
      const res = await fetch(`${this.apiBase}/${store}?since=${lastSyncTime}`);
      const serverData = await res.json();

      // 4. Handle concurrent modifications
      for (let remoteRecord of serverData) {
        const localRecord = await this.ds.get(store, remoteRecord.id);
        if (!localRecord || (remoteRecord.updatedAt > (localRecord.updatedAt || 0))) {
          // Apply server record if newer
          await this.ds.put(store, remoteRecord);
        } else if (localRecord && localRecord.updatedAt > remoteRecord.updatedAt) {
          // Local is newer: push update back up later, or mark a conflict
          // For simplicity: push local version up (last-write-wins). 
          // For more advanced: flag for manual conflict resolution.
          await fetch(`${this.apiBase}/${store}`, {
            method: "POST",
            body: JSON.stringify(localRecord),
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // 5. Update local last sync time
      this.lastSync[store] = Date.now();
      this._emit("sync-success", { store, lastSync: this.lastSync[store] });

    } catch (err) {
      this._emit("sync-error", { store, error: err });
    }
  }

  // Detect local changes since last sync: checks updatedAt timestamp
  async _getLocalChanges(store, since) {
    return new Promise((resolve) => {
      const tx = this.ds.db.transaction(store);
      const storeObj = tx.objectStore(store);
      const result = [];
      storeObj.openCursor().onsuccess = e => {
        const c = e.target.result;
        if (c) {
          const updated = new Date(c.value.updatedAt || 0).getTime();
          if (updated > since) {
            result.push(c.value);
          }
          c.continue();
        } else {
          resolve(result);
        }
      };
    });
  }
}
