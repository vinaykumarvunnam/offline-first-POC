# offline-first-POC
<img width="371" height="451" alt="Screenshot 2025-08-16 at 12 44 33 PM" src="https://github.com/user-attachments/assets/65dcd01f-94e9-431e-8910-6e87f03ebb2b" />

# Features
Offline-First with IndexedDB storage and smart sync queue

Order Management: Product catalog, cart, order customization (size, add-ons, special requests), status tracking (pending → preparing → ready → completed)

Print Queue: Multiple destinations (receipt, kitchen, bar), template-based formatting, retries, and job persistence

Inventory and Data Sync: Bidirectional, partial dataset sync with REST API, handles concurrent edits

Touch-First UI: Responsive for tablet/mobile. Optimistic UI updates for instant feedback

Performance: Handles 1,000+ product catalogs, sub-100ms cart ops

Test Suite: Jest tests for all core modules and basic UI
