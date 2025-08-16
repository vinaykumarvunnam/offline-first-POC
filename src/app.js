document.addEventListener("DOMContentLoaded", async () => {
  const dataStore = new OfflineDataStore();
  await dataStore._init();

  // Insert some demo products if the DB is empty
  const sampleProducts = [
    { id: "1", name: "Burger", price: 5.99 },
    { id: "2", name: "Fries", price: 2.99 },
    { id: "3", name: "Soda", price: 1.99 },
    { id: "4", name: "Pizza", price: 8.99 },
    { id: "5", name: "Salad", price: 4.49 },
    { id: "6", name: "Juice", price: 2.49 },
    { id: "7", name: "Hot Dog", price: 3.99 },
    { id: "8", name: "Ice Cream", price: 2.99 },
    { id: "9", name: "Coffee", price: 1.49 },
  ];
  for (let p of sampleProducts) {
    if (!(await dataStore.get("products", p.id))) {
      await dataStore.put("products", p);
    }
  }

  const orderManager = new OrderManager(dataStore);
  const printManager = new PrintJobManager(dataStore);
  const syncEngine = new SyncEngine(dataStore, "https://api.example.com");

  const catalogEl = document.getElementById("catalog");
  const cartItemsEl = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  const searchEl = document.getElementById("search");
  const statusEl = document.getElementById("status");
  const loaderEl = document.getElementById("sync-loader");


  let statusTimeout = null;

  syncEngine.on("sync-start", ({ store }) => {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusEl.textContent = `Syncing ${store}…`;
    statusEl.style.color = "yellow";
    loaderEl.style.display = "inline-block";
  });

  syncEngine.on("sync-success", ({ store }) => {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusEl.textContent = `Up-to-date (${store})`;
    statusEl.style.color = "lightgreen";
    statusTimeout = setTimeout(() => {
      loaderEl.style.display = "none";
    }, 2000);
  });

  syncEngine.on("sync-error", ({ store }) => {
    if (statusTimeout) clearTimeout(statusTimeout);
    statusEl.textContent = `Sync error for ${store}`;
    statusEl.style.color = "red";
    statusTimeout = setTimeout(() => {
      loaderEl.style.display = "none";
    }, 2000);
  });

  function renderCatalog(products) {
    catalogEl.innerHTML = "";
    products.forEach((prod) => {
      const div = document.createElement("div");
      div.className = "product";
      div.textContent = `${prod.name} - $${prod.price.toFixed(2)}`;
      div.addEventListener("click", () => {
        orderManager.addToCart(prod);
        renderCart();
      });
      catalogEl.appendChild(div);
    });
  }

  function renderCart() {
    cartItemsEl.innerHTML = "";
    orderManager.cart.forEach((item) => {
      const div = document.createElement("div");
      div.textContent = `${item.name} x${item.qty} - $${(
        item.price * item.qty
      ).toFixed(2)}`;
      cartItemsEl.appendChild(div);
    });
    totalEl.textContent = `Total: $${orderManager.total.toFixed(2)}`;
  }

  searchEl.addEventListener("input", async () => {
    const products = await orderManager.loadCatalog(searchEl.value);
    renderCatalog(products);
  });

  document.getElementById("place-order").addEventListener("click", async () => {
    const order = await orderManager.placeOrder();
    await printManager.addJob("receipt", order, 1);
    renderCart();
    alert("Order placed!");
    syncEngine.syncStore("orders");
  });

  window.addEventListener("online", () => {
    syncEngine.syncStore("orders");
  });
  window.addEventListener("offline", () => {
    statusEl.textContent = "Offline";
    statusEl.style.color = "orange";
  });

  // Initial render
  renderCatalog(await orderManager.loadCatalog());
  renderCart();
  syncEngine.syncStore("orders");


  setTimeout(async () => {
    // Assume you know the order id (e.g. the one just placed)
    const ORDERS = await dataStore.getAll('orders');
    if (ORDERS.length) {
      // Let's simulate updating the first order in the DB
      const order = ORDERS[0];
      order.status = 'preparing';
      order.updatedAt = Date.now();
      await dataStore.put('orders', order);
  
      // Trigger UI refresh if needed
      updateOrderStatusUI(order);
    }
  }, 10000);

  dataStore.onChange('orders', (payload) => {
    // Re-fetch changed order and update display/UI
    dataStore.get('orders', payload.value.id).then(order => {
      if (order) updateOrderStatusUI(order);
    });
  });

  function updateOrderStatusUI(order) {
    const statusDiv = document.getElementById('order-status');
    if (statusDiv && order) {
      statusDiv.textContent = `Order ${order.id} status: ${order.status}`;
    }
  }
});
