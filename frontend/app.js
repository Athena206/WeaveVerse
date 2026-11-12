"use strict";

const root = document.getElementById("app");
const apiBase = "/api";
const storageKeys = {
  cart: "fsc-cart",
  customer: "fsc-customer",
  theme: "fsc-theme",
  token: "fsc-token",
};

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch (error) {
    console.warn(`Saved ${key} could not be read.`, error);
    return fallback;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the store. Start Flask and check MySQL.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `The request failed (${response.status}).`);
  }
  return body;
}

function routeFromHash() {
  const hash = window.location.hash.slice(1) || "home";
  if (hash.startsWith("product/")) {
    return { page: "product", productId: Number(hash.split("/")[1]) };
  }
  const [page, filter] = hash.split("/");
  if (page === "shop" && filter) {
    try {
      return { page, fabric: decodeURIComponent(filter) };
    } catch {
      return { page };
    }
  }
  return {
    page: ["shop", "contact", "login", "register", "account"].includes(page)
      ? page
      : "home",
  };
}

const state = {
  route: routeFromHash(),
  products: [],
  catalogError: "",
  productError: "",
  cart: readStorage(storageKeys.cart, []),
  token: localStorage.getItem(storageKeys.token) || "",
  customer: readStorage(storageKeys.customer, null),
  orders: [],
  ordersLoading: false,
  reviews: {},
  reviewsError: "",
  cartOpen: false,
  busy: false,
  authError: "",
  reviewMessage: "",
  reviewBusy: false,
  theme: localStorage.getItem(storageKeys.theme)
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  notice: "",
  catalog: {
    search: "",
    fabric: routeFromHash().fabric || "All fabrics",
    region: "All regions",
    occasion: "All occasions",
    sort: "newest",
  },
  quantity: 1,
  rating: 5,
};

let noticeTimer;

function showNotice(message) {
  state.notice = message;
  window.clearTimeout(noticeTimer);
  render();
  noticeTimer = window.setTimeout(() => {
    state.notice = "";
    render();
  }, 3200);
}

function imageUrl(filename) {
  return `/uploads/${encodeURIComponent(filename)}`;
}

function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect x="1" y="1" width="62" height="62" rx="20" fill="#24362e"></rect>
    <path d="M14 20.5 22.4 44l9.6-18.2L41.6 44 50 20.5" fill="none" stroke="#e8d4a8" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2"></path>
    <path d="M17.5 31.7c4.2-3.1 8.9-4.6 14.5-4.6s10.3 1.5 14.5 4.6M18.5 37c3.9-2.2 8.4-3.3 13.5-3.3s9.6 1.1 13.5 3.3" fill="none" stroke="#c49a5a" stroke-linecap="round" stroke-width="1.8"></path>
    <circle cx="32" cy="14" r="1.6" fill="#e8d4a8"></circle>
  </svg>`;
}

function brandLink(extraClass = "") {
  return `<a class="brand ${extraClass}" href="#home" aria-label="WeaveVerse home">
    ${brandMark()}<span class="brand-name">WeaveVerse<small>WEAVES THAT TELL STORIES</small></span>
  </a>`;
}

function pageHeader() {
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const accountAction = state.customer
    ? `<a class="text-button account-button" href="#account">Hi, ${escapeHTML(state.customer.first_name)}</a>
       <button class="text-button sign-out-button" data-action="sign-out">Sign out</button>`
    : `<a class="text-button account-button" href="#login">Sign in</a>`;
  return `<header class="site-header">
    ${brandLink()}
    <nav class="main-nav" aria-label="Main navigation">
      <a class="${state.route.page === "home" ? "active" : ""}" href="#home">Home</a>
      <a class="${state.route.page === "shop" ? "active" : ""}" href="#shop">Shop</a>
      <a href="#contact">Contact Us</a>
    </nav>
    <div class="header-actions">
      ${accountAction}
      <button class="theme-button" data-action="theme" aria-label="Switch to ${state.theme === "light" ? "dark" : "light"} mode" title="Switch to ${state.theme === "light" ? "dark" : "light"} mode">${state.theme === "light" ? "☾" : "☀"}</button>
      <button class="bag-button" data-action="open-cart" aria-label="Open shopping bag, ${cartCount} items">Bag <span>${cartCount}</span></button>
    </div>
  </header>`;
}

function errorMessage(message, retry = false) {
  return `<div class="error-message" role="alert"><p>${escapeHTML(message)}</p>${retry ? '<button class="text-button" data-action="retry">Try again</button>' : ""}</div>`;
}

function productCard(product) {
  const ratingBadge = product.review_count > 0
    ? `<span class="product-badge">★ ${Number(product.average_rating).toFixed(1)} · ${product.review_count} REVIEWS</span>`
    : "";
  const stockLabel = product.review_count
    ? `★ ${Number(product.average_rating).toFixed(1)} · ${product.review_count}`
    : product.stock > 0 ? "In stock" : "Sold out";
  return `<article class="product-card">
    <a class="product-image" href="#product/${product.product_id}">
      <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.saree_name)} styling inspiration" loading="lazy">
      <span class="editorial-tag">STYLE INSPIRATION</span>${ratingBadge}<span class="image-arrow">↗</span>
    </a>
    <div class="product-info">
      <div class="product-meta"><span>${escapeHTML(product.fabric)} · ${escapeHTML(product.weave)}</span><span>${escapeHTML(product.region)}</span></div>
      <div class="product-title-row"><a href="#product/${product.product_id}"><h3>${escapeHTML(product.saree_name)}</h3></a><strong>${money(product.price)}</strong></div>
      <div class="product-bottom"><span>${stockLabel}</span><button data-action="add-cart" data-id="${product.product_id}" ${product.stock < 1 ? "disabled" : ""}>Add to bag <span>+</span></button></div>
    </div>
  </article>`;
}

function productGrid(products) {
  if (!products.length) {
    return `<div class="empty-state"><p>Our first collection is being prepared.</p><p class="muted">Please check back soon.</p></div>`;
  }
  return `<div class="product-grid">${products.map(productCard).join("")}</div>`;
}

function homePage() {
  const fabrics = [...new Set(state.products.map((product) => product.fabric))].slice(0, 8);
  return `<section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">A WORLD WOVEN BY HAND</p>
      <h1>Wear a story.<br><em>Keep a legacy.</em></h1>
      <p class="hero-description">Discover India's timeless sarees, chosen for their craft, colour and the stories woven into every thread.</p>
      <div class="hero-actions"><a class="button button-dark" href="#shop">Explore the collection <span>↗</span></a><a class="text-link" href="#contact">Our story <span>→</span></a></div>
      <div class="hero-note"><span class="note-line"></span> Thoughtfully chosen. Beautifully woven.</div>
    </div>
    <div class="hero-image">
      <img src="${imageUrl("weaveverse-model-01.jpg")}" alt="Model in a richly woven purple silk saree">
      <div class="hero-image-label"><span>THE WEAVEVERSE EDIT</span><span>MADE TO BE KEPT</span></div>
      <div class="hero-stamp">WOVEN<br>WITH<br><em>MEANING</em></div>
    </div>
  </section>
  <section class="promise-strip"><span>✳ Made by skilled hands</span><span>✳ Rooted in Indian craft</span><span>✳ Chosen with care</span><span>✳ Worn for generations</span></section>
  ${state.products.length ? `<section class="fabric-collection" aria-label="Shop by fabric">
    <p class="eyebrow">FIND YOUR FAVOURITE FEEL</p>
    ${fabrics.map((fabric) => `<a class="fabric-tile" href="#shop/${encodeURIComponent(fabric)}">${escapeHTML(fabric)} <span>↗</span></a>`).join("")}
    <a class="fabric-tile fabric-tile-all" href="#shop">All fabrics <span>→</span></a>
  </section>` : ""}
  <section class="section home-collection">
    <div class="section-heading"><div><p class="eyebrow">THE WEAVEVERSE EDIT</p><h2>Woven for <em>your moments</em></h2></div><a class="text-link" href="#shop">View all sarees <span>→</span></a></div>
    ${state.catalogError ? errorMessage(state.catalogError, true) : productGrid(state.products.slice(0, 3))}
  </section>
  <section class="story-band">
    <div class="story-image"><img src="${imageUrl("weaveverse-model-10.jpg")}" alt="Model wearing a deep green handwoven saree" loading="lazy"></div>
    <div class="story-copy"><p class="eyebrow">MORE THAN A SAREE</p><h2>Made by hand.<br><em>Carried forward.</em></h2><p>Every weave holds a place, a person and generations of patient skill. We bring authentic regional craftsmanship into one considered collection—so the story behind your saree is always part of the drape.</p><a class="text-link" href="#contact">Get to know us <span>→</span></a></div>
  </section>
  ${contactSection()}`;
}

function catalogPage() {
  const fabrics = ["All fabrics", ...new Set(state.products.map((product) => product.fabric))];
  const regions = ["All regions", ...new Set(state.products.map((product) => product.region))];
  const occasions = ["All occasions", ...new Set(state.products.map((product) => product.occasion))];
  const filtered = state.products.filter((product) => {
    const searchable = `${product.saree_name} ${product.fabric} ${product.weave} ${product.region} ${product.occasion}`.toLowerCase();
    return searchable.includes(state.catalog.search.toLowerCase())
      && (state.catalog.fabric === "All fabrics" || product.fabric === state.catalog.fabric)
      && (state.catalog.region === "All regions" || product.region === state.catalog.region)
      && (state.catalog.occasion === "All occasions" || product.occasion === state.catalog.occasion);
  }).sort((left, right) => {
    if (state.catalog.sort === "price-asc") return Number(left.price) - Number(right.price);
    if (state.catalog.sort === "price-desc") return Number(right.price) - Number(left.price);
    if (state.catalog.sort === "name") return left.saree_name.localeCompare(right.saree_name);
    return right.product_id - left.product_id;
  });
  return `<section class="page-shell catalog-page">
    <div class="catalog-intro"><div><p class="eyebrow">A THOUGHTFUL COLLECTION</p><h1>Find your <em>forever drape.</em></h1><p>Handloom stories, gathered from the places that make them.</p></div><span class="catalog-count">${filtered.length} of ${state.products.length} sarees</span></div>
    <div class="catalog-tools">
      <div class="category-pills">${fabrics.map((fabric) => `<button class="${state.catalog.fabric === fabric ? "selected" : ""}" data-action="fabric" data-value="${escapeHTML(fabric)}">${escapeHTML(fabric)}</button>`).join("")}</div>
      <label class="search-field"><span>⌕</span><input id="catalog-search" value="${escapeHTML(state.catalog.search)}" placeholder="Search weave, fabric, region..."></label>
    </div>
    <div class="catalog-refine">
      <label>Region<select id="catalog-region">${regions.map((item) => `<option ${state.catalog.region === item ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}</select></label>
      <label>Occasion<select id="catalog-occasion">${occasions.map((item) => `<option ${state.catalog.occasion === item ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}</select></label>
      <label>Sort by<select id="catalog-sort"><option value="newest" ${state.catalog.sort === "newest" ? "selected" : ""}>Featured</option><option value="price-asc" ${state.catalog.sort === "price-asc" ? "selected" : ""}>Price: low to high</option><option value="price-desc" ${state.catalog.sort === "price-desc" ? "selected" : ""}>Price: high to low</option><option value="name" ${state.catalog.sort === "name" ? "selected" : ""}>Name</option></select></label>
    </div>
    ${state.catalogError ? errorMessage(state.catalogError, true) : filtered.length ? productGrid(filtered) : `<div class="empty-state"><p>No sarees found for these filters.</p><button class="text-button" data-action="clear-filters">Clear filters</button></div>`}
  </section>`;
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function productPage(product) {
  const reviews = state.reviews[product.product_id] || [];
  const reviewList = state.reviewsError
    ? errorMessage(state.reviewsError, true)
    : `<div class="review-list">${reviews.map((review) => `<article class="review">
        <div class="review-stars" aria-label="${review.rating} out of 5 stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        <p>${escapeHTML(review.review_text)}</p>
        <span>${escapeHTML(review.first_name)} ${escapeHTML(review.last_name)} · ${new Date(review.created_at).toLocaleDateString("en-IN")}</span>
      </article>`).join("")}</div>`;
  const reviewForm = state.token
    ? `<form class="review-form" data-form="review">
        <label>Your rating<select name="rating">${[5, 4, 3, 2, 1].map((value) => `<option value="${value}" ${state.rating === value ? "selected" : ""}>${value} ${value === 1 ? "star" : "stars"}</option>`).join("")}</select></label>
        <label>Your review<textarea name="review_text" rows="3" maxlength="1200" placeholder="Tell other shoppers what you loved..." required></textarea></label>
        <button class="button button-outline" ${state.reviewBusy ? "disabled" : ""}>${state.reviewBusy ? "Submitting..." : "Share your review"}</button>
        ${state.reviewMessage ? `<p class="form-message" role="status">${escapeHTML(state.reviewMessage)}</p>` : ""}
      </form>`
    : `<p class="review-signin"><a class="text-link" href="#login">Sign in</a> to leave a review.</p>`;
  const photoLink = safeExternalUrl(product.image_source);
  return `<section class="page-shell detail-page">
    <div class="breadcrumbs"><a href="#home">Home</a><span>/</span><a href="#shop">Shop</a><span>/</span><span>${escapeHTML(product.saree_name)}</span></div>
    <div class="detail-layout">
      <div class="detail-image"><img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.saree_name)} styling inspiration"><span class="editorial-tag">STYLE INSPIRATION</span></div>
      <div class="detail-copy">
        <p class="eyebrow">${escapeHTML(product.category.toUpperCase())} · ${escapeHTML(product.region.toUpperCase())}</p>
        <h1>${escapeHTML(product.saree_name)}</h1><p class="detail-price">${money(product.price)}</p>
        <p class="detail-description">${escapeHTML(product.description)}</p>
        <div class="craft-facts">
          <div><span>FABRIC</span><strong>${escapeHTML(product.fabric)}</strong></div><div><span>WEAVE</span><strong>${escapeHTML(product.weave)}</strong></div>
          <div><span>REGION</span><strong>${escapeHTML(product.region)}</strong></div><div><span>OCCASION</span><strong>${escapeHTML(product.occasion)}</strong></div>
        </div>
        <p class="stock-note">${product.stock > 0 ? `${product.stock} pieces available · Ships with care` : "Currently out of stock"}</p>
        <div class="purchase-row">
          <div class="quantity-control"><button data-action="product-quantity" data-delta="-1" aria-label="Decrease quantity" ${state.quantity <= 1 ? "disabled" : ""}>−</button><span>${state.quantity}</span><button data-action="product-quantity" data-delta="1" aria-label="Increase quantity" ${state.quantity >= product.stock ? "disabled" : ""}>+</button></div>
          <button class="button button-dark" data-action="product-add" ${product.stock < 1 ? "disabled" : ""}>Add to bag</button>
        </div>
        <button class="button button-outline full-button buy-button" data-action="product-buy" ${product.stock < 1 ? "disabled" : ""}>Buy now</button>
        <p class="delivery-note">✦ Directly sourced from craft communities · Secure checkout</p>
        <p class="photo-credit">${photoLink ? `<a href="${escapeHTML(photoLink)}" target="_blank" rel="noreferrer">Photo: ${escapeHTML(product.image_credit)} · ${escapeHTML(product.image_license)}</a>` : `Photo: ${escapeHTML(product.image_credit)}`}</p>
        <p class="photo-disclaimer">Model photography is for styling inspiration. Please confirm the exact saree colours and details before ordering.</p>
      </div>
    </div>
    <section class="reviews-section">
      <div class="reviews-summary"><p class="eyebrow">CUSTOMER REVIEWS</p><h2>Worn & <em>loved.</em></h2>
        ${product.review_count > 0 ? `<div class="large-rating">${Number(product.average_rating).toFixed(1)} <span>★★★★★</span></div>` : "<p>There are no reviews yet. Be the first to share your experience.</p>"}
        <p>${product.review_count} ${product.review_count === 1 ? "review" : "reviews"}</p>
      </div>
      <div class="review-content">${reviewForm}${reviewList}</div>
    </section>
  </section>`;
}

function accountPage(isRegister) {
  return `<section class="account-page">
    <div class="account-photo"><img src="${imageUrl("weaveverse-model-05.jpg")}" alt="Model in a red and gold silk saree"><div><p class="eyebrow">WEAVEVERSE</p><p>Crafted with care.<br><em>Worn with meaning.</em></p></div></div>
    <div class="account-panel">
      <a class="account-back" href="#home">← Back to the collection</a>
      <p class="eyebrow">${isRegister ? "JOIN OUR CIRCLE" : "WELCOME BACK"}</p>
      <h1>${isRegister ? "A little more <em>you.</em>" : "Good to see <em>you.</em>"}</h1>
      <p class="account-intro">${isRegister ? "Create your account and keep all your favourite weaves close." : "Sign in to find your orders and the sarees you love."}</p>
      <form class="form-stack account-form" data-form="auth">
        ${isRegister ? `<div class="form-row"><label>First name<input name="first_name" autocomplete="given-name" required maxlength="80"></label><label>Last name<input name="last_name" autocomplete="family-name" required maxlength="80"></label></div>` : ""}
        <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="254"></label>
        <label>Password<input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required minlength="8" maxlength="128"></label>
        ${isRegister ? '<label>Confirm password<input name="password_confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="128"></label>' : ""}
        ${state.authError ? `<p class="form-error" role="alert">${escapeHTML(state.authError)}</p>` : ""}
        <button class="button button-dark full-button" ${state.busy ? "disabled" : ""}>${state.busy ? "Please wait..." : isRegister ? "Create my account" : "Sign in"}</button>
      </form>
      <p class="account-switch">${isRegister ? "Already have an account?" : "New to WeaveVerse?"} <a href="${isRegister ? "#login" : "#register"}">${isRegister ? "Sign in" : "Create an account"}</a></p>
      <p class="account-security">Your password is securely hashed before it is saved.</p>
    </div>
  </section>`;
}

function accountDashboard() {
  const content = state.ordersLoading
    ? `<div class="empty-state"><p>Loading your orders...</p></div>`
    : state.orders.length
      ? `<div class="orders-list">${state.orders.map((order) => `<article class="order-card">
          <div class="order-heading">
            <div><span>ORDER</span><strong>#${order.order_id}</strong></div><div><span>PLACED</span><strong>${new Date(order.created_at).toLocaleDateString("en-IN")}</strong></div>
            <div><span>STATUS</span><strong class="order-status">${escapeHTML(order.status)}</strong></div><strong>${money(order.total_amount)}</strong>
          </div><ul>${order.items.map((item) => `<li>${escapeHTML(item.saree_name)} <span>× ${item.quantity}</span></li>`).join("")}</ul>
        </article>`).join("")}</div>`
      : `<div class="empty-state"><p>Your order history is waiting for its first story.</p><a class="button button-dark" href="#shop">Explore sarees</a></div>`;
  return `<section class="page-shell account-dashboard">
    <p class="eyebrow">YOUR ACCOUNT</p><h1>Namaste, <em>${escapeHTML(state.customer.first_name)}.</em></h1><p class="muted">${escapeHTML(state.customer.email)}</p>
    <div class="orders-heading"><h2>Your orders</h2><a class="text-link" href="#shop">Continue shopping <span>→</span></a></div>${content}
  </section>`;
}

function contactSection() {
  return `<section class="contact-section" id="contact">
    <div><p class="eyebrow">A NOTE FROM YOU</p><h2>We'd love to<br><em>hear your story.</em></h2><p>For questions about sarees, orders, or our weaver community, write to us. We’ll be in touch soon.</p><a class="text-link" href="mailto:hello@weaveverse.com">hello@weaveverse.com <span>↗</span></a></div>
    <div class="contact-aside"><span class="contact-sun">✳</span><p>Good things take time.<br>So does a beautiful weave.</p></div>
  </section>`;
}

function contactPage() {
  return `<section class="page-shell contact-page"><p class="eyebrow">WE’RE HERE FOR YOU</p><h1>Let's talk <em>craft.</em></h1><p>Questions about a weave, an order, or the hands behind your saree? We'd love to help.</p>${contactSection()}</section>`;
}

function footer() {
  return `<footer class="site-footer">
    ${brandLink("footer-brand")}<p>Honouring the hands that weave<br>India's timeless stories.</p>
    <div class="footer-links"><a href="#shop">Shop sarees</a><a href="#contact">Contact</a><a href="mailto:hello@weaveverse.com">Email us</a></div>
    <small class="copyright">© 2026 WeaveVerse</small>
  </footer>`;
}

function cartDrawer() {
  if (!state.cartOpen) return "";
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const content = state.cart.length
    ? `<div class="cart-items">${state.cart.map((item) => `<article class="cart-item">
        <img src="${escapeHTML(item.image_url)}" alt=""><div class="cart-item-copy">
          <a href="#product/${item.product_id}" data-action="close-cart">${escapeHTML(item.saree_name)}</a><span>${money(item.price)}</span>
          <div class="quantity-control small"><button data-action="cart-quantity" data-id="${item.product_id}" data-delta="-1" aria-label="Remove one ${escapeHTML(item.saree_name)}">−</button><span>${item.quantity}</span><button data-action="cart-quantity" data-id="${item.product_id}" data-delta="1" aria-label="Add one ${escapeHTML(item.saree_name)}">+</button></div>
        </div><button class="remove-button" data-action="remove-cart" data-id="${item.product_id}">Remove</button>
      </article>`).join("")}</div>
      <div class="cart-summary"><div><span>Subtotal</span><strong>${money(total)}</strong></div><p>Shipping and any applicable taxes are calculated at checkout.</p><button class="button button-dark full-button" data-action="checkout" ${state.busy ? "disabled" : ""}>${state.busy ? "Placing order..." : "Place order"}</button></div>`
    : `<div class="empty-cart"><p>Your bag is waiting for something beautiful.</p><a href="#shop" class="button button-dark" data-action="close-cart">Explore sarees</a></div>`;
  return `<div class="overlay" data-action="overlay">
    <aside class="cart-drawer" aria-label="Shopping bag">
      <div class="drawer-heading"><div><p class="eyebrow">YOUR SELECTION</p><h2>Your bag <span>(${count})</span></h2></div><button class="close-button" data-action="close-cart" aria-label="Close bag">×</button></div>
      ${content}
    </aside>
  </div>`;
}

function pageContent() {
  if (state.route.page === "home") return homePage();
  if (state.route.page === "shop") return catalogPage();
  if (state.route.page === "contact") return contactPage();
  if (state.route.page === "login" || state.route.page === "register") return accountPage(state.route.page === "register");
  if (state.route.page === "account") {
    return state.customer
      ? accountDashboard()
      : `<div class="page-shell empty-state"><p>Sign in to see your account and orders.</p><a class="button button-dark" href="#login">Sign in</a></div>`;
  }
  if (state.route.page === "product") {
    const product = state.products.find((item) => item.product_id === state.route.productId);
    if (product) return productPage(product);
    return `<div class="page-shell empty-state"><p>${escapeHTML(state.productError || state.catalogError || "Finding this saree...")}</p><a class="button button-dark" href="#shop">Back to the collection</a></div>`;
  }
  return homePage();
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  root.innerHTML = `${pageHeader()}<main>${pageContent()}</main>${footer()}
    ${state.notice ? `<div class="toast" role="status">${escapeHTML(state.notice)}</div>` : ""}
    ${cartDrawer()}`;
}

function saveCart() {
  localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
  render();
}

function addToCart(product, quantity = 1) {
  if (!product || product.stock < 1) {
    showNotice("This saree is currently out of stock.");
    return;
  }
  const existing = state.cart.find((item) => item.product_id === product.product_id);
  if (existing) {
    state.cart = state.cart.map((item) => item.product_id === product.product_id
      ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
      : item);
  } else {
    state.cart = [...state.cart, { ...product, quantity: Math.min(quantity, product.stock) }];
  }
  localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
  render();
  showNotice(`${product.saree_name} added to your bag.`);
}

async function loadProducts() {
  try {
    const result = await apiRequest("/products");
    state.products = result.products;
    state.catalogError = "";
    render();
    if (state.route.page === "product") loadReviews(state.route.productId);
  } catch (error) {
    state.catalogError = error.message;
    render();
  }
}

async function loadProduct(productId) {
  if (!Number.isInteger(productId) || productId <= 0 || state.products.some((item) => item.product_id === productId)) return;
  state.productError = "";
  try {
    const result = await apiRequest(`/products/${productId}`);
    state.products = [...state.products, result.product];
    render();
  } catch (error) {
    state.productError = error.message;
    render();
  }
}

async function loadReviews(productId) {
  state.reviewsError = "";
  try {
    const result = await apiRequest(`/products/${productId}/reviews`);
    state.reviews[productId] = result.reviews;
    if (state.route.page === "product" && state.route.productId === productId) render();
  } catch (error) {
    state.reviewsError = error.message;
    if (state.route.page === "product" && state.route.productId === productId) render();
  }
}

async function loadOrders() {
  state.ordersLoading = true;
  render();
  try {
    const result = await apiRequest("/orders", { token: state.token });
    state.orders = result.orders;
  } catch (error) {
    showNotice(error.message);
    if (error.message.includes("token")) signOut();
  } finally {
    state.ordersLoading = false;
    render();
  }
}

function clearSession() {
  state.token = "";
  state.customer = null;
  state.orders = [];
  localStorage.removeItem(storageKeys.token);
  localStorage.removeItem(storageKeys.customer);
}

function signOut() {
  clearSession();
  window.location.hash = "home";
  showNotice("You have been signed out.");
}

async function checkout() {
  if (!state.token) {
    state.cartOpen = false;
    window.location.hash = "login";
    showNotice("Sign in to place your order.");
    return;
  }
  state.busy = true;
  render();
  try {
    const result = await apiRequest("/orders", {
      method: "POST",
      token: state.token,
      body: JSON.stringify({
        items: state.cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
      }),
    });
    state.cart = [];
    localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
    state.cartOpen = false;
    await loadProducts();
    showNotice(`Order #${result.order_id} placed. Thank you!`);
  } catch (error) {
    showNotice(error.message);
    if (error.message.includes("token")) clearSession();
    await loadProducts();
  } finally {
    state.busy = false;
    render();
  }
}

async function submitAuth(form) {
  const values = new FormData(form);
  const isRegister = state.route.page === "register";
  const payload = {
    email: values.get("email"),
    password: values.get("password"),
  };
  if (isRegister) {
    payload.first_name = values.get("first_name");
    payload.last_name = values.get("last_name");
    payload.password_confirm = values.get("password_confirm");
  }
  state.busy = true;
  state.authError = "";
  const submitButton = form.querySelector('button[type="submit"], button:not([type])');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Please wait...";
  }
  try {
    const result = await apiRequest(isRegister ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.token = result.token;
    state.customer = result.customer;
    localStorage.setItem(storageKeys.token, result.token);
    localStorage.setItem(storageKeys.customer, JSON.stringify(result.customer));
    state.busy = false;
    window.location.hash = "account";
    showNotice(`Welcome${result.customer.first_name ? `, ${result.customer.first_name}` : ""}!`);
  } catch (error) {
    state.busy = false;
    state.authError = error.message;
    render();
  }
}

async function submitReview(form) {
  const productId = state.route.productId;
  const values = new FormData(form);
  state.reviewBusy = true;
  state.reviewMessage = "";
  const submitButton = form.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";
  try {
    await apiRequest(`/products/${productId}/reviews`, {
      method: "POST",
      token: state.token,
      body: JSON.stringify({
        rating: Number(values.get("rating")),
        review_text: values.get("review_text"),
      }),
    });
    state.reviewMessage = "Thank you. Your review has been added.";
    await loadReviews(productId);
    await loadProducts();
  } catch (error) {
    state.reviewMessage = error.message;
  } finally {
    state.reviewBusy = false;
    render();
  }
}

function handleAction(button, clickEvent) {
  const action = button.dataset.action;
  const productId = Number(button.dataset.id);
  const product = state.products.find((item) => item.product_id === productId);
  if (action === "theme") {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem(storageKeys.theme, state.theme);
    render();
  } else if (action === "open-cart") {
    state.cartOpen = true;
    render();
  } else if (action === "close-cart") {
    state.cartOpen = false;
    render();
  } else if (action === "overlay" && clickEvent.target === button) {
    state.cartOpen = false;
    render();
  } else if (action === "sign-out") {
    signOut();
  } else if (action === "add-cart") {
    addToCart(product);
  } else if (action === "product-add" && product) {
    addToCart(product, state.quantity);
  } else if (action === "product-buy" && product) {
    addToCart(product, state.quantity);
    state.cartOpen = true;
    render();
  } else if (action === "product-quantity" && product) {
    state.quantity = Math.max(1, Math.min(product.stock, state.quantity + Number(button.dataset.delta)));
    render();
  } else if (action === "cart-quantity") {
    const delta = Number(button.dataset.delta);
    state.cart = state.cart.map((item) => {
      if (item.product_id !== productId) return item;
      const currentProduct = state.products.find((entry) => entry.product_id === productId);
      return { ...item, quantity: Math.min(item.quantity + delta, currentProduct ? currentProduct.stock : item.quantity) };
    }).filter((item) => item.quantity > 0);
    saveCart();
  } else if (action === "remove-cart") {
    state.cart = state.cart.filter((item) => item.product_id !== productId);
    saveCart();
  } else if (action === "checkout") {
    checkout();
  } else if (action === "fabric") {
    state.catalog.fabric = button.dataset.value;
    render();
  } else if (action === "clear-filters") {
    state.catalog = { search: "", fabric: "All fabrics", region: "All regions", occasion: "All occasions", sort: "newest" };
    render();
  } else if (action === "retry") {
    loadProducts();
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) handleAction(button, event);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "auth") submitAuth(form);
  if (form.dataset.form === "review") submitReview(form);
});

document.addEventListener("input", (event) => {
  if (event.target.id !== "catalog-search") return;
  state.catalog.search = event.target.value;
  const position = event.target.selectionStart;
  render();
  const search = document.getElementById("catalog-search");
  search.focus();
  search.setSelectionRange(position, position);
});

document.addEventListener("change", (event) => {
  const field = event.target;
  if (field.id === "catalog-region") state.catalog.region = field.value;
  else if (field.id === "catalog-occasion") state.catalog.occasion = field.value;
  else if (field.id === "catalog-sort") state.catalog.sort = field.value;
  else if (field.name === "rating") {
    state.rating = Number(field.value);
    return;
  }
  else return;
  render();
});

window.addEventListener("hashchange", () => {
  state.route = routeFromHash();
  state.authError = "";
  state.productError = "";
  state.reviewMessage = "";
  state.quantity = 1;
  if (state.route.page === "shop" && state.route.fabric) {
    state.catalog.fabric = state.route.fabric;
  } else if (state.route.page === "shop") {
    state.catalog.fabric = "All fabrics";
  }
  render();
  if (state.route.page === "product") {
    loadProduct(state.route.productId);
    loadReviews(state.route.productId);
  }
  if (state.route.page === "account" && state.token) loadOrders();
});

async function restoreSession() {
  if (!state.token) return;
  try {
    const result = await apiRequest("/auth/me", { token: state.token });
    state.customer = result.customer;
    localStorage.setItem(storageKeys.customer, JSON.stringify(result.customer));
    if (state.route.page === "account") loadOrders();
    render();
  } catch (error) {
    console.warn("The saved sign-in could not be restored.", error);
    clearSession();
    render();
  }
}

render();
loadProducts();
restoreSession();
