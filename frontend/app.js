"use strict";

const root = document.getElementById("app");
const apiBase = "/api";
const storageKeys = {
  cart: "fsc-cart",
  customer: "fsc-customer",
  theme: "fsc-theme",
  token: "fsc-token",
  wishlist: "fsc-wishlist",
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
    page: ["shop", "contact", "orders", "login", "register", "account"].includes(page)
      ? page
      : "home",
  };
}

function currentHash() {
  return window.location.hash.slice(1) || "home";
}

function routePageFromHash(hash) {
  const clean = String(hash || "").replace(/^#/, "") || "home";
  if (clean.startsWith("product/")) return "product";
  const page = clean.split("/")[0];
  return ["shop", "contact", "orders", "login", "register", "account"].includes(page)
    ? page
    : "home";
}

const NO_BACK_PAGES = new Set(["home", "shop", "contact", "account", "orders"]);

function shouldShowBackButton() {
  return !NO_BACK_PAGES.has(state.route.page);
}

function isSkippableBackTarget(hash) {
  const page = routePageFromHash(hash);
  const isSignedIn = Boolean(state.token && state.customer);
  if (isSignedIn && (page === "login" || page === "register")) return true;
  if (!isSignedIn && (page === "account" || page === "orders")) return true;
  return false;
}

function fallbackHashForPage(page) {
  if (page === "product") return "shop";
  return "home";
}

let isBackNavigation = false;

function goBack() {
  const current = currentHash();
  while (state.navHistory.length && state.navHistory[state.navHistory.length - 1] === current) {
    state.navHistory.pop();
  }
  let target = "";
  while (state.navHistory.length) {
    const candidate = state.navHistory.pop();
    if (candidate === current) continue;
    if (isSkippableBackTarget(candidate)) continue;
    target = candidate;
    break;
  }
  if (!target) {
    target = fallbackHashForPage(state.route.page);
  }
  state.navHistory.push(target);
  isBackNavigation = true;
  if (currentHash() !== target) {
    window.location.hash = target;
  } else {
    isBackNavigation = false;
  }
}

const state = {
  route: routeFromHash(),
  navHistory: [currentHash()],
  postAuthReturnHash: "",
  postAuthOpenCheckout: false,
  products: [],
  productsLoading: true,
  catalogError: "",
  productError: "",
  cart: readStorage(storageKeys.cart, []),
  wishlist: readStorage(storageKeys.wishlist, []),
  token: localStorage.getItem(storageKeys.token) || "",
  customer: readStorage(storageKeys.customer, null),
  orders: [],
  ordersLoading: false,
  reviews: {},
  reviewsError: "",
  cartOpen: false,
  wishlistOpen: false,
  menuOpen: false,
  quickViewId: null,
  checkoutOpen: false,
  paymentMethod: "gpay",
  upiId: "",
  lastBill: null,
  expandedTrackId: null,
  activeShotIndex: 0,
  finishing: { fallPico: false, tassels: false },
  openAccordions: { dimensions: true },
  busy: false,
  authError: "",
  reviewMessage: "",
  reviewBusy: false,
  theme: localStorage.getItem(storageKeys.theme)
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  notice: "",
  voiceListening: false,
  voiceStatus: "",
  catalog: {
    search: "",
    fabric: routeFromHash().fabric || "All fabrics",
    region: "All regions",
    occasion: "All occasions",
    priceRange: "all",
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
    <rect x="1" y="1" width="62" height="62" rx="20" fill="#0c0c16" stroke="#6666ff" stroke-opacity="0.35" stroke-width="1.5"></rect>
    <path d="M14 20.5 22.4 44l9.6-18.2L41.6 44 50 20.5" fill="none" stroke="#c9e8ff" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2"></path>
    <path d="M17.5 31.7c4.2-3.1 8.9-4.6 14.5-4.6s10.3 1.5 14.5 4.6M18.5 37c3.9-2.2 8.4-3.3 13.5-3.3s9.6 1.1 13.5 3.3" fill="none" stroke="#6666ff" stroke-linecap="round" stroke-width="1.8"></path>
    <circle cx="32" cy="14" r="1.8" fill="#b9f0d7"></circle>
  </svg>`;
}

function brandLink(extraClass = "") {
  return `<a class="brand ${extraClass}" href="#home" aria-label="WeaveVerse home">
    ${brandMark()}<span class="brand-name">WeaveVerse<small>WEAVES THAT TELL STORIES</small></span>
  </a>`;
}

function hamburgerDropdown() {
  if (!state.menuOpen) return "";
  const signItem = state.customer
    ? `<button type="button" class="hamburger-dropdown-item danger" role="menuitem" data-action="sign-out"><span>Sign out</span><span>↪</span></button>`
    : `<a class="hamburger-dropdown-item ${state.route.page === "login" ? "active" : ""}" role="menuitem" href="#login" data-action="close-menu"><span>Sign in</span><span>→</span></a>`;
  return `<div class="hamburger-dropdown" role="menu" aria-label="Menu">
    <div class="hamburger-mobile-only">
      <div class="hamburger-dropdown-label">Browse</div>
      <a class="hamburger-dropdown-item ${state.route.page === "home" ? "active" : ""}" role="menuitem" href="#home" data-action="close-menu"><span>Home</span><span>→</span></a>
      <a class="hamburger-dropdown-item ${state.route.page === "shop" ? "active" : ""}" role="menuitem" href="#shop" data-action="close-menu"><span>Shop Collection</span><span>→</span></a>
      <div class="hamburger-dropdown-divider"></div>
    </div>
    <div class="hamburger-dropdown-label">Pages</div>
    <a class="hamburger-dropdown-item ${state.route.page === "orders" ? "active" : ""}" role="menuitem" href="#orders" data-action="close-menu"><span>Order Tracking</span><span>→</span></a>
    <a class="hamburger-dropdown-item ${state.route.page === "contact" ? "active" : ""}" role="menuitem" href="#contact" data-action="close-menu"><span>Contact Us</span><span>→</span></a>
    <div class="hamburger-dropdown-divider"></div>
    ${signItem}
  </div>`;
}

function pageHeader() {
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const wishCount = state.wishlist.length;
  const accountAction = state.customer
    ? `<a class="text-button account-button" href="#account">Hi, ${escapeHTML(state.customer.first_name)}</a>`
    : `<a class="text-button account-button" href="#login">Sign in</a>`;
  const backButton = shouldShowBackButton()
    ? `<button type="button" class="nav-back-btn" data-action="go-back" aria-label="Go back to previous page" title="Go back">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      </button>`
    : "";
  return `<header class="site-header">
    <div class="header-left">
      ${backButton}
      ${brandLink()}
    </div>
    <nav class="main-nav" aria-label="Main navigation">
      <a class="${state.route.page === "home" ? "active" : ""}" href="#home">Home</a>
      <a class="${state.route.page === "shop" ? "active" : ""}" href="#shop">Shop</a>
      <a class="${state.route.page === "contact" ? "active" : ""}" href="#contact">Contact Us</a>
    </nav>
    <div class="header-actions">
      ${accountAction}
      <button class="icon-pill-btn" data-action="open-wishlist" aria-label="Saved weaves, ${wishCount} items" title="Saved weaves">♡ <span>${wishCount}</span></button>
      <button class="theme-button" data-action="theme" aria-label="Switch to ${state.theme === "light" ? "dark" : "light"} mode" title="Switch to ${state.theme === "light" ? "dark" : "light"} mode">${state.theme === "light" ? "☾" : "☀"}</button>
      <button class="bag-button" data-action="open-cart" aria-label="Open shopping bag, ${cartCount} items">Bag <span>${cartCount}</span></button>
      <div class="hamburger-wrap">
        <button class="hamburger-btn ${state.menuOpen ? "is-open" : ""}" data-action="toggle-menu" aria-label="Toggle navigation menu" aria-expanded="${state.menuOpen}" aria-haspopup="menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
        </button>
        ${hamburgerDropdown()}
      </div>
    </div>
  </header>`;
}

function errorMessage(message, retry = false) {
  return `<div class="error-message" role="alert"><p>${escapeHTML(message)}</p>${retry ? '<button class="text-button" data-action="retry">Try again</button>' : ""}</div>`;
}

function productCard(product) {
  const isSaved = state.wishlist.includes(product.product_id);
  const ratingBadge = product.review_count > 0
    ? `<span class="product-badge">★ ${Number(product.average_rating).toFixed(1)} · ${product.review_count} REVIEWS</span>`
    : "";
  const stockLabel = product.review_count
    ? `★ ${Number(product.average_rating).toFixed(1)} · ${product.review_count}`
    : product.stock > 0 ? "In stock" : "Sold out";
  const focal = escapeHTML(product.focal_point || "50% 18%");
  return `<article class="product-card">
    <div class="product-image">
      <a href="#product/${product.product_id}" style="display:block;width:100%;height:100%;">
        <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.saree_name)} styling inspiration" loading="lazy" style="object-position:${focal};">
      </a>
      <span class="editorial-tag">STYLE INSPIRATION</span>${ratingBadge}
      <div class="card-floating-tools">
        <button type="button" class="card-tool-btn ${isSaved ? "is-saved" : ""}" data-action="toggle-wishlist" data-id="${product.product_id}" aria-label="${isSaved ? "Remove from saved weaves" : "Save weave"}" title="${isSaved ? "Saved" : "Save weave"}">${isSaved ? "♥" : "♡"}</button>
        <button type="button" class="card-tool-btn" data-action="quick-view" data-id="${product.product_id}" aria-label="Quick view ${escapeHTML(product.saree_name)}" title="Quick view">👁</button>
      </div>
      <a href="#product/${product.product_id}" class="image-arrow" aria-label="View ${escapeHTML(product.saree_name)}">↗</a>
    </div>
    <div class="product-info">
      <div class="product-meta"><span>${escapeHTML(product.fabric)} · ${escapeHTML(product.weave)}</span><span>${escapeHTML(product.region)}</span></div>
      <div class="product-title-row"><a href="#product/${product.product_id}"><h3>${escapeHTML(product.saree_name)}</h3></a><strong>${money(product.price)}</strong></div>
      <div class="product-bottom"><span>${stockLabel}</span><button data-action="add-cart" data-id="${product.product_id}" ${product.stock < 1 ? "disabled" : ""}>Add to bag <span>+</span></button></div>
    </div>
  </article>`;
}

function skeletonGrid(count = 6) {
  return `<div class="product-grid">${Array.from({ length: count }, () => `<div class="skeleton-card"><div class="skeleton-media"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>`).join("")}</div>`;
}

function productGrid(products) {
  if (state.productsLoading && !products.length) return skeletonGrid(6);
  if (!products.length) {
    return `<div class="empty-state"><p>Our first collection is being prepared.</p><p class="muted">Please check back soon.</p></div>`;
  }
  return `<div class="product-grid">${products.map(productCard).join("")}</div>`;
}

const fabricGroups = [
  { label: "Mulmul cotton", values: ["mulmul cotton", "mull-mull cotton", "mul-mul cotton"] },
  { label: "Silk", values: ["silk"] },
  { label: "Silk cotton", values: ["silk cotton", "silk-cotton", "cotton-silk", "chanderi silk-cotton"] },
  { label: "Crepe cotton", values: ["crepe cotton"] },
  { label: "Georgette cotton", values: ["georgette cotton"] },
  { label: "Crepe", values: ["crepe"] },
  { label: "Georgette", values: ["georgette"] },
  { label: "Cotton", values: ["cotton"] },
  { label: "Organza", values: ["organza"] },
  { label: "Linen", values: ["linen"] },
  { label: "Tussar silk", values: ["tussar silk", "tosser silk"] },
  { label: "Chiffon", values: ["chiffon"] },
];

function normalizedFabric(value) {
  return String(value || "").trim().toLowerCase();
}

function getFabricOptions(products) {
  const options = [];
  const coveredValues = new Set();
  for (const group of fabricGroups) {
    const values = group.values.map(normalizedFabric);
    const count = products.filter((product) => values.includes(normalizedFabric(product.fabric))).length;
    if (count) {
      options.push({ ...group, values, count });
      values.forEach((value) => coveredValues.add(value));
    }
  }
  for (const fabric of new Set(products.map((product) => product.fabric))) {
    const value = normalizedFabric(fabric);
    if (!coveredValues.has(value)) {
      options.push({ label: fabric, values: [value], count: products.filter((product) => normalizedFabric(product.fabric) === value).length });
    }
  }
  return options;
}

function selectedFabricValues(options, selectedFabric) {
  const selected = normalizedFabric(selectedFabric);
  const option = options.find((item) => normalizedFabric(item.label) === selected || item.values.includes(selected));
  return option ? option.values : [selected];
}

function fabricIsSelected(fabric, selectedFabric) {
  const selected = normalizedFabric(selectedFabric);
  return normalizedFabric(fabric.label) === selected || fabric.values.includes(selected);
}

function homePage() {
  const fabrics = getFabricOptions(state.products);
  return `<section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">A WORLD WOVEN BY HAND</p>
      <h1>Wear a story.<br><em>Keep a legacy.</em></h1>
      <p class="hero-description">Discover India's timeless sarees, chosen for their craft, colour and the stories woven into every thread.</p>
      <div class="hero-actions"><a class="button button-dark" href="#shop">Explore the collection <span>↗</span></a><a class="text-link" href="#contact">Our story <span>→</span></a></div>
      <div class="hero-note"><span class="note-line"></span> Thoughtfully chosen. Beautifully woven.</div>
    </div>
    <div class="hero-logo-stage" aria-label="Interactive slowly moving WeaveVerse logo">
      <div class="hero-logo-orb">
        <div class="hero-logo-glow"></div>
        <div class="hero-logo-ring"></div>
        <div class="hero-logo-ring ring-inner"></div>
        <div class="hero-logo-emblem">${brandMark()}</div>
      </div>
    </div>
  </section>
  <section class="promise-strip"><span>✳ Made by skilled hands</span><span>✳ Rooted in Indian craft</span><span>✳ Chosen with care</span><span>✳ Worn for generations</span></section>
  ${state.products.length ? `<section class="fabric-collection" aria-label="Shop by fabric">
    <p class="eyebrow">FIND YOUR FAVOURITE FEEL</p>
    ${fabrics.map((fabric) => `<a class="fabric-tile" href="#shop/${encodeURIComponent(fabric.label)}">${escapeHTML(fabric.label)} <span>(${fabric.count}) ↗</span></a>`).join("")}
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

function matchesPriceRange(price, range) {
  const p = Number(price);
  if (range === "under-2000") return p < 2000;
  if (range === "2000-5000") return p >= 2000 && p <= 5000;
  if (range === "above-5000") return p > 5000;
  return true;
}

const SEARCH_STOP_WORDS = new Set([
  "a", "an", "the", "for", "with", "in", "of", "on", "to", "and", "or",
  "show", "me", "find", "search", "saree", "sarees", "sari", "saris",
  "please", "want", "need", "looking", "give", "get", "some", "any",
  "i", "my", "buy", "best", "good", "nice", "that", "this", "is", "are",
]);

const SEARCH_SYNONYMS = {
  kanjeevaram: ["kanjivaram", "kanchipuram", "kanjeevaram"],
  kanchipuram: ["kanjivaram", "kanchipuram", "kanjeevaram"],
  kanchi: ["kanjivaram", "kanchipuram"],
  banaras: ["banarasi", "varanasi"],
  banarasi: ["banarasi", "varanasi"],
  benares: ["banarasi", "varanasi"],
  benarasi: ["banarasi", "varanasi"],
  paitani: ["paithani"],
  bandhej: ["bandhani", "bandhej"],
  bandhni: ["bandhani", "bandhej"],
  tasar: ["tussar", "tasar"],
  tussore: ["tussar", "tussore"],
  tusser: ["tussar"],
  chikan: ["chikankari", "chikan"],
  lucknowi: ["chikankari", "lucknow"],
  jari: ["zari", "jari"],
  zari: ["zari", "jari"],
  bridal: ["wedding", "bridal", "ceremony"],
  bride: ["wedding", "bridal"],
  shaadi: ["wedding", "bridal"],
  marriage: ["wedding", "bridal"],
  everyday: ["daily", "everyday", "casual"],
  office: ["office", "work", "daily", "formal"],
  festival: ["festive", "festival", "puja", "celebration"],
  pooja: ["puja", "festive"],
  diwali: ["festive", "celebration", "evening"],
  lightweight: ["light", "airy", "soft", "breathable", "fluid"],
  light: ["light", "airy", "soft", "breathable"],
  mulmul: ["cotton", "mulmul", "handloom"],
  malmal: ["cotton", "mulmul"],
  ikkat: ["ikat", "sambalpuri"],
  odisha: ["sambalpuri", "odisha"],
};

function extractSearchTerms(rawQuery) {
  const cleaned = String(rawQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!cleaned) return [];
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const meaningful = rawTokens.filter((w) => w.length >= 2 && !SEARCH_STOP_WORDS.has(w));
  return meaningful.length ? [...new Set(meaningful)] : [...new Set(rawTokens)];
}

function expandSearchVariants(term) {
  const variants = new Set([term]);
  if (term.length > 3 && term.endsWith("s")) variants.add(term.slice(0, -1));
  if (term.length > 4 && term.endsWith("es")) variants.add(term.slice(0, -2));
  if (SEARCH_SYNONYMS[term]) {
    for (const alt of SEARCH_SYNONYMS[term]) variants.add(alt);
  }
  return [...variants];
}

function scoreProductSearch(product, rawQuery) {
  const trimmed = String(rawQuery || "").trim().toLowerCase();
  if (!trimmed) return { matched: true, score: 0, matchedWords: [] };

  const nameText = String(product.saree_name || "").toLowerCase();
  const tagText = `${product.fabric || ""} ${product.weave || ""} ${product.region || ""} ${product.occasion || ""} ${product.category || ""}`.toLowerCase();
  const detailText = `${product.description || ""} ${product.drape_feel || ""} ${product.sheerness || ""} ${product.care_instructions || ""}`.toLowerCase();
  const combined = `${nameText} ${tagText} ${detailText}`;

  let score = 0;
  if (combined.includes(trimmed)) score += 100;

  const terms = extractSearchTerms(trimmed);
  const matchedWords = [];
  for (const term of terms) {
    const variants = expandSearchVariants(term);
    let termScore = 0;
    for (const v of variants) {
      if (nameText.includes(v)) termScore = Math.max(termScore, 24);
      else if (tagText.includes(v)) termScore = Math.max(termScore, 16);
      else if (detailText.includes(v)) termScore = Math.max(termScore, 8);
    }
    if (termScore > 0) {
      score += termScore;
      matchedWords.push(term);
    }
  }

  if (matchedWords.length > 0) {
    score += matchedWords.length * 25;
  }

  return { matched: score > 0, score, matchedWords };
}

let activeRecognition = null;

function toggleVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showNotice("Voice search is not supported in this browser. Try Chrome or Edge.");
    return;
  }
  if (state.voiceListening && activeRecognition) {
    try { activeRecognition.stop(); } catch {}
    state.voiceListening = false;
    state.voiceStatus = "";
    activeRecognition = null;
    render();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  activeRecognition = recognition;

  recognition.onstart = () => {
    state.voiceListening = true;
    state.voiceStatus = "Listening… speak a saree weave, fabric, colour, or occasion";
    render();
  };

  recognition.onresult = (event) => {
    let transcript = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }
    const cleaned = transcript.trim().replace(/[.!?]+$/, "");
    if (cleaned) {
      state.catalog.search = cleaned;
      state.voiceStatus = isFinal ? `Heard: “${cleaned}”` : `Hearing: “${cleaned}”…`;
      render();
    }
  };

  recognition.onerror = (event) => {
    state.voiceListening = false;
    state.voiceStatus = "";
    activeRecognition = null;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showNotice("Microphone access was blocked. Allow microphone permission to use voice search.");
    } else if (event.error === "no-speech") {
      showNotice("Didn't catch any speech. Tap the mic and try speaking again.");
    } else if (event.error !== "aborted") {
      showNotice("Voice search could not hear you clearly. Please try again.");
    } else {
      render();
    }
  };

  recognition.onend = () => {
    state.voiceListening = false;
    activeRecognition = null;
    if (state.catalog.search.trim()) {
      state.voiceStatus = "";
    } else {
      state.voiceStatus = "";
    }
    render();
  };

  try {
    recognition.start();
  } catch {
    state.voiceListening = false;
    state.voiceStatus = "";
    activeRecognition = null;
    showNotice("Could not start voice search. Please try again.");
  }
}

function catalogPage() {
  const fabrics = getFabricOptions(state.products);
  const regions = ["All regions", ...new Set(state.products.map((product) => product.region))];
  const occasions = ["All occasions", ...new Set(state.products.map((product) => product.occasion))];
  const selectedValues = selectedFabricValues(fabrics, state.catalog.fabric);
  const hasSearch = Boolean(state.catalog.search.trim());
  const searchTerms = extractSearchTerms(state.catalog.search);

  const scored = state.products
    .map((product) => ({ product, match: scoreProductSearch(product, state.catalog.search) }))
    .filter(({ product, match }) => match.matched
      && (state.catalog.fabric === "All fabrics" || selectedValues.includes(normalizedFabric(product.fabric)))
      && (state.catalog.region === "All regions" || product.region === state.catalog.region)
      && (state.catalog.occasion === "All occasions" || product.occasion === state.catalog.occasion)
      && matchesPriceRange(product.price, state.catalog.priceRange))
    .sort((left, right) => {
      if (hasSearch && state.catalog.sort === "newest" && right.match.score !== left.match.score) {
        return right.match.score - left.match.score;
      }
      if (state.catalog.sort === "price-asc") return Number(left.product.price) - Number(right.product.price);
      if (state.catalog.sort === "price-desc") return Number(right.product.price) - Number(left.product.price);
      if (state.catalog.sort === "name") return left.product.saree_name.localeCompare(right.product.saree_name);
      return right.product.product_id - left.product.product_id;
    });

  const filtered = scored.map(({ product }) => product);
  const priceRanges = [
    { key: "all", label: "All prices" },
    { key: "under-2000", label: "Under ₹2,000" },
    { key: "2000-5000", label: "₹2,000 – ₹5,000" },
    { key: "above-5000", label: "₹5,000+ Heirloom" },
  ];
  const quickSuggestions = ["Banarasi silk", "Wedding zari", "Lightweight cotton", "Kanjivaram", "Daily wear"];
  const micIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
  const searchIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;

  return `<section class="page-shell catalog-page">
    <div class="catalog-intro"><div><p class="eyebrow">A THOUGHTFUL COLLECTION</p><h1>Find your <em>forever drape.</em></h1><p>Handloom stories, gathered from the places that make them.</p></div><span class="catalog-count">${filtered.length} of ${state.products.length} sarees</span></div>
    <div class="catalog-search-hero">
      <div class="search-field ${state.voiceListening ? "is-listening" : ""}" role="search">
        <span class="search-field-icon">${searchIcon}</span>
        <input id="catalog-search" type="search" value="${escapeHTML(state.catalog.search)}" placeholder="Search by weave, fabric, colour, region, or occasion — or speak with the mic…" aria-label="Search sarees" autocomplete="off">
        ${state.catalog.search ? `<button type="button" class="search-clear-btn" data-action="clear-search" aria-label="Clear search" title="Clear search">✕</button>` : ""}
        <button type="button" class="voice-search-btn ${state.voiceListening ? "listening" : ""}" data-action="voice-search" aria-label="${state.voiceListening ? "Stop voice search" : "Search sarees by voice"}" title="${state.voiceListening ? "Stop listening" : "Search by voice"}">
          ${micIcon}
          <span>${state.voiceListening ? "Listening…" : "Voice"}</span>
        </button>
      </div>
      ${state.voiceStatus
        ? `<p class="voice-status-bar" role="status"><span class="voice-pulse-dot" aria-hidden="true"></span>${escapeHTML(state.voiceStatus)}</p>`
        : hasSearch && searchTerms.length
          ? `<p class="search-match-hint">Showing <strong>${filtered.length}</strong> ${filtered.length === 1 ? "saree" : "sarees"} matching: ${searchTerms.map((t) => `<span class="search-term-chip">${escapeHTML(t)}</span>`).join(" ")}</p>`
          : `<div class="search-suggestions"><span class="search-suggestions-label">Try saying or searching:</span>${quickSuggestions.map((s) => `<button type="button" class="search-suggestion-chip" data-action="quick-search" data-value="${escapeHTML(s)}">${escapeHTML(s)}</button>`).join("")}</div>`}
    </div>
    <div class="catalog-tools">
      <div class="category-pills">
        <button class="${state.catalog.fabric === "All fabrics" ? "selected" : ""}" data-action="fabric" data-value="All fabrics">All fabrics <span>${state.products.length}</span></button>
        ${fabrics.map((fabric) => `<button class="${fabricIsSelected(fabric, state.catalog.fabric) ? "selected" : ""}" data-action="fabric" data-value="${escapeHTML(fabric.label)}">${escapeHTML(fabric.label)} <span>${fabric.count}</span></button>`).join("")}
      </div>
    </div>
    <div class="price-pills" role="group" aria-label="Filter by price range">
      ${priceRanges.map((r) => `<button type="button" class="price-pill ${state.catalog.priceRange === r.key ? "selected" : ""}" data-action="price-range" data-value="${r.key}">${r.label}</button>`).join("")}
    </div>
    <div class="catalog-refine">
      <label>Region<select id="catalog-region">${regions.map((item) => `<option ${state.catalog.region === item ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}</select></label>
      <label>Occasion<select id="catalog-occasion">${occasions.map((item) => `<option ${state.catalog.occasion === item ? "selected" : ""}>${escapeHTML(item)}</option>`).join("")}</select></label>
      <label>Sort by<select id="catalog-sort"><option value="newest" ${state.catalog.sort === "newest" ? "selected" : ""}>Featured</option><option value="price-asc" ${state.catalog.sort === "price-asc" ? "selected" : ""}>Price: low to high</option><option value="price-desc" ${state.catalog.sort === "price-desc" ? "selected" : ""}>Price: high to low</option><option value="name" ${state.catalog.sort === "name" ? "selected" : ""}>Name</option></select></label>
    </div>
    ${state.catalogError ? errorMessage(state.catalogError, true) : (state.productsLoading && !state.products.length) ? skeletonGrid(6) : filtered.length ? productGrid(filtered) : `<div class="empty-state"><p>No sarees found for these filters.</p><button class="text-button" data-action="clear-filters">Clear filters</button></div>`}
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

function productFinishingDetails() {
  const notes = [];
  let addon = 0;
  if (state.finishing.fallPico) { notes.push("Fall & Pico edging"); addon += 250; }
  if (state.finishing.tassels) { notes.push("Hand-knotted Kuchu tassels"); addon += 350; }
  return { note: notes.join(" + "), addon };
}

function productPage(product) {
  const reviews = state.reviews[product.product_id] || [];
  const isSaved = state.wishlist.includes(product.product_id);
  const gallery = (product.images && product.images.length)
    ? product.images
    : [{ image_url: product.image_url, shot_type: "drape" }];
  const shotLabels = { drape: "Full Drape", pallu: "Pallu View", border: "Border Detail", blouse: "Blouse Piece" };
  const activeShot = gallery[state.activeShotIndex] || gallery[0];
  const { addon } = productFinishingDetails();
  const displayTotal = Number(product.price) + addon;

  const reviewList = state.reviewsError
    ? errorMessage(state.reviewsError, true)
    : `<div class="review-list">${reviews.map((review) => `<article class="review">
        <div class="review-stars" aria-label="${review.rating} out of 5 stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        <p>${escapeHTML(review.review_text)}</p>
        <span>${escapeHTML(review.first_name)} ${escapeHTML(review.last_name)} · ${new Date(review.created_at).toLocaleDateString("en-IN")}</span>
      </article>`).join("")}</div>`;
  const ratingLabels = { 1: "1 star · Needs work", 2: "2 stars · Fair", 3: "3 stars · Good", 4: "4 stars · Very good", 5: "5 stars · Loved it" };
  const starSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.3l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.4z"/></svg>`;
  const reviewForm = state.token
    ? `<form class="review-form" data-form="review">
        <div class="rating-field">
          <span class="rating-field-label">Your rating</span>
          <input type="hidden" name="rating" value="${state.rating}">
          <div class="star-rating-picker" role="radiogroup" aria-label="Your rating">
            ${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="star-btn ${value <= state.rating ? "is-active" : ""}" data-action="set-rating" data-value="${value}" role="radio" aria-checked="${state.rating === value}" aria-label="${value} ${value === 1 ? "star" : "stars"}" title="${value} ${value === 1 ? "star" : "stars"}">${starSvg}</button>`).join("")}
            <span class="star-rating-text">${ratingLabels[state.rating] || `${state.rating} stars`}</span>
          </div>
        </div>
        <label>Your review<textarea name="review_text" rows="3" maxlength="1200" placeholder="Tell other shoppers what you loved..." required></textarea></label>
        <button type="submit" class="button button-outline" ${state.reviewBusy ? "disabled" : ""}>${state.reviewBusy ? "Submitting..." : "Share your review"}</button>
        ${state.reviewMessage ? `<p class="form-message" role="status">${escapeHTML(state.reviewMessage)}</p>` : ""}
      </form>`
    : `<p class="review-signin"><a class="text-link" href="#login">Sign in</a> to leave a review.</p>`;
  const photoLink = safeExternalUrl(product.image_source);
  const weightPct = Number(product.weight_score ?? 45);
  const drapePct = Number(product.drape_score ?? 80);
  const sheerPct = Number(product.sheerness_score ?? 25);
  const lusterPct = Number(product.luster_score ?? 70);

  const acc = (id, title, body) => {
    const open = !!state.openAccordions[id];
    return `<div class="wv-acc-item ${open ? "open" : ""}">
      <button type="button" class="wv-acc-trigger" data-action="toggle-acc" data-value="${id}" aria-expanded="${open}">${title}<span>⌄</span></button>
      <div class="wv-acc-panel">${body}</div>
    </div>`;
  };

  return `<section class="page-shell detail-page">
    <div class="breadcrumbs"><a href="#home">Home</a><span>/</span><a href="#shop">Shop</a><span>/</span><span>${escapeHTML(product.saree_name)}</span></div>
    <div class="detail-layout">
      <div class="detail-gallery">
        <div class="detail-image" data-loupe-src="${escapeHTML(activeShot.image_url)}">
          <img src="${escapeHTML(activeShot.image_url)}" alt="${escapeHTML(product.saree_name)} ${escapeHTML(shotLabels[activeShot.shot_type] || "drape")}" style="object-position:${escapeHTML(product.focal_point || "50% 18%")};">
          <div class="loupe-lens" aria-hidden="true"></div>
          <span class="editorial-tag">${escapeHTML((shotLabels[activeShot.shot_type] || "STYLE INSPIRATION").toUpperCase())} · HOVER TO ZOOM</span>
        </div>
        ${gallery.length > 1 ? `<div class="detail-thumbs">${gallery.map((shot, idx) => `<button type="button" class="detail-thumb ${idx === state.activeShotIndex ? "active" : ""}" data-action="select-shot" data-index="${idx}"><img src="${escapeHTML(shot.image_url)}" alt=""><span>${escapeHTML(shotLabels[shot.shot_type] || shot.shot_type)}</span></button>`).join("")}</div>` : ""}
      </div>
      <div class="detail-copy">
        <p class="eyebrow">${escapeHTML(product.category.toUpperCase())} · ${escapeHTML(product.region.toUpperCase())}</p>
        <h1>${escapeHTML(product.saree_name)}</h1>
        <p class="detail-price">${money(displayTotal)} ${addon ? `<small class="muted">(includes +${money(addon)} finishing)</small>` : ""}</p>
        <p class="detail-description">${escapeHTML(product.description)}</p>
        <div class="craft-facts">
          <div><span>FABRIC</span><strong>${escapeHTML(product.fabric)}</strong></div><div><span>WEAVE</span><strong>${escapeHTML(product.weave)}</strong></div>
          <div><span>REGION</span><strong>${escapeHTML(product.region)}</strong></div><div><span>OCCASION</span><strong>${escapeHTML(product.occasion)}</strong></div>
        </div>
        <div class="sensory-box">
          <div class="sensory-header"><span>FEEL &amp; DRAPE PROFILE</span><span>${escapeHTML(product.drape_feel || "Fluid & breathable")} · ${Number(product.weight_grams || 480)}g</span></div>
          <div class="sensory-grid">
            <div class="sensory-meter"><div class="sensory-meter-label"><span>Weight</span><span>${weightPct < 35 ? "Featherlight" : weightPct > 65 ? "Bridal Rich" : "Balanced"}</span></div><div class="sensory-track"><div class="sensory-fill" style="width:${weightPct}%"></div></div></div>
            <div class="sensory-meter"><div class="sensory-meter-label"><span>Drape Flow</span><span>${drapePct > 80 ? "Fluid Fall" : "Sculpted"}</span></div><div class="sensory-track"><div class="sensory-fill" style="width:${drapePct}%"></div></div></div>
            <div class="sensory-meter"><div class="sensory-meter-label"><span>Sheerness</span><span>${escapeHTML(product.sheerness || "Opaque")}</span></div><div class="sensory-track"><div class="sensory-fill" style="width:${sheerPct}%"></div></div></div>
            <div class="sensory-meter"><div class="sensory-meter-label"><span>Zari Luster</span><span>${lusterPct > 75 ? "Luminous" : "Subtle"}</span></div><div class="sensory-track"><div class="sensory-fill" style="width:${lusterPct}%"></div></div></div>
          </div>
        </div>
        <div class="finishing-box">
          <span class="finishing-title">SAREE FINISHING &amp; BLOUSE</span>
          <div class="finishing-options">
            <label class="finishing-option ${state.finishing.fallPico ? "selected" : ""}"><span><input type="checkbox" data-action="toggle-finishing" data-value="fallPico" ${state.finishing.fallPico ? "checked" : ""}>Add Fall &amp; Pico Edging</span><strong>+ ₹250</strong></label>
            <label class="finishing-option ${state.finishing.tassels ? "selected" : ""}"><span><input type="checkbox" data-action="toggle-finishing" data-value="tassels" ${state.finishing.tassels ? "checked" : ""}>Hand-Knotted Pallu Tassels (Kuchu)</span><strong>+ ₹350</strong></label>
          </div>
        </div>
        <p class="stock-note">${product.stock > 0 ? `${product.stock} pieces available · Unstitched ${Number(product.blouse_piece_meters || 0.8)}m blouse piece included` : "Currently out of stock"}</p>
        <div class="purchase-row">
          <div class="quantity-control"><button data-action="product-quantity" data-id="${product.product_id}" data-delta="-1" aria-label="Decrease quantity" ${state.quantity <= 1 ? "disabled" : ""}>−</button><span>${state.quantity}</span><button data-action="product-quantity" data-id="${product.product_id}" data-delta="1" aria-label="Increase quantity" ${state.quantity >= product.stock ? "disabled" : ""}>+</button></div>
          <button class="button button-dark" data-action="product-add" data-id="${product.product_id}" ${product.stock < 1 ? "disabled" : ""}>Add to bag</button>
          <button type="button" class="button button-outline" data-action="toggle-wishlist" data-id="${product.product_id}" aria-label="${isSaved ? "Remove from saved weaves" : "Save weave"}">${isSaved ? "♥ Saved" : "♡ Save"}</button>
        </div>
        <button class="button button-outline full-button buy-button" data-action="product-buy" data-id="${product.product_id}" ${product.stock < 1 ? "disabled" : ""}>Buy now</button>
        <div class="wv-accordion">
          ${acc("dimensions", "Dimensions &amp; Blouse Piece", `Total saree length: <strong>${Number(product.length_meters || 6.2)} metres</strong> (includes <strong>${Number(product.blouse_piece_meters || 0.8)}m</strong> matching unstitched blouse piece). Standard width: 1.15m.`)}
          ${acc("care", "Wash, Ironing &amp; Storage Care", `${escapeHTML(product.care_instructions || "Dry clean recommended, store folded in unbleached muslin.")} Refold along alternate creases every few months to preserve zari.`)}
          ${acc("provenance", "Artisan Provenance &amp; Shipping", `Woven in ${escapeHTML(product.region)} using authentic ${escapeHTML(product.weave)} techniques. Ships in breathable cotton storage wrap within 48 hours.`)}
        </div>
        <p class="photo-credit">${photoLink ? `<a href="${escapeHTML(photoLink)}" target="_blank" rel="noreferrer">Photo: ${escapeHTML(product.image_credit)} · ${escapeHTML(product.image_license)}</a>` : `Photo: ${escapeHTML(product.image_credit)}`}</p>
        <p class="photo-disclaimer">Model photography is for styling inspiration. Please confirm the exact saree colours and details before ordering.</p>
      </div>
    </div>
    <section class="reviews-section">
      <div class="reviews-summary"><p class="eyebrow">CUSTOMER REVIEWS</p><h2>Worn &amp; <em>loved.</em></h2>
        ${product.review_count > 0 ? `<div class="large-rating">${Number(product.average_rating).toFixed(1)} <span>★★★★★</span></div>` : "<p>There are no reviews yet. Be the first to share your experience.</p>"}
        <p>${product.review_count} ${product.review_count === 1 ? "review" : "reviews"}</p>
      </div>
      <div class="review-content">${reviewForm}${reviewList}</div>
    </section>
  </section>`;
}

function passwordField(labelText, name, autocomplete) {
  return `<label>${labelText}
    <div class="password-field">
      <input name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" maxlength="128">
      <button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password" aria-pressed="false" title="Show password">
        <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <svg class="eye-closed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 3l18 18"/>
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
          <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.2 0 10 7 10 7a18.3 18.3 0 0 1-4.1 4.9"/>
          <path d="M6.6 6.6A18.3 18.3 0 0 0 2 12s3.8 7 10 7a9.7 9.7 0 0 0 4.3-1"/>
        </svg>
      </button>
    </div>
  </label>`;
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
        ${passwordField("Password", "password", isRegister ? "new-password" : "current-password")}
        ${isRegister ? passwordField("Confirm password", "password_confirm", "new-password") : ""}
        ${state.authError ? `<p class="form-error" role="alert">${escapeHTML(state.authError)}</p>` : ""}
        <button class="button button-dark full-button" ${state.busy ? "disabled" : ""}>${state.busy ? "Please wait..." : isRegister ? "Create my account" : "Sign in"}</button>
      </form>
      <p class="account-switch">${isRegister ? "Already have an account?" : "New to WeaveVerse?"} <a href="${isRegister ? "#login" : "#register"}">${isRegister ? "Sign in" : "Create an account"}</a></p>
      <p class="account-security">Your password is securely hashed before it is saved.</p>
    </div>
  </section>`;
}

function orderTrackingInfo(order) {
  const placedAt = new Date(order.created_at);
  const totalDays = 5;
  const elapsedDays = Math.max(0, Math.floor((Date.now() - placedAt.getTime()) / 86400000));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const etaDate = new Date(placedAt.getTime() + totalDays * 86400000);
  const etaLabel = etaDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const stageIndex = order.status === "delivered"
    ? 4
    : elapsedDays >= 5 ? 4 : elapsedDays >= 4 ? 3 : elapsedDays >= 2 ? 2 : elapsedDays >= 1 ? 1 : 0;
  const steps = ["Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered"];
  const etaText = stageIndex >= 4
    ? `Delivered on ${etaLabel}`
    : remainingDays === 0
      ? `Arriving today (${etaLabel})`
      : `Arriving in ${remainingDays} ${remainingDays === 1 ? "day" : "days"} · Expected by ${etaLabel}`;
  const events = [
    { label: "Order Confirmed & Weaver Dispatch Assigned", loc: "Varanasi Handloom Hub", done: stageIndex >= 0 },
    { label: "Quality Checked, Folded & Silk-Wrapped", loc: "Varanasi Artisan Studio", done: stageIndex >= 1 },
    { label: `Shipped via WeaveVerse Express (AWB WV${10420 + Number(order.order_id)})`, loc: "Regional Transit Hub", done: stageIndex >= 2 },
    { label: "Out for Delivery with Courier Partner", loc: "Your Local Delivery Centre", done: stageIndex >= 3 },
    { label: "Delivered to Customer", loc: "Signed & Received", done: stageIndex >= 4 },
  ];
  return { etaText, etaLabel, remainingDays, stageIndex, steps, events };
}

function accountDashboard() {
  const content = state.ordersLoading
    ? `<div class="empty-state"><p>Loading your orders...</p></div>`
    : state.orders.length
      ? `<div class="orders-list">${state.orders.map((order) => {
          const track = orderTrackingInfo(order);
          const isExpanded = state.expandedTrackId === order.order_id;
          return `<article class="order-card">
            <div class="order-heading">
              <div><span>ORDER</span><strong>#${order.order_id}</strong></div>
              <div><span>PLACED</span><strong>${new Date(order.created_at).toLocaleDateString("en-IN")}</strong></div>
              <div><span>STATUS</span><strong class="order-status">${escapeHTML(track.steps[track.stageIndex])}</strong></div>
              <strong>${money(order.total_amount)}</strong>
            </div>
            <ul>${order.items.map((item) => `<li>${escapeHTML(item.saree_name)} <span>× ${item.quantity}${item.customization_note ? ` · ${escapeHTML(item.customization_note)}` : ""}</span></li>`).join("")}</ul>
            <div class="order-eta-banner">
              <span>🚚 <strong>${escapeHTML(track.etaText)}</strong></span>
              <span class="muted">Tracking ID: WV${10420 + Number(order.order_id)}</span>
            </div>
            <div class="track-stepper" aria-label="Order tracking progress">
              ${track.steps.map((step, idx) => {
                const cls = idx < track.stageIndex ? "done" : idx === track.stageIndex ? "current" : "";
                return `<div class="track-step ${cls}"><span class="track-dot">${idx <= track.stageIndex ? "✓" : idx + 1}</span><span class="track-label">${step}</span></div>`;
              }).join("")}
            </div>
            <div class="order-card-actions">
              <button type="button" class="button button-outline" style="min-height:34px;padding:0 14px;" data-action="toggle-track" data-id="${order.order_id}">${isExpanded ? "Hide tracking details" : "Track package"}</button>
              <button type="button" class="button button-outline" style="min-height:34px;padding:0 14px;" data-action="view-order-bill" data-id="${order.order_id}">View bill / invoice</button>
            </div>
            ${isExpanded ? `<div class="track-timeline">
              ${track.events.map((ev) => `<div class="track-event ${ev.done ? "done" : ""}"><span>${ev.done ? "●" : "○"} ${escapeHTML(ev.label)}</span><span class="muted">${escapeHTML(ev.loc)}</span></div>`).join("")}
            </div>` : ""}
          </article>`;
        }).join("")}</div>`
      : `<div class="empty-state"><p>Your order history is waiting for its first story.</p><a class="button button-dark" href="#shop">Explore sarees</a></div>`;
  return `<section class="page-shell account-dashboard">
    <p class="eyebrow">YOUR ACCOUNT</p><h1>Namaste, <em>${escapeHTML(state.customer.first_name)}.</em></h1><p class="muted">${escapeHTML(state.customer.email)}</p>
    <div class="orders-heading"><h2>Your orders &amp; tracking</h2><a class="text-link" href="#shop">Continue shopping <span>→</span></a></div>${content}
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
  </footer>`;
}

function cartDrawer() {
  if (!state.cartOpen) return "";
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + (Number(item.price) + Number(item.addon_price || 0)) * item.quantity, 0);
  const content = state.cart.length
    ? `<div class="cart-items">${state.cart.map((item) => `<article class="cart-item">
        <img src="${escapeHTML(item.image_url)}" alt=""><div class="cart-item-copy">
          <a href="#product/${item.product_id}" data-action="close-cart">${escapeHTML(item.saree_name)}</a>
          <span>${money(Number(item.price) + Number(item.addon_price || 0))}</span>
          ${item.customization_note ? `<small class="muted">${escapeHTML(item.customization_note)}</small>` : ""}
          <div class="quantity-control small"><button data-action="cart-quantity" data-id="${item.product_id}" data-delta="-1" aria-label="Remove one ${escapeHTML(item.saree_name)}">−</button><span>${item.quantity}</span><button data-action="cart-quantity" data-id="${item.product_id}" data-delta="1" aria-label="Add one ${escapeHTML(item.saree_name)}">+</button></div>
        </div><button class="remove-button" data-action="remove-cart" data-id="${item.product_id}">Remove</button>
      </article>`).join("")}</div>
      <div class="cart-summary"><div><span>Subtotal</span><strong>${money(total)}</strong></div><p>Choose Paytm, Google Pay, UPI, Card, or COD in the next step.</p><button class="button button-dark full-button" data-action="open-checkout" ${state.busy ? "disabled" : ""}>Proceed to payment</button></div>`
    : `<div class="empty-cart"><p>Your bag is waiting for something beautiful.</p><a href="#shop" class="button button-dark" data-action="close-cart">Explore sarees</a></div>`;
  return `<div class="overlay" data-action="overlay">
    <aside class="cart-drawer" aria-label="Shopping bag">
      <div class="drawer-heading"><div><p class="eyebrow">YOUR SELECTION</p><h2>Your bag <span>(${count})</span></h2></div><button class="close-button" data-action="close-cart" aria-label="Close bag">×</button></div>
      ${content}
    </aside>
  </div>`;
}

function wishlistDrawer() {
  if (!state.wishlistOpen) return "";
  const savedProducts = state.products.filter((p) => state.wishlist.includes(p.product_id));
  const content = savedProducts.length
    ? `<div class="cart-items">${savedProducts.map((p) => `<article class="cart-item">
        <img src="${escapeHTML(p.image_url)}" alt=""><div class="cart-item-copy">
          <a href="#product/${p.product_id}" data-action="close-wishlist">${escapeHTML(p.saree_name)}</a>
          <span>${money(p.price)} · ${escapeHTML(p.weave)}</span>
          <button type="button" class="button button-dark" style="min-height:32px;padding:0 12px;width:max-content;" data-action="add-cart" data-id="${p.product_id}">Add to bag</button>
        </div><button class="remove-button" data-action="toggle-wishlist" data-id="${p.product_id}">Remove</button>
      </article>`).join("")}</div>`
    : `<div class="empty-cart"><p>Tap ♡ on any saree to save it for later.</p><a href="#shop" class="button button-dark" data-action="close-wishlist">Browse sarees</a></div>`;
  return `<div class="overlay" data-action="overlay">
    <aside class="cart-drawer" aria-label="Saved weaves">
      <div class="drawer-heading"><div><p class="eyebrow">CURATED BY YOU</p><h2>Saved weaves <span>(${savedProducts.length})</span></h2></div><button class="close-button" data-action="close-wishlist" aria-label="Close saved weaves">×</button></div>
      ${content}
    </aside>
  </div>`;
}

function mobileMenuSheet() {
  if (!state.menuOpen) return "";
  const weaves = ["Silk", "Cotton", "Tussar silk", "Organza", "Linen"];
  return `<div class="overlay" data-action="overlay">
    <aside class="mobile-sheet" aria-label="Mobile navigation">
      <div class="drawer-heading"><div><p class="eyebrow">NAVIGATION</p><h2>WeaveVerse</h2></div><button class="close-button" data-action="close-menu" aria-label="Close menu">×</button></div>
      <nav class="mobile-nav-list">
        <a class="mobile-nav-link ${state.route.page === "home" ? "active" : ""}" href="#home" data-action="close-menu">Home <span>→</span></a>
        <a class="mobile-nav-link ${state.route.page === "shop" ? "active" : ""}" href="#shop" data-action="close-menu">Shop Collection <span>→</span></a>
        <a class="mobile-nav-link ${state.route.page === "contact" ? "active" : ""}" href="#contact" data-action="close-menu">Contact Us <span>→</span></a>
        <a class="mobile-nav-link ${state.route.page === "account" ? "active" : ""}" href="${state.customer ? "#account" : "#login"}" data-action="close-menu">${state.customer ? `Hi, ${escapeHTML(state.customer.first_name)}` : "Sign in / Register"} <span>→</span></a>
      </nav>
      <div>
        <p class="eyebrow" style="margin-bottom:10px;">SHOP BY WEAVE</p>
        <div class="mobile-weave-chips">
          ${weaves.map((w) => `<a class="mobile-weave-chip" href="#shop/${encodeURIComponent(w)}" data-action="close-menu">${escapeHTML(w)}</a>`).join("")}
        </div>
      </div>
      <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:16px;">
        <span class="muted">Appearance</span>
        <button type="button" class="icon-pill-btn" data-action="theme">${state.theme === "light" ? "☾ Dark Mode" : "☀ Light Mode"}</button>
      </div>
    </aside>
  </div>`;
}

function quickViewModal() {
  if (!state.quickViewId) return "";
  const product = state.products.find((p) => p.product_id === state.quickViewId);
  if (!product) return "";
  return `<div class="overlay" data-action="overlay">
    <div class="quick-view-dialog" role="dialog" aria-label="Quick view ${escapeHTML(product.saree_name)}">
      <button class="close-button" data-action="close-quick-view" aria-label="Close quick view">×</button>
      <div class="quick-view-media"><img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.saree_name)}" style="object-position:${escapeHTML(product.focal_point || "50% 18%")};"></div>
      <div style="display:grid;gap:12px;align-content:center;">
        <p class="eyebrow" style="margin:0;">${escapeHTML(product.fabric)} · ${escapeHTML(product.region)}</p>
        <h2 style="font-size:32px;margin:0;">${escapeHTML(product.saree_name)}</h2>
        <strong style="font-size:18px;">${money(product.price)}</strong>
        <p class="muted" style="line-height:1.7;margin:0;">${escapeHTML(product.description)}</p>
        <div class="craft-facts" style="margin:8px 0;">
          <div><span>WEAVE</span><strong>${escapeHTML(product.weave)}</strong></div>
          <div><span>DRAPE</span><strong>${escapeHTML(product.drape_feel || "Fluid & breathable")}</strong></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="button button-dark" data-action="add-cart" data-id="${product.product_id}" ${product.stock < 1 ? "disabled" : ""}>Add to bag</button>
          <a class="button button-outline" href="#product/${product.product_id}" data-action="close-quick-view">Full details &amp; zoom →</a>
        </div>
      </div>
    </div>
  </div>`;
}

const paymentOptions = [
  { id: "gpay", badge: "GPay", label: "Google Pay (UPI)", hint: "Instant UPI approval" },
  { id: "paytm", badge: "Paytm", label: "Paytm UPI / Wallet", hint: "Paytm wallet or UPI" },
  { id: "phonepe", badge: "UPI", label: "PhonePe / Any UPI ID", hint: "Enter UPI ID or QR" },
  { id: "card", badge: "CARD", label: "Credit / Debit Card", hint: "Visa, Mastercard, RuPay" },
  { id: "cod", badge: "COD", label: "Cash on Delivery", hint: "Pay when your saree arrives" },
];

function checkoutModal() {
  if (!state.checkoutOpen) return "";
  const total = state.cart.reduce((sum, item) => sum + (Number(item.price) + Number(item.addon_price || 0)) * item.quantity, 0);
  const selected = paymentOptions.find((opt) => opt.id === state.paymentMethod) || paymentOptions[0];
  const needsUpi = ["gpay", "paytm", "phonepe"].includes(selected.id);
  return `<div class="overlay" data-action="overlay">
    <div class="checkout-dialog" role="dialog" aria-label="Payment and bill summary">
      <button class="close-button" data-action="close-checkout" aria-label="Close checkout">×</button>
      <div>
        <p class="eyebrow" style="margin:0;">SECURE CHECKOUT</p>
        <h2 style="margin:4px 0 0;">Select payment &amp; review bill</h2>
      </div>
      <div class="checkout-grid">
        <div>
          <p class="eyebrow" style="margin:0 0 10px;">PAYMENT OPTIONS</p>
          <div class="payment-methods-grid">
            ${paymentOptions.map((opt) => `<button type="button" class="payment-option ${state.paymentMethod === opt.id ? "selected" : ""}" data-action="select-payment" data-value="${opt.id}">
              <span class="payment-option-left">
                <span class="payment-badge">${opt.badge}</span>
                <span><strong>${opt.label}</strong><br><small class="muted">${opt.hint}</small></span>
              </span>
              <span>${state.paymentMethod === opt.id ? "●" : "○"}</span>
            </button>`).join("")}
          </div>
          ${needsUpi ? `<div class="payment-extra-box">
            <label style="font-size:11px;color:var(--muted);">UPI ID (optional for demo)<input id="checkout-upi" value="${escapeHTML(state.upiId)}" placeholder="yourname@okaxis"></label>
          </div>` : selected.id === "card" ? `<div class="payment-extra-box">
            <label style="font-size:11px;color:var(--muted);">Card Number (demo)<input id="checkout-card" placeholder="4532 •••• •••• 8842" maxlength="19"></label>
          </div>` : `<div class="payment-extra-box"><span class="muted" style="font-size:12px;">Pay ${money(total)} in cash or UPI to the courier partner at delivery.</span></div>`}
        </div>
        <div class="bill-card">
          <div class="bill-header">
            <div><p class="eyebrow" style="margin:0;">ESTIMATED BILL</p><strong>WeaveVerse Tax Invoice</strong></div>
            <span class="muted" style="font-size:11px;">GST Included</span>
          </div>
          <div class="bill-items">
            ${state.cart.map((item) => {
              const unit = Number(item.price) + Number(item.addon_price || 0);
              return `<div class="bill-row">
                <span>${escapeHTML(item.saree_name)} × ${item.quantity}${item.customization_note ? `<br><small class="muted">${escapeHTML(item.customization_note)}</small>` : ""}</span>
                <strong>${money(unit * item.quantity)}</strong>
              </div>`;
            }).join("")}
            <div class="bill-row muted-row"><span>Handloom Gift Box &amp; Insured Shipping</span><span>FREE</span></div>
            <div class="bill-row muted-row"><span>Payment Method</span><span>${escapeHTML(selected.label)}</span></div>
          </div>
          <div class="bill-total-row">
            <strong>Total Payable</strong>
            <strong>${money(total)}</strong>
          </div>
          <button type="button" class="button button-dark full-button" data-action="confirm-payment" ${state.busy ? "disabled" : ""}>
            ${state.busy ? '<span class="btn-spinner"></span> Processing payment...' : selected.id === "cod" ? `Confirm COD Order · ${money(total)}` : `Pay ${money(total)}`}
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function paymentSuccessModal() {
  const bill = state.lastBill;
  if (!bill) return "";
  return `<div class="overlay" data-action="overlay">
    <div class="payment-success-dialog" role="dialog" aria-label="Payment confirmation and invoice">
      <button class="close-button" data-action="close-bill" aria-label="Close bill">×</button>
      <div class="success-banner">
        <div class="success-check">✓</div>
        <div>
          <p class="eyebrow" style="margin:0;color:#16a34a;">PAYMENT DONE</p>
          <h2 style="margin:2px 0 2px;font-size:24px;">Order #${bill.orderId} Confirmed!</h2>
          <p class="muted" style="margin:0;font-size:12px;">Paid via ${escapeHTML(bill.methodLabel)} · Expected delivery in 5 days</p>
        </div>
      </div>
      <div class="bill-card">
        <div class="bill-header">
          <div>
            <p class="eyebrow" style="margin:0;">INVOICE ${escapeHTML(bill.invoiceNo)}</p>
            <strong>WeaveVerse Handlooms</strong>
            <div class="muted" style="font-size:11px;">Txn ID: ${escapeHTML(bill.txnId)}</div>
          </div>
          <div style="text-align:right;font-size:11px;">
            <div>${escapeHTML(bill.dateLabel)}</div>
            <div style="color:#16a34a;font-weight:700;">${escapeHTML(bill.paymentStatus)}</div>
          </div>
        </div>
        <div class="bill-items">
          ${bill.items.map((item) => `<div class="bill-row">
            <span>${escapeHTML(item.saree_name)} × ${item.quantity}${item.customization_note ? `<br><small class="muted">${escapeHTML(item.customization_note)}</small>` : ""}</span>
            <strong>${money(item.lineTotal)}</strong>
          </div>`).join("")}
          <div class="bill-row muted-row"><span>Billed to</span><span>${escapeHTML(bill.customerName)}</span></div>
          <div class="bill-row muted-row"><span>Delivery &amp; Packaging</span><span>FREE (5-day express)</span></div>
        </div>
        <div class="bill-total-row">
          <strong>Total Amount Paid</strong>
          <strong>${money(bill.total)}</strong>
        </div>
      </div>
      <div class="bill-actions">
        <button type="button" class="button button-dark" data-action="track-latest-order">Track order →</button>
        <button type="button" class="button button-outline" data-action="print-bill">Print / Save Bill</button>
        <button type="button" class="button button-outline" data-action="close-bill">Continue shopping</button>
      </div>
    </div>
  </div>`;
}

function pageContent() {
  if (state.route.page === "home") return homePage();
  if (state.route.page === "shop") return catalogPage();
  if (state.route.page === "contact") return contactPage();
  if (state.route.page === "login" || state.route.page === "register") return accountPage(state.route.page === "register");
  if (state.route.page === "orders") {
    return state.customer
      ? accountDashboard()
      : `<div class="page-shell empty-state"><p class="eyebrow">ORDER TRACKING</p><h1>Track your <em>weave.</em></h1><p>Sign in to check live dispatch status, delivery ETA, and invoices for your orders.</p><a class="button button-dark" href="#login">Sign in to track orders</a></div>`;
  }
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

/* ---------- Motion (https://motion.dev) animations ---------- */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motionLib = () => window.Motion || null;
const easeOut = [0.22, 1, 0.36, 1];
const anim = { pageKey: "", gridCount: 0, notice: "", cartOpen: false, observers: [] };

function pageKey() {
  return `${state.route.page}:${state.route.productId || ""}:${state.route.fabric || ""}`;
}

function animateEntrance(main) {
  const M = motionLib();
  if (!M || reducedMotion) return;
  const { animate, stagger, inView } = M;

  const heroItems = main.querySelectorAll(".hero-copy > *, .catalog-intro > *, .detail-copy > *, .account-panel > *, .contact-page > .eyebrow, .contact-page > h1, .contact-page > p, .account-dashboard > *");
  if (heroItems.length) {
    animate(heroItems, { opacity: [0, 1], transform: ["translateY(22px)", "translateY(0px)"] },
      { duration: 0.8, delay: stagger(0.07), ease: easeOut });
  }
  const visuals = main.querySelectorAll(".detail-image, .account-photo");
  if (visuals.length) {
    animate(visuals, { opacity: [0, 1], transform: ["scale(0.96) translateY(18px)", "scale(1) translateY(0px)"] },
      { duration: 1, ease: easeOut });
  }
  const strip = main.querySelectorAll(".promise-strip span");
  if (strip.length) {
    animate(strip, { opacity: [0, 1], transform: ["translateY(10px)", "translateY(0px)"] },
      { duration: 0.6, delay: stagger(0.08, { startDelay: 0.3 }), ease: easeOut });
  }
  revealOnScroll(main, ".fabric-tile", 0.04);
  revealOnScroll(main, ".product-card", 0.08);
  revealOnScroll(main, ".section-heading, .story-copy, .story-image, .contact-section > *, .reviews-section > *, .craft-facts, .purchase-row, .review, .order-card, .catalog-tools, .catalog-refine", 0.06);
}

function initHeroLogo(main) {
  const stage = main.querySelector(".hero-logo-stage");
  const orb = stage && stage.querySelector(".hero-logo-orb");
  if (!stage || !orb || orb.dataset.logoInit) return;
  orb.dataset.logoInit = "1";

  let rotX = 4, rotY = -6;
  let targetX = 4, targetY = -6;
  let dragging = false, lastX = 0, lastY = 0;
  let hoverX = 0, hoverY = 0;
  let t = 0;
  let lastNow = performance.now();

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.classList.add("is-dragging");
  };
  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    hoverX = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
    hoverY = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
    if (dragging) {
      targetY += (e.clientX - lastX) * 0.25;
      targetX -= (e.clientY - lastY) * 0.25;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  };
  const onUp = () => {
    dragging = false;
    stage.classList.remove("is-dragging");
  };

  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function frame(now) {
    if (!orb.isConnected) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, ((now || performance.now()) - lastNow) / 1000));
    lastNow = now || performance.now();
    if (!reducedMotion) t += dt * 0.75;
    if (!dragging) {
      const idleX = Math.sin(t * 0.7) * 6 - hoverY * 8;
      const idleY = Math.cos(t * 0.55) * 9 + hoverX * 10;
      targetX += (idleX - targetX) * 0.035;
      targetY += (idleY - targetY) * 0.035;
    }
    rotX += (targetX - rotX) * 0.08;
    rotY += (targetY - rotY) * 0.08;
    const floatY = reducedMotion ? 0 : Math.sin(t * 0.9) * 10;
    const floatX = reducedMotion ? 0 : Math.cos(t * 0.6) * 5;
    orb.style.transform = `translate3d(${floatX.toFixed(2)}px, ${floatY.toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function whenDone(animResult, cb) {
  const p = animResult && (animResult.finished || (typeof animResult.then === "function" ? animResult : null));
  if (p && typeof p.then === "function") p.then(cb, cb);
  else cb();
}

function revealOnScroll(scope, selector, step) {
  const { animate, inView } = motionLib();
  const items = [...scope.querySelectorAll(selector)];
  items.forEach((el) => { el.style.opacity = "0"; });
  let index = 0;
  items.forEach((el) => {
    inView(el, () => {
      const delay = Math.min(index++ % 6, 5) * step;
      whenDone(
        animate(el, { opacity: [0, 1], transform: ["translateY(28px)", "translateY(0px)"] }, { duration: 0.75, delay, ease: easeOut }),
        () => { el.style.opacity = ""; el.style.transform = ""; }
      );
    }, { margin: "0px 0px -8% 0px" });
  });
}

function animateGridIn(main) {
  const M = motionLib();
  if (!M || reducedMotion) return;
  const cards = main.querySelectorAll(".product-card");
  if (!cards.length) return;
  M.animate(cards, { opacity: [0, 1], transform: ["translateY(24px)", "translateY(0px)"] },
    { duration: 0.6, delay: M.stagger(0.045), ease: easeOut });
}

function animateOverlays() {
  const M = motionLib();
  if (!M || reducedMotion) return;
  const notice = root.querySelector(".toast");
  if (notice && state.notice !== anim.notice) {
    M.animate(notice, { opacity: [0, 1], transform: ["translateX(-50%) translateY(18px)", "translateX(-50%) translateY(0px)"] },
      { duration: 0.45, ease: easeOut });
  }
  const overlay = root.querySelector(".overlay");
  const overlayNow = state.cartOpen || state.wishlistOpen || Boolean(state.quickViewId) || state.checkoutOpen || Boolean(state.lastBill);
  if (overlay && !anim.overlayOpen && overlayNow) {
    M.animate(overlay, { opacity: [0, 1] }, { duration: 0.28 });
    const drawer = overlay.querySelector(".cart-drawer, .mobile-sheet");
    if (drawer) M.animate(drawer, { transform: ["translateX(100%)", "translateX(0%)"] }, { duration: 0.44, ease: easeOut });
    const dialog = overlay.querySelector(".quick-view-dialog, .checkout-dialog, .payment-success-dialog");
    if (dialog) M.animate(dialog, { opacity: [0, 1], transform: ["scale(0.96) translateY(12px)", "scale(1) translateY(0px)"] }, { duration: 0.36, ease: easeOut });
    const items = overlay.querySelectorAll(".cart-item, .empty-cart, .cart-summary, .mobile-nav-link");
    if (items.length) M.animate(items, { opacity: [0, 1], transform: ["translateX(16px)", "translateX(0px)"] },
      { duration: 0.4, delay: M.stagger(0.045, { startDelay: 0.1 }), ease: easeOut });
  }
}

function closeOverlaysAnimated(targetState = "all") {
  const M = motionLib();
  const overlay = root.querySelector(".overlay");
  const finish = () => {
    if (targetState === "cart" || targetState === "all") state.cartOpen = false;
    if (targetState === "wishlist" || targetState === "all") state.wishlistOpen = false;
    if (targetState === "menu" || targetState === "all") state.menuOpen = false;
    if (targetState === "quickView" || targetState === "all") state.quickViewId = null;
    if (targetState === "checkout" || targetState === "all") state.checkoutOpen = false;
    if (targetState === "bill" || targetState === "all") state.lastBill = null;
    render();
  };
  if (!M || reducedMotion || !overlay) return finish();
  const drawer = overlay.querySelector(".cart-drawer, .mobile-sheet");
  const dialog = overlay.querySelector(".quick-view-dialog, .checkout-dialog, .payment-success-dialog");
  M.animate(overlay, { opacity: [1, 0] }, { duration: 0.22 });
  if (drawer) whenDone(M.animate(drawer, { transform: ["translateX(0%)", "translateX(100%)"] }, { duration: 0.28, ease: [0.64, 0, 0.78, 0] }), finish);
  else if (dialog) whenDone(M.animate(dialog, { opacity: [1, 0], transform: ["scale(1)", "scale(0.96)"] }, { duration: 0.22 }), finish);
  else finish();
}

function bumpBagCount() {
  const M = motionLib();
  const badge = root.querySelector(".bag-button span");
  if (M && badge && !reducedMotion) M.animate(badge, { transform: ["scale(1)", "scale(1.35)", "scale(1)"] }, { duration: 0.45, ease: easeOut });
}

let lastCartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

const routeOrder = { home: 0, shop: 1, product: 2, contact: 3, orders: 4, login: 5, register: 5, account: 6 };

function pageDirection(prevKey, nextKey) {
  if (!prevKey) return 1;
  const prevPage = prevKey.split(":")[0];
  const nextPage = nextKey.split(":")[0];
  const a = routeOrder[prevPage] ?? 0;
  const b = routeOrder[nextPage] ?? 0;
  return b >= a ? 1 : -1;
}

function ensureAppShell() {
  if (root.querySelector("#page-stage")) return;
  root.innerHTML = `<div id="header-slot"></div><div id="page-stage"></div><div id="footer-slot"></div><div id="overlay-slot"></div>`;
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", state.theme === "dark" ? "#120E0D" : "#FAF6F0");
  ensureAppShell();

  const headerSlot = root.querySelector("#header-slot");
  const stage = root.querySelector("#page-stage");
  const footerSlot = root.querySelector("#footer-slot");
  const overlaySlot = root.querySelector("#overlay-slot");

  headerSlot.innerHTML = pageHeader();
  footerSlot.innerHTML = footer();
  overlaySlot.innerHTML = `${state.notice ? `<div class="toast" role="status">${escapeHTML(state.notice)}</div>` : ""}${cartDrawer()}${wishlistDrawer()}${quickViewModal()}${checkoutModal()}${paymentSuccessModal()}`;

  const key = pageKey();
  const pageChanged = key !== anim.pageKey;
  const M = motionLib();
  const oldSheet = stage.querySelector(".page-sheet.is-entering");

  let activeMain;
  if (pageChanged && oldSheet && anim.pageKey && M && !reducedMotion) {
    const dir = pageDirection(anim.pageKey, key);
    const prevScrollY = window.scrollY;

    // Anchor leaving sheet at its exact visual scroll offset so resetting scroll never shifts it
    const leaving = oldSheet;
    leaving.classList.remove("is-entering");
    leaving.classList.add("is-leaving");
    leaving.style.top = `${-prevScrollY}px`;
    leaving.style.transformOrigin = "";

    const entering = document.createElement("main");
    entering.className = "page-sheet is-entering";
    entering.style.transformOrigin = "";
    entering.innerHTML = pageContent();
    stage.appendChild(entering);
    activeMain = entering;

    if (prevScrollY > 0) {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = "";
    }

    const slidePx = dir > 0 ? 22 : -22;

    whenDone(
      M.animate(leaving, {
        transform: ["translate3d(0px, 0px, 0px)", `translate3d(${-slidePx}px, 0px, 0px)`],
        opacity: [1, 0],
      }, { duration: 0.45, ease: [0.22, 1, 0.36, 1] }),
      () => {
        leaving.remove();
      }
    );

    whenDone(
      M.animate(entering, {
        transform: [`translate3d(${slidePx}px, 0px, 0px)`, "translate3d(0px, 0px, 0px)"],
        opacity: [0, 1],
      }, { duration: 0.58, ease: [0.22, 1, 0.36, 1] }),
      () => {
        entering.style.transform = "";
        entering.style.opacity = "";
      }
    );
  } else {
    stage.innerHTML = `<main class="page-sheet is-entering">${pageContent()}</main>`;
    activeMain = stage.querySelector("main");
    if (pageChanged) {
      if (anim.pageKey && window.scrollY > 0) {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
        document.documentElement.style.scrollBehavior = "";
      }
      animateEntrance(activeMain);
    }
  }

  const gridCount = activeMain.querySelectorAll(".product-card").length;
  if (!pageChanged && gridCount && gridCount !== anim.gridCount && anim.gridCount === 0) {
    animateGridIn(activeMain);
  }

  animateOverlays();
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount !== lastCartCount) bumpBagCount();
  lastCartCount = cartCount;
  anim.pageKey = key;
  anim.gridCount = gridCount;
  anim.notice = state.notice;
  anim.overlayOpen = state.cartOpen || state.wishlistOpen || Boolean(state.quickViewId) || state.checkoutOpen || Boolean(state.lastBill);
  enhanceSelects();
  initHeroLogo(activeMain);
}

/* ---- Dropdown menu (replaces native <select>) ---- */
function closeDropdowns(except) {
  const M = motionLib();
  document.querySelectorAll(".dd.open").forEach((dd) => {
    if (dd === except) return;
    const menu = dd.querySelector(".dd-menu");
    const finish = () => {
      dd.classList.remove("open");
      menu?.classList.remove("is-up");
      dd.querySelector(".dd-trigger")?.setAttribute("aria-expanded", "false");
    };
    if (M && menu && !reducedMotion) {
      whenDone(M.animate(menu, { opacity: [1, 0], transform: ["translateY(0) scale(1)", "translateY(-4px) scale(.96)"] }, { duration: 0.14 }), finish);
    } else finish();
  });
}

function enhanceSelects() {
  root.querySelectorAll("select").forEach((select) => {
    if (select.dataset.dd) return;
    select.dataset.dd = "1";
    select.classList.add("dd-native");
    const dd = document.createElement("div");
    dd.className = "dd";
    const label = () => select.options[select.selectedIndex]?.textContent.trim() || "";
    dd.innerHTML = `<button type="button" class="dd-trigger" aria-haspopup="menu" aria-expanded="false"><span class="dd-value"></span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <div class="dd-menu" role="menu">${[...select.options].map((o, i) => `<button type="button" role="menuitemradio" class="dd-item" data-index="${i}" aria-checked="${o.selected}">${escapeHTML(o.textContent.trim())}<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2.5 6.5 2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join("")}</div>`;
    select.after(dd);
    const trigger = dd.querySelector(".dd-trigger");
    const menu = dd.querySelector(".dd-menu");
    dd.querySelector(".dd-value").textContent = label();
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const open = !dd.classList.contains("open");
      closeDropdowns(dd);
      if (open) {
        const rect = trigger.getBoundingClientRect();
        menu.classList.toggle("is-up", window.innerHeight - rect.bottom < 220);
        dd.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        const M = motionLib();
        if (M && !reducedMotion) {
          M.animate(menu, { opacity: [0, 1], transform: ["translateY(-6px) scale(.96)", "translateY(0) scale(1)"] }, { duration: 0.18, ease: [0.22, 1, 0.36, 1] });
        }
      } else {
        closeDropdowns();
      }
    });
    menu.addEventListener("click", (e) => {
      e.preventDefault();
      const item = e.target.closest(".dd-item");
      if (!item) return;
      select.selectedIndex = Number(item.dataset.index);
      dd.querySelectorAll(".dd-item").forEach((el) => el.setAttribute("aria-checked", String(el === item)));
      dd.querySelector(".dd-value").textContent = label();
      closeDropdowns();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeDropdowns(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdowns();
  const dd = e.target.closest?.(".dd.open");
  if (dd && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    const items = [...dd.querySelectorAll(".dd-item")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  }
});

function saveCart() {
  localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
  render();
}

function addToCart(product, quantity = 1, finishing = null) {
  if (!product || product.stock < 1) {
    showNotice("This saree is currently out of stock.");
    return;
  }
  const extra = finishing || { note: "", addon: 0 };
  const existing = state.cart.find((item) => item.product_id === product.product_id);
  if (existing) {
    state.cart = state.cart.map((item) => item.product_id === product.product_id
      ? {
          ...item,
          quantity: Math.min(item.quantity + quantity, product.stock),
          customization_note: extra.note || item.customization_note || "",
          addon_price: extra.note ? extra.addon : (item.addon_price || 0),
        }
      : item);
  } else {
    state.cart = [...state.cart, {
      ...product,
      quantity: Math.min(quantity, product.stock),
      customization_note: extra.note,
      addon_price: extra.addon,
    }];
  }
  localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
  render();
  showNotice(`${product.saree_name} added to your bag.`);
}

async function toggleWishlist(productId) {
  if (!Number.isInteger(productId) || productId <= 0) return;
  const exists = state.wishlist.includes(productId);
  state.wishlist = exists
    ? state.wishlist.filter((id) => id !== productId)
    : [productId, ...state.wishlist];
  localStorage.setItem(storageKeys.wishlist, JSON.stringify(state.wishlist));
  render();
  showNotice(exists ? "Removed from Saved Weaves." : "Saved to your Weaves ♡");
  if (state.token) {
    apiRequest(`/wishlist/${productId}`, { method: "POST", token: state.token }).catch(() => {});
  }
}

async function loadProducts() {
  state.productsLoading = true;
  try {
    const result = await apiRequest("/products");
    state.products = result.products;
    state.catalogError = "";
    state.productsLoading = false;
    render();
    if (state.route.page === "product") loadReviews(state.route.productId);
  } catch (error) {
    state.catalogError = error.message;
    state.productsLoading = false;
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
  state.navHistory = state.navHistory.filter((h) => {
    const p = routePageFromHash(h);
    return p !== "account" && p !== "orders";
  });
  window.location.hash = "home";
  showNotice("You have been signed out.");
}

async function checkout() {
  if (!state.token) {
    state.postAuthReturnHash = currentHash();
    state.postAuthOpenCheckout = true;
    state.cartOpen = false;
    state.checkoutOpen = false;
    window.location.hash = "login";
    showNotice("Sign in to place your order.");
    return;
  }
  const upiInput = document.getElementById("checkout-upi");
  if (upiInput) state.upiId = upiInput.value.trim();
  const snapshotItems = state.cart.map((item) => {
    const unit = Number(item.price) + Number(item.addon_price || 0);
    return {
      saree_name: item.saree_name,
      quantity: item.quantity,
      customization_note: item.customization_note || "",
      lineTotal: unit * item.quantity,
    };
  });
  const selectedMethod = paymentOptions.find((o) => o.id === state.paymentMethod) || paymentOptions[0];
  state.busy = true;
  render();
  try {
    const result = await apiRequest("/orders", {
      method: "POST",
      token: state.token,
      body: JSON.stringify({
        items: state.cart.map(({ product_id, quantity, customization_note, addon_price }) => ({
          product_id,
          quantity,
          customization_note: customization_note || "",
          addon_price: addon_price || 0,
        })),
      }),
    });
    state.cart = [];
    localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
    state.cartOpen = false;
    state.checkoutOpen = false;
    state.lastBill = {
      orderId: result.order_id,
      invoiceNo: `WV-INV-${1000 + Number(result.order_id)}`,
      txnId: `TXN${Date.now().toString().slice(-8)}`,
      methodLabel: selectedMethod.label,
      paymentStatus: selectedMethod.id === "cod" ? "COD CONFIRMED" : "PAID",
      dateLabel: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      customerName: state.customer ? `${state.customer.first_name} ${state.customer.last_name}`.trim() : "Valued Customer",
      items: snapshotItems,
      total: Number(result.total_amount),
    };
    await loadProducts();
    if (state.token) loadOrders();
    showNotice(`Payment done! Order #${result.order_id} confirmed.`);
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
    state.navHistory = state.navHistory.filter((h) => {
      const p = routePageFromHash(h);
      return p !== "login" && p !== "register";
    });
    const returnHash = state.postAuthReturnHash;
    const reopenCheckout = state.postAuthOpenCheckout;
    state.postAuthReturnHash = "";
    state.postAuthOpenCheckout = false;
    if (returnHash) {
      if (reopenCheckout && state.cart.length > 0) {
        state.checkoutOpen = true;
      }
      if (currentHash() !== returnHash) {
        window.location.hash = returnHash;
      } else {
        render();
      }
      showNotice(`Welcome${result.customer.first_name ? `, ${result.customer.first_name}` : ""}! You can now complete your order.`);
    } else {
      window.location.hash = "account";
      showNotice(`Welcome${result.customer.first_name ? `, ${result.customer.first_name}` : ""}!`);
    }
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
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }
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
  if (action === "go-back") {
    goBack();
  } else if (action === "theme") {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem(storageKeys.theme, state.theme);
    render();
  } else if (action === "open-cart") {
    state.cartOpen = true;
    state.wishlistOpen = false;
    state.menuOpen = false;
    state.quickViewId = null;
    render();
  } else if (action === "close-cart") {
    closeOverlaysAnimated("cart");
  } else if (action === "open-wishlist") {
    state.wishlistOpen = true;
    state.cartOpen = false;
    state.menuOpen = false;
    state.quickViewId = null;
    render();
  } else if (action === "close-wishlist") {
    closeOverlaysAnimated("wishlist");
  } else if (action === "toggle-menu") {
    state.menuOpen = !state.menuOpen;
    if (state.menuOpen) {
      state.cartOpen = false;
      state.wishlistOpen = false;
      state.quickViewId = null;
    }
    render();
  } else if (action === "close-menu") {
    state.menuOpen = false;
    render();
  } else if (action === "quick-view" && product) {
    state.quickViewId = product.product_id;
    render();
  } else if (action === "close-quick-view") {
    closeOverlaysAnimated("quickView");
  } else if (action === "overlay" && clickEvent.target === button) {
    closeOverlaysAnimated("all");
  } else if (action === "toggle-wishlist") {
    toggleWishlist(productId);
  } else if (action === "select-shot") {
    state.activeShotIndex = Number(button.dataset.index || 0);
    render();
  } else if (action === "toggle-finishing") {
    const key = button.dataset.value;
    state.finishing[key] = !state.finishing[key];
    render();
  } else if (action === "toggle-acc") {
    const key = button.dataset.value;
    state.openAccordions[key] = !state.openAccordions[key];
    render();
  } else if (action === "sign-out") {
    signOut();
  } else if (action === "add-cart") {
    addToCart(product);
  } else if (action === "product-add" && product) {
    addToCart(product, state.quantity, productFinishingDetails());
  } else if (action === "product-buy" && product) {
    addToCart(product, state.quantity, productFinishingDetails());
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
  } else if (action === "toggle-password") {
    const field = button.closest(".password-field");
    const input = field && field.querySelector("input");
    if (input) {
      const nextVisible = input.type === "password";
      input.type = nextVisible ? "text" : "password";
      button.classList.toggle("is-visible", nextVisible);
      button.setAttribute("aria-pressed", String(nextVisible));
      button.setAttribute("aria-label", nextVisible ? "Hide password" : "Show password");
      button.setAttribute("title", nextVisible ? "Hide password" : "Show password");
    }
  } else if (action === "open-checkout") {
    if (!state.token) {
      state.postAuthReturnHash = currentHash();
      state.postAuthOpenCheckout = true;
      state.cartOpen = false;
      window.location.hash = "login";
      showNotice("Sign in to continue to payment.");
      return;
    }
    state.cartOpen = false;
    state.checkoutOpen = true;
    render();
  } else if (action === "close-checkout") {
    closeOverlaysAnimated("checkout");
  } else if (action === "select-payment") {
    const upiInput = document.getElementById("checkout-upi");
    if (upiInput) state.upiId = upiInput.value.trim();
    state.paymentMethod = button.dataset.value || "gpay";
    render();
  } else if (action === "confirm-payment") {
    checkout();
  } else if (action === "close-bill") {
    closeOverlaysAnimated("bill");
  } else if (action === "print-bill") {
    window.print();
  } else if (action === "track-latest-order") {
    const orderId = state.lastBill && state.lastBill.orderId;
    state.lastBill = null;
    if (orderId) state.expandedTrackId = orderId;
    window.location.hash = "account";
    render();
  } else if (action === "toggle-track") {
    const oid = Number(button.dataset.id);
    state.expandedTrackId = state.expandedTrackId === oid ? null : oid;
    render();
  } else if (action === "view-order-bill") {
    const oid = Number(button.dataset.id);
    const order = state.orders.find((o) => o.order_id === oid);
    if (order) {
      state.lastBill = {
        orderId: order.order_id,
        invoiceNo: `WV-INV-${1000 + Number(order.order_id)}`,
        txnId: `TXN${100000 + Number(order.order_id) * 7919}`,
        methodLabel: "WeaveVerse Verified Payment",
        paymentStatus: "PAID",
        dateLabel: new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        customerName: state.customer ? `${state.customer.first_name} ${state.customer.last_name}`.trim() : "Valued Customer",
        items: order.items.map((it) => ({
          saree_name: it.saree_name,
          quantity: it.quantity,
          customization_note: it.customization_note || "",
          lineTotal: (Number(it.unit_price) + Number(it.addon_price || 0)) * it.quantity,
        })),
        total: Number(order.total_amount),
      };
      render();
    }
  } else if (action === "checkout") {
    checkout();
  } else if (action === "fabric") {
    state.catalog.fabric = button.dataset.value;
    state.catalog.search = "";
    state.catalog.region = "All regions";
    state.catalog.occasion = "All occasions";
    render();
  } else if (action === "price-range") {
    state.catalog.priceRange = button.dataset.value;
    render();
  } else if (action === "voice-search") {
    toggleVoiceSearch();
  } else if (action === "clear-search") {
    state.catalog.search = "";
    state.voiceStatus = "";
    render();
    const search = document.getElementById("catalog-search");
    if (search) search.focus();
  } else if (action === "quick-search") {
    state.catalog.search = button.dataset.value || "";
    render();
    const search = document.getElementById("catalog-search");
    if (search) search.focus();
  } else if (action === "clear-filters") {
    state.catalog = { search: "", fabric: "All fabrics", region: "All regions", occasion: "All occasions", priceRange: "all", sort: "newest" };
    render();
  } else if (action === "set-rating") {
    const val = Math.max(1, Math.min(5, Number(button.dataset.value) || 5));
    state.rating = val;
    const picker = button.closest(".star-rating-picker");
    const form = button.closest("form");
    const hidden = form && form.querySelector('input[name="rating"]');
    if (hidden) hidden.value = String(val);
    if (picker) {
      const ratingLabels = { 1: "1 star · Needs work", 2: "2 stars · Fair", 3: "3 stars · Good", 4: "4 stars · Very good", 5: "5 stars · Loved it" };
      picker.querySelectorAll(".star-btn").forEach((star) => {
        const starVal = Number(star.dataset.value);
        const active = starVal <= val;
        star.classList.toggle("is-active", active);
        star.classList.remove("is-hover", "is-pop");
        star.setAttribute("aria-checked", String(starVal === val));
        if (starVal <= val) {
          void star.offsetWidth;
          star.classList.add("is-pop");
        }
      });
      const text = picker.querySelector(".star-rating-text");
      if (text) text.textContent = ratingLabels[val] || `${val} stars`;
    }
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
  const nextHash = currentHash();
  const returningViaBack = isBackNavigation;
  if (isBackNavigation) {
    isBackNavigation = false;
  } else if (state.navHistory[state.navHistory.length - 1] !== nextHash) {
    state.navHistory.push(nextHash);
    if (state.navHistory.length > 50) state.navHistory.shift();
  }
  state.route = routeFromHash();
  if (state.route.page !== "login" && state.route.page !== "register") {
    state.postAuthReturnHash = "";
    state.postAuthOpenCheckout = false;
  }
  state.authError = "";
  state.productError = "";
  state.reviewMessage = "";
  state.quantity = 1;
  state.activeShotIndex = 0;
  state.finishing = { fallPico: false, tassels: false };
  state.menuOpen = false;
  state.quickViewId = null;
  if (state.route.page === "shop" && state.route.fabric) {
    state.catalog.fabric = state.route.fabric;
    state.catalog.search = "";
    state.catalog.region = "All regions";
    state.catalog.occasion = "All occasions";
    state.catalog.priceRange = "all";
  } else if (state.route.page === "shop" && !returningViaBack) {
    state.catalog.fabric = "All fabrics";
  }
  render();
  if (state.route.page === "product") {
    loadProduct(state.route.productId);
    loadReviews(state.route.productId);
  }
  if ((state.route.page === "account" || state.route.page === "orders") && state.token) loadOrders();
});

document.addEventListener("click", (e) => {
  if (state.menuOpen && !e.target.closest(".hamburger-wrap")) {
    state.menuOpen = false;
    render();
  }
});

// Interactive Loupe Zoom on Product Detail image
document.addEventListener("pointermove", (e) => {
  const box = e.target.closest?.(".detail-image[data-loupe-src]");
  document.querySelectorAll(".detail-image.is-zooming").forEach((el) => {
    if (el !== box) el.classList.remove("is-zooming");
  });
  if (!box || e.pointerType === "touch") return;
  const lens = box.querySelector(".loupe-lens");
  if (!lens) return;
  const rect = box.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
  const px = (x / rect.width) * 100;
  const py = (y / rect.height) * 100;
  box.classList.add("is-zooming");
  lens.style.left = `${x - 75}px`;
  lens.style.top = `${y - 75}px`;
  lens.style.backgroundImage = `url("${box.dataset.loupeSrc}")`;
  lens.style.backgroundSize = `${rect.width * 2.3}px ${rect.height * 2.3}px`;
  lens.style.backgroundPosition = `${px}% ${py}%`;
});
document.addEventListener("pointerout", (e) => {
  const box = e.target.closest?.(".detail-image");
  if (box && !box.contains(e.relatedTarget)) box.classList.remove("is-zooming");
});

// Interactive hover preview for 5-star review picker
document.addEventListener("mouseover", (e) => {
  const star = e.target.closest?.(".star-btn");
  if (!star) return;
  const picker = star.closest(".star-rating-picker");
  if (!picker) return;
  const hoverVal = Number(star.dataset.value) || 0;
  picker.querySelectorAll(".star-btn").forEach((btn) => {
    btn.classList.toggle("is-hover", Number(btn.dataset.value) <= hoverVal);
  });
});
document.addEventListener("mouseout", (e) => {
  const picker = e.target.closest?.(".star-rating-picker");
  if (picker && !picker.contains(e.relatedTarget)) {
    picker.querySelectorAll(".star-btn").forEach((btn) => btn.classList.remove("is-hover"));
  }
});

async function restoreSession() {
  if (!state.token) return;
  try {
    const result = await apiRequest("/auth/me", { token: state.token });
    state.customer = result.customer;
    localStorage.setItem(storageKeys.customer, JSON.stringify(result.customer));
    if (state.route.page === "account" || state.route.page === "orders") loadOrders();
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
