class OrderManager {
  constructor(dataStore) {
    this.ds = dataStore;
    this.cart = [];
    this.total = 0;
  }

  // product search/filter for items
  async loadCatalog(query = "") {
    return new Promise((resolve, reject) => {
      const tx = this.ds.db.transaction("products");
      const store = tx.objectStore("products");
      const items = [];
      store.openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          // Search by name, case-insensitive match
          if (!query || cursor.value.name.toLowerCase().includes(query.trim().toLowerCase())) {
            items.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      store.openCursor().onerror = reject;
    });
  }

  // Cart management
  addToCart(product, customization = {}, options = {}) {
    // Check if already in cart (same product + customization)
    const existing = this.cart.find(item =>
      item.id === product.id &&
      JSON.stringify(item.customization) === JSON.stringify(customization)
    );
    if (existing) {
      existing.qty += 1;
    } else {
      this.cart.push({ ...product, customization, qty: 1, ...options });
    }
    this._updateTotals();
  }

  updateQty(productId, qty, customization = {}) {
    const item = this.cart.find(
      i => i.id === productId && JSON.stringify(i.customization) === JSON.stringify(customization)
    );
    if (item) {
      item.qty = qty;
      if (item.qty <= 0) {
        this.cart = this.cart.filter(i => i !== item);
      }
      this._updateTotals();
    }
  }

  removeFromCart(productId, customization = {}) {
    this.cart = this.cart.filter(
      item => !(item.id === productId && JSON.stringify(item.customization) === JSON.stringify(customization))
    );
    this._updateTotals();
  }

  // Cart "special requests" per item
  updateSpecialRequest(productId, note, customization = {}) {
    const item = this.cart.find(
      i => i.id === productId && JSON.stringify(i.customization) === JSON.stringify(customization)
    );
    if (item) {
      item.specialRequest = note;
    }
  }

  // Calculates and updates cart totals
  _updateTotals() {
    this.total = this.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  // Places an order and returns immediately for UI
  async placeOrder() {
    if (this.cart.length === 0) throw new Error("Cart is empty.");
    const order = {
      id: Date.now().toString(), // unique/order ID
      items: this.cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        customization: item.customization,
        specialRequest: item.specialRequest || "",
      })),
      total: this.total,
      status: "pending", // Order lifecycle: pending → preparing → ready → completed
      createdAt: new Date().toISOString()
    };
    // Optimistically update UI
    this.cart = [];
    this.total = 0;

    // Store order locally (offline-first, queued for sync)
    await this.ds.queueWrite("orders", order);
    return order;
  }

  // Order status tracking: Updates local order status
  async updateOrderStatus(orderId, newStatus) {
    const order = await this.ds.get("orders", orderId);
    if (order) {
      order.status = newStatus;
      await this.ds.put("orders", order);
    }
    return order;
  }

  // List all orders by status
  async listOrders(status = "") {
    return new Promise((resolve, reject) => {
      const tx = this.ds.db.transaction("orders");
      const store = tx.objectStore("orders");
      const items = [];
      store.openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (!status || cursor.value.status === status) {
            items.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      store.openCursor().onerror = reject;
    });
  }
}
