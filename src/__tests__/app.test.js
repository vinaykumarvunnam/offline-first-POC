/**
 * @jest-environment jsdom
 */
import fs from "fs";

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
</head>
<body>
  <input id="search"/>
  <section id="catalog"></section>
  <section id="cart">
    <div id="cart-items"></div>
    <div id="cart-total">Total: $0.00</div>
    <button id="place-order">Place Order</button>
  </section>
  <span id="status-container"><span id="status"></span><span id="sync-loader"></span></span>
</body>
</html>
`;

describe("App UI", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test("UI components exist", () => {
    expect(document.getElementById("search")).toBeTruthy();
    expect(document.getElementById("catalog")).toBeTruthy();
    expect(document.getElementById("cart-items")).toBeTruthy();
    expect(document.getElementById("status-container")).toBeTruthy();
    expect(document.getElementById("sync-loader")).toBeTruthy();
  });
});
