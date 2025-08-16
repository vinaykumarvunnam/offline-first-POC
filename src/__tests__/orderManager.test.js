import "fake-indexeddb/auto";
import "../OfflineDataStore.js";
import "../OrderManager.js";

let ds, om;

beforeEach(async () => {
  ds = new OfflineDataStore("testDB", 1);
  await ds._init();
  await ds.put("products", { id: "p1", name: "Burger", price: 5 });
  om = new OrderManager(ds);
});

afterEach(() => {
  indexedDB.deleteDatabase("testDB");
});

test("loads catalog", async () => {
  const products = await om.loadCatalog();
  expect(products.length).toBe(1);
});

test("adds to cart and updates total", () => {
  om.addToCart({ id: "p1", price: 5 });
  expect(om.cart.length).toBe(1);
  expect(om.total).toBe(5);
});

test("updates quantity", () => {
  om.addToCart({ id: "p1", price: 5 });
  om.updateQty("p1", 3);
  expect(om.total).toBe(15);
});

test("places order and clears cart", async () => {
  om.addToCart({ id: "p1", price: 5 });
  const order = await om.placeOrder();
  expect(order.status).toBe("pending");
  expect(om.cart.length).toBe(0);
});
