const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => Number(n || 0).toLocaleString("en-US") + " ₭";

let session = null, items = [], cat = "", q = "";
const isAdmin = () => !!session;

// ===== ກະຕ່າສິນຄ້າ (localStorage) =====
let cart = [];
try { cart = JSON.parse(localStorage.getItem("cart") || "[]"); } catch { cart = []; }
function cartSave() { localStorage.setItem("cart", JSON.stringify(cart)); renderCartCount(); }
function cartCount() { return cart.reduce((n, i) => n + i.qty, 0); }
function renderCartCount() { const el = $("#cart-count"); if (el) el.textContent = cartCount(); }
function stockLeft(productId) {
  const p = items.find((x) => x.id === productId);
  return p ? Number(p.quantity ?? 0) : 0;
}
function addToCart(p) {
  const max = Number(p.quantity ?? 0);
  if (max < 1) return toast("ສິນຄ້າໝົດແລ້ວ", true);
  const row = cart.find((i) => i.id === p.id);
  if (row) {
    if (row.qty >= max) return toast("ມີໃນສະຕ໋ອກພຽງ " + max + " ອັນ", true);
    row.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: p.price, photo_url: p.photo_url, qty: 1 });
  }
  cartSave(); toast("ເພີ່ມໃສ່ກະຕ່າແລ້ວ");
}
function cartChangeQty(id, delta) {
  const row = cart.find((i) => i.id === id);
  if (!row) return;
  const max = stockLeft(id);
  row.qty += delta;
  if (row.qty > max) { row.qty = max; toast("ມີໃນສະຕ໋ອກພຽງ " + max + " ອັນ", true); }
  if (row.qty < 1) cart = cart.filter((i) => i.id !== id);
  cartSave(); openCart();
}
function cartRemove(id) { cart = cart.filter((i) => i.id !== id); cartSave(); openCart(); }
function cartTotal() { return cart.reduce((n, i) => n + i.price * i.qty, 0); }

function openCart() {
  const m = dialog(`<h2>ກະຕ່າສິນຄ້າ</h2>
    ${cart.length ? `
      <div class="cart-list">${cart.map((i) => `
        <div class="cart-row">
          ${i.photo_url ? `<img src="${esc(i.photo_url)}" alt="">` : `<div class="ph2">🦋</div>`}
          <div class="cn"><h4>${esc(i.name)}</h4><small>${money(i.price)} / ອັນ</small></div>
          <div class="stepper">
            <button type="button" data-dec="${i.id}">−</button><span>${i.qty}</span><button type="button" data-inc="${i.id}">+</button>
          </div>
          <button class="danger" type="button" data-rm="${i.id}">ລົບ</button>
        </div>`).join("")}</div>
      <div class="cart-total"><span>ລວມ</span><span>${money(cartTotal())}</span></div>
      <div class="foot"><button type="button" data-close>ສືບຕໍ່ຊື້</button><button class="primary" type="button" id="go-checkout">ສັ່ງຊື້</button></div>
    ` : `<div class="cart-empty">ກະຕ່າວ່າງເປົ່າ</div><div class="foot"><button type="button" data-close>ປິດ</button></div>`}`);
  m.querySelectorAll("[data-inc]").forEach((b) => (b.onclick = () => cartChangeQty(b.dataset.inc, 1)));
  m.querySelectorAll("[data-dec]").forEach((b) => (b.onclick = () => cartChangeQty(b.dataset.dec, -1)));
  m.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => cartRemove(b.dataset.rm)));
  m.querySelector("#go-checkout")?.addEventListener("click", () => checkoutForm());
}

function checkoutForm() {
  const m = dialog(`<h2>ຂໍ້ມູນຈັດສົ່ງ</h2>
    <form class="form">
      <label>ຊື່ຜູ້ສັ່ງ<input name="name" required></label>
      <label>ເບີໂທ<input name="phone" required inputmode="tel"></label>
      <label>ທີ່ຢູ່ຈັດສົ່ງ<textarea name="address" rows="2"></textarea></label>
      <label>ໝາຍເຫດ<textarea name="note" rows="2"></textarea></label>
      <div class="cart-total"><span>ລວມ</span><span>${money(cartTotal())}</span></div>
      <div class="foot"><button type="button" data-close>ກັບຄືນ</button><button class="primary" type="submit">ຢືນຢັນສັ່ງຊື້</button></div>
    </form>`);
  m.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = m.querySelector("button[type=submit]"); submitBtn.disabled = true;
    const p_customer = { name: fd.get("name").trim(), phone: fd.get("phone").trim(), address: fd.get("address").trim(), note: fd.get("note").trim() };
    const p_items = cart.map((i) => ({ product_id: i.id, quantity: i.qty }));
    const { data, error } = await sb.rpc("place_order", { p_customer, p_items });
    if (error) { submitBtn.disabled = false; return toast(error.message.replace(/^.*?: /, ""), true); }
    cart = []; cartSave();
    m.innerHTML = `<div class="order-ok"><div class="big-tick">✅</div><h2>ສັ່ງຊື້ສຳເລັດ!</h2>
      <p>ເລກທີ່ອໍເດີ: ${String(data).slice(0, 8)}</p><p>ຂອບໃຈ! ພວກເຮົາຈະຕິດຕໍ່ກັບທ່ານໄວໆນີ້.</p>
      <div class="foot"><button class="primary" data-close>ປິດ</button></div></div>`;
    m.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => m.close()));
    load();
  };
}

function toast(msg, err = false) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 3000);
}
function dialog(html) {
  const m = $("#modal"); m.innerHTML = html; m.showModal();
  m.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => m.close()));
  return m;
}

async function load() {
  const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
  if (error) return toast(error.message, true);
  items = data; draw();
}

function draw() {
  const cats = [...new Set(items.map((p) => p.category).filter(Boolean))];
  if (cat && !cats.includes(cat)) cat = "";
  $("#cats").innerHTML = cats.length
    ? [["", "ທັງໝົດ"], ...cats.map((c) => [c, c])].map(([v, l]) => `<button data-cat="${esc(v)}" class="${v === cat ? "on" : ""}">${esc(l)}</button>`).join("")
    : "";
  $("#cats").querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { cat = b.dataset.cat; draw(); }));

  const s = q.trim().toLowerCase();
  const shown = items.filter((p) => (!cat || p.category === cat) && (!s || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(s)));
  $("#grid").innerHTML = shown.length ? shown.map((p) => `
    <article class="card ${p.in_stock ? "" : "out"} ${p.is_visible ? "" : "hid"}">
      <div class="ph" data-view="${p.id}">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="${esc(p.name)}" loading="lazy">` : "🦋"}
        ${p.in_stock ? "" : `<span class="tag">ໝົດແລ້ວ</span>`}${p.is_visible ? "" : `<span class="tag">ເຊື່ອງຢູ່</span>`}</div>
      <div class="info"><h3>${esc(p.name)}</h3><p class="price">${money(p.price)}</p><p class="qty">ຈຳນວນ: ${esc(p.quantity ?? 0)}</p></div>
      ${p.is_visible && p.in_stock && (p.quantity ?? 0) > 0 ? `<div class="buy"><button class="primary" data-buy="${p.id}">🛒 ເພີ່ມໃສ່ກະຕ່າ</button></div>` : ""}
      ${isAdmin() ? `<div class="adm"><button data-edit="${p.id}">ແກ້ໄຂ</button><button class="danger" data-del="${p.id}">ລົບ</button></div>` : ""}
    </article>`).join("") : `<div class="empty">${items.length ? "ບໍ່ພົບສິນຄ້າ" : "ຍັງບໍ່ມີສິນຄ້າ"}</div>`;

  const find = (id) => items.find((p) => p.id === id);
  document.querySelectorAll("[data-view]").forEach((e) => (e.onclick = () => view(find(e.dataset.view))));
  document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => form(find(b.dataset.edit))));
  document.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => addToCart(find(b.dataset.buy))));
  document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    if (!confirm("ລົບສິນຄ້ານີ້?")) return;
    const { error } = await sb.from("products").delete().eq("id", b.dataset.del);
    if (error) return toast(error.message, true);
    toast("ລົບແລ້ວ"); load();
  }));
}

function view(p) {
  const dialogEl = dialog(`${p.photo_url ? `<img class="big" src="${esc(p.photo_url)}" alt="${esc(p.name)}">` : ""}
    <h2>${esc(p.name)}</h2><p class="price">${money(p.price)}${p.in_stock ? "" : " · ໝົດແລ້ວ"}</p>
    <p>ຈຳນວນຄົງເຫຼືອ: ${esc(p.quantity ?? 0)}</p>
    ${p.category ? `<small>${esc(p.category)}</small>` : ""}
    <p style="white-space:pre-line">${esc(p.description)}</p>
    <div class="foot">
      ${p.is_visible && p.in_stock && (p.quantity ?? 0) > 0 ? `<button class="primary" id="view-buy">🛒 ເພີ່ມໃສ່ກະຕ່າ</button>` : ""}
      <button data-close>ປິດ</button>
    </div>`);
  dialogEl.querySelector("#view-buy")?.addEventListener("click", () => addToCart(p));
}

function form(p = {}) {
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const m = dialog(`<h2>${p.id ? "ແກ້ໄຂ" : "ເພີ່ມ"}ສິນຄ້າ</h2>
    <form class="form">
      <label>ຊື່ສິນຄ້າ<input name="name" required value="${esc(p.name)}"></label>
      <label>ລາຄາ (ກີບ)<input name="price" type="number" min="0" step="any" required value="${esc(p.price ?? 0)}"></label>
      <label>ຈຳນວນ (ຄົງເຫຼືອ)<input name="quantity" type="number" min="0" step="1" required value="${esc(p.quantity ?? 0)}"></label>
      <label>ໝວດໝູ່<input name="category" list="catlist" value="${esc(p.category)}"></label>
      <datalist id="catlist">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      <label>ລາຍລະອຽດ<textarea name="description" rows="3">${esc(p.description)}</textarea></label>
      <label>ຮູບພາບ<input name="photo" type="file" accept="image/*"></label>
      <label class="chk"><input type="checkbox" name="in_stock" ${p.in_stock === false ? "" : "checked"}>ມີສິນຄ້າ</label>
      <label class="chk"><input type="checkbox" name="is_visible" ${p.is_visible === false ? "" : "checked"}>ສະແດງໃຫ້ຜູ້ເຂົ້າຊົມເຫັນ</label>
      <div class="foot"><button type="button" data-close>ຍົກເລີກ</button><button class="primary" type="submit">ບັນທຶກ</button></div>
    </form>`);
  m.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rec = {
      name: fd.get("name").trim(), price: Number(fd.get("price")), quantity: Number(fd.get("quantity")),
      category: fd.get("category").trim() || null, description: fd.get("description").trim() || null,
      in_stock: fd.has("in_stock"), is_visible: fd.has("is_visible"),
    };
    const file = fd.get("photo");
    if (file && file.size) {
      const path = `${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const up = await sb.storage.from("product-photos").upload(path, file);
      if (up.error) return toast("ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: " + up.error.message, true);
      rec.photo_url = sb.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await (p.id ? sb.from("products").update(rec).eq("id", p.id) : sb.from("products").insert(rec));
    if (error) return toast(error.message, true);
    m.close(); toast("ບັນທຶກແລ້ວ"); load();
  };
}

function renderAuth() {
  $("#auth").innerHTML = isAdmin()
    ? `<small>${esc(session.user.email)}</small><button id="logout">ອອກຈາກລະບົບ</button>`
    : `<button id="login">ເຂົ້າສູ່ລະບົບ</button>`;
  $("#add").hidden = !isAdmin();
  const posLink = $("#pos-link"); if (posLink) posLink.hidden = !isAdmin();
  $("#login")?.addEventListener("click", () => {
    const m = dialog(`<h2>ເຂົ້າສູ່ລະບົບ</h2><form class="form">
      <label>ອີເມວ<input type="email" name="email" required autocomplete="username"></label>
      <label>ລະຫັດຜ່ານ<input type="password" name="password" required autocomplete="current-password"></label>
      <div class="foot"><button type="button" data-close>ຍົກເລີກ</button><button class="primary" type="submit">ເຂົ້າສູ່ລະບົບ</button></div></form>`);
    m.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const { error } = await sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
      if (error) return toast("ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ", true);
      m.close(); toast("ເຂົ້າສູ່ລະບົບສຳເລັດ");
    };
  });
  $("#logout")?.addEventListener("click", () => sb.auth.signOut());
}

$("#add").onclick = () => form();
$("#q").oninput = (e) => { q = e.target.value; draw(); };
$("#cart-btn").onclick = () => openCart();
renderCartCount();
sb.auth.onAuthStateChange((_e, s) => { session = s; renderAuth(); load(); });
