import "fake-indexeddb/auto";
import "../OfflineDataStore.js";
import "../PrintJobManager.js";

let ds, pm;

beforeEach(async () => {
  ds = new OfflineDataStore("testDB", 1);
  await ds._init();
  pm = new PrintJobManager(ds);
});

afterEach(() => {
  indexedDB.deleteDatabase("testDB");
});

test("adds and processes print job", async () => {
  await pm.addJob("receipt", { text: "Hello" }, 1);
  const tx = ds.db.transaction("printJobs");
  const store = tx.objectStore("printJobs");
  const req = store.getAll();
  req.onsuccess = () => {
    expect(req.result.length).toBeGreaterThan(0);
  };
});

test("retries failed job", async () => {
  pm._sendToPrinter = () => Promise.reject("printer fail");
  await pm.addJob("receipt", {}, 1);
  expect(pm.queue.length).toBe(1);
});
