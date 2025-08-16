import "fake-indexeddb/auto";
import "../OfflineDataStore.js";
import "../SyncEngine.js";

let ds, se;

beforeEach(async () => {
  global.fetch = jest.fn();
  ds = new OfflineDataStore("testDB", 1);
  await ds._init();
  se = new SyncEngine(ds, "https://api.example.com");
});

afterEach(() => {
  indexedDB.deleteDatabase("testDB");
  jest.clearAllMocks();
});

test("uploads local changes", async () => {
  await ds.put("orders", { id: "o1", updatedAt: new Date().toISOString() });
  fetch.mockResolvedValueOnce({ json: () => Promise.resolve([]) });
  await se.syncStore("orders");
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/orders"),
    expect.any(Object)
  );
});

test("downloads remote updates", async () => {
  fetch
    .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
    .mockResolvedValueOnce({
      json: () =>
        Promise.resolve([{ id: "o2", updatedAt: new Date().toISOString() }]),
    });
  await se.syncStore("orders");
  const val = await ds.get("orders", "o2");
  expect(val).toBeTruthy();
});

test("emits sync events", async () => {
  const events = [];
  se.on("sync-start", () => events.push("start"));
  se.on("sync-success", () => events.push("success"));
  fetch
    .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
    .mockResolvedValueOnce({ json: () => Promise.resolve([]) });
  await se.syncStore("orders");
  expect(events).toEqual(expect.arrayContaining(["start", "success"]));
});
