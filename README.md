# offline-first-POC

src/
├── __tests__/
│   ├── app.test.js
│   ├── offlineDataStore.test.js
│   ├── orderManager.test.js
│   ├── printJobManager.test.js
│   └── syncEngine.test.js
├── index.html
├── styles.css
├── app.js
├── OfflineDataStore.js
├── OrderManager.js
├── PrintJobManager.js
└── SyncEngine.js


Features
Offline-First with IndexedDB storage and smart sync queue

Order Management: Product catalog, cart, order customization (size, add-ons, special requests), status tracking (pending → preparing → ready → completed)

Print Queue: Multiple destinations (receipt, kitchen, bar), template-based formatting, retries, and job persistence

Inventory and Data Sync: Bidirectional, partial dataset sync with REST API, handles concurrent edits

Touch-First UI: Responsive for tablet/mobile. Optimistic UI updates for instant feedback

Performance: Handles 1,000+ product catalogs, sub-100ms cart ops

Test Suite: Jest tests for all core modules and basic UI
