/**
 * @jest-environment jsdom
 */
import "fake-indexeddb/auto";

import "../OfflineDataStore.js";

let ds;

beforeEach(async () => {
  ds = new OfflineDataStore("testDB", 1);
  await ds._init();
});

afterEach(() => {
  indexedDB.deleteDatabase("testDB");
});

test("stores and retrieves data", async () => {
  const product = { id: "p1", name: "Test Product" };
  await ds.put("products", product);
  const fetched = await ds.get("products", "p1");
  expect(fetched).toEqual(product);
});

test("queues writes when offline", async () => {
  ds.isOnline = false;
  await ds.queueWrite("products", { id: "p2", name: "Offline Product" });
  expect(ds.offlineQueue.length).toBe(1);
  const local = await ds.get("products", "p2");
  expect(local.name).toBe("Offline Product");
});

test("flushes queue when back online", async () => {
  ds.isOnline = false;
  await ds.queueWrite("products", { id: "p3", name: "Queued" });
  ds.isOnline = true;
  await ds._flushQueue();
  expect(ds.offlineQueue.length).toBe(0);
});
