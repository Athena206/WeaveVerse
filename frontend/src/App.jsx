import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, uploadUrl } from "./api.js";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount));

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="1" y="1" width="62" height="62" rx="20" fill="#24362e" />
      <path d="M14 20.5 22.4 44l9.6-18.2L41.6 44 50 20.5" fill="none" stroke="#e8d4a8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" />
      <path d="M17.5 31.7c4.2-3.1 8.9-4.6 14.5-4.6s10.3 1.5 14.5 4.6M18.5 37c3.9-2.2 8.4-3.3 13.5-3.3s9.6 1.1 13.5 3.3" fill="none" stroke="#c49a5a" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="32" cy="14" r="1.6" fill="#e8d4a8" />
    </svg>
  );
}

function routeFromHash() {
  const hash = window.location.hash.slice(1) || "home";
  if (hash.startsWith("product/")) {
    return { page: "product", productId: Number(hash.split("/")[1]) };
  }
  const [page, filter] = hash.split("/");
  if (page === "shop" && filter) {
    return { page, fabric: decodeURIComponent(filter) };
  }
  return {
    page: ["shop", "contact", "login", "register", "account"].includes(page)
      ? page
      : "home",
  };
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [products, setProducts] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("fsc-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fsc-cart") || "[]");
    } catch (error) {
      console.warn("The saved shopping bag could not be read.", error);
      return [];
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("fsc-token") || "");
  const [customer, setCustomer] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fsc-customer") || "null");
    } catch (error) {
      console.warn("The saved customer profile could not be read.", error);
      return null;
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const result = await apiRequest("/products");
      setProducts(result.products);
      setCatalogError("");
    } catch (error) {
      setCatalogError(error.message);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    const updateRoute = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, [loadProducts]);

  useEffect(() => {
    localStorage.setItem("fsc-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("fsc-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    apiRequest("/auth/me", { token })
      .then(({ customer: profile }) => {
        if (!active) return;
        setCustomer(profile);
        localStorage.setItem("fsc-customer", JSON.stringify(profile));
      })
      .catch((error) => {
        if (!active) return;
        console.warn("The saved sign-in could not be restored.", error);
        setToken("");
        setCustomer(null);
        localStorage.removeItem("fsc-token");
        localStorage.removeItem("fsc-customer");
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (route.page !== "account" || !token) return;
    apiRequest("/orders", { token })
      .then(({ orders: previousOrders }) => setOrders(previousOrders))
      .catch((error) => {
        showNotice(error.message);
        if (error.message.includes("token")) signOut();
      });
  }, [route.page, token]);

  const selectedProduct = products.find(
    (product) => product.product_id === route.productId,
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
    [cart],
  );

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function addToCart(product, quantity = 1) {
    if (!product || product.stock < 1) {
      showNotice("This saree is currently out of stock.");
      return;
    }
    setCart((current) => {
      const existing = current.find(
        (item) => item.product_id === product.product_id,
      );
      if (existing) {
        return current.map((item) =>
          item.product_id === product.product_id
            ? {
                ...item,
                quantity: Math.min(item.quantity + quantity, product.stock),
              }
            : item,
        );
      }
      return [...current, { ...product, quantity: Math.min(quantity, product.stock) }];
    });
    showNotice(`${product.saree_name} added to your bag.`);
  }

  function buyNow(product, quantity) {
    addToCart(product, quantity);
    setCartOpen(true);
  }

  function updateCartQuantity(productId, delta) {
    setCart((current) =>
      current
        .map((item) =>
          item.product_id === productId
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + delta,
                  products.find((product) => product.product_id === productId)
                    ?.stock ?? item.quantity,
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const mode = route.page;
    const payload = {
      email: form.get("email"),
      password: form.get("password"),
    };
    if (mode === "register") {
      payload.first_name = form.get("first_name");
      payload.last_name = form.get("last_name");
      payload.password_confirm = form.get("password_confirm");
    }
    try {
      const result = await apiRequest(
        mode === "register" ? "/auth/register" : "/auth/login",
        { method: "POST", body: JSON.stringify(payload) },
      );
      setToken(result.token);
      setCustomer(result.customer);
      localStorage.setItem("fsc-token", result.token);
      localStorage.setItem("fsc-customer", JSON.stringify(result.customer));
      window.location.hash = "account";
      showNotice(`Welcome${result.customer.first_name ? `, ${result.customer.first_name}` : ""}!`);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!token) {
      setCartOpen(false);
      window.location.hash = "login";
      showNotice("Sign in to place your order.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest("/orders", {
        method: "POST",
        token,
        body: JSON.stringify({
          items: cart.map(({ product_id, quantity }) => ({ product_id, quantity })),
        }),
      });
      setCart([]);
      setCartOpen(false);
      await loadProducts();
      showNotice(`Order #${result.order_id} placed. Thank you!`);
    } catch (error) {
      showNotice(error.message);
      if (error.message.includes("token")) {
        setToken("");
        setCustomer(null);
        localStorage.removeItem("fsc-token");
        localStorage.removeItem("fsc-customer");
      }
      await loadProducts();
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    setToken("");
    setCustomer(null);
    localStorage.removeItem("fsc-token");
    localStorage.removeItem("fsc-customer");
    setOrders([]);
    window.location.hash = "home";
    showNotice("You have been signed out.");
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="WeaveVerse home">
          <BrandMark />
          <span className="brand-name">
            WeaveVerse
            <small>WEAVES THAT TELL STORIES</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a className={route.page === "home" ? "active" : ""} href="#home">Home</a>
          <a className={route.page === "shop" ? "active" : ""} href="#shop">Shop</a>
          <a href="#contact">Contact Us</a>
        </nav>
        <div className="header-actions">
          {customer ? (
            <>
              <a className="text-button account-button" href="#account">
                Hi, {customer.first_name}
              </a>
              <button className="text-button sign-out-button" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <a className="text-button account-button" href="#login">Sign in</a>
          )}
          <button
            className="theme-button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button
            className="bag-button"
            aria-label={`Open shopping bag, ${cartCount} items`}
            onClick={() => setCartOpen(true)}
          >
            Bag <span>{cartCount}</span>
          </button>
        </div>
      </header>

      <main>
        {route.page === "home" && (
          <HomePage
            products={products}
            onAdd={addToCart}
            error={catalogError}
            onRetry={loadProducts}
          />
        )}
        {route.page === "shop" && (
          <CatalogPage
            products={products}
            error={catalogError}
            onAdd={addToCart}
            onRetry={loadProducts}
            initialFabric={route.fabric}
          />
        )}
        {route.page === "product" &&
          (selectedProduct ? (
            <ProductPage
              product={selectedProduct}
              token={token}
              onAdd={addToCart}
              onBuyNow={buyNow}
              onReviewsChanged={loadProducts}
            />
          ) : (
            <div className="page-shell empty-state">
              <p>{catalogError || "Finding this saree..."}</p>
              <a className="button button-dark" href="#shop">Back to the collection</a>
            </div>
          ))}
        {route.page === "contact" && <ContactPage />}
        {(route.page === "login" || route.page === "register") && (
          <AccountPage
            mode={route.page}
            busy={busy}
            error={authError}
            onSubmit={submitAuth}
          />
        )}
        {route.page === "account" && (
          customer ? (
            <AccountDashboard customer={customer} orders={orders} />
          ) : (
            <div className="page-shell empty-state">
              <p>Sign in to see your account and orders.</p>
              <a className="button button-dark" href="#login">Sign in</a>
            </div>
          )
        )}
      </main>

      <Footer />
      {notice && <div className="toast" role="status">{notice}</div>}

      {cartOpen && (
        <div className="overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false);
        }}>
          <aside className="cart-drawer" aria-label="Shopping bag">
            <div className="drawer-heading">
              <div><p className="eyebrow">YOUR SELECTION</p><h2>Your bag <span>({cartCount})</span></h2></div>
              <button className="close-button" onClick={() => setCartOpen(false)} aria-label="Close bag">×</button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-cart"><p>Your bag is waiting for something beautiful.</p><a href="#shop" className="button button-dark" onClick={() => setCartOpen(false)}>Explore sarees</a></div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <article className="cart-item" key={item.product_id}>
                      <img src={item.image_url} alt="" />
                      <div className="cart-item-copy">
                        <a href={`#product/${item.product_id}`} onClick={() => setCartOpen(false)}>{item.saree_name}</a>
                        <span>{money(item.price)}</span>
                        <div className="quantity-control small">
                          <button onClick={() => updateCartQuantity(item.product_id, -1)} aria-label={`Remove one ${item.saree_name}`}>−</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product_id, 1)} aria-label={`Add one ${item.saree_name}`}>+</button>
                        </div>
                      </div>
                      <button className="remove-button" onClick={() => setCart((current) => current.filter((entry) => entry.product_id !== item.product_id))}>Remove</button>
                    </article>
                  ))}
                </div>
                <div className="cart-summary">
                  <div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
                  <p>Shipping and any applicable taxes are calculated at checkout.</p>
                  <button className="button button-dark full-button" disabled={busy} onClick={checkout}>
                    {busy ? "Placing order..." : "Place order"}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function HomePage({ products, onAdd, error, onRetry }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A WORLD WOVEN BY HAND</p>
          <h1>Wear a story.<br /><em>Keep a legacy.</em></h1>
          <p className="hero-description">Discover India's timeless sarees, chosen for their craft, colour and the stories woven into every thread.</p>
          <div className="hero-actions">
            <a className="button button-dark" href="#shop">Explore the collection <span>↗</span></a>
            <a className="text-link" href="#contact">Our story <span>→</span></a>
          </div>
          <div className="hero-note"><span className="note-line" /> Thoughtfully chosen. Beautifully woven.</div>
        </div>
        <div className="hero-image">
          <img
            src={uploadUrl("weaveverse-model-01.jpg")}
            alt="Model in a richly woven purple silk saree"
          />
          <div className="hero-image-label"><span>THE WEAVEVERSE EDIT</span><span>MADE TO BE KEPT</span></div>
          <div className="hero-stamp">WOVEN<br />WITH<br /><em>MEANING</em></div>
        </div>
      </section>

      <section className="promise-strip">
        <span>✳ Made by skilled hands</span><span>✳ Rooted in Indian craft</span><span>✳ Chosen with care</span><span>✳ Worn for generations</span>
      </section>

      {products.length > 0 && (
        <section className="fabric-collection" aria-label="Shop by fabric">
          <p className="eyebrow">FIND YOUR FAVOURITE FEEL</p>
          {[...new Set(products.map((product) => product.fabric))].slice(0, 8).map((fabric) => (
            <a className="fabric-tile" href={`#shop/${encodeURIComponent(fabric)}`} key={fabric}>{fabric} <span>↗</span></a>
          ))}
          <a className="fabric-tile fabric-tile-all" href="#shop">All fabrics <span>→</span></a>
        </section>
      )}

      <section className="section home-collection">
        <div className="section-heading">
          <div><p className="eyebrow">THE WEAVEVERSE EDIT</p><h2>Woven for <em>your moments</em></h2></div>
          <a className="text-link" href="#shop">View all sarees <span>→</span></a>
        </div>
        {error ? <ErrorMessage message={error} onRetry={onRetry} /> : <ProductGrid products={products.slice(0, 3)} onAdd={onAdd} />}
      </section>

      <section className="story-band">
        <div className="story-image"><img src={uploadUrl("weaveverse-model-10.jpg")} alt="Model wearing a deep green handwoven saree" loading="lazy" /></div>
        <div className="story-copy">
          <p className="eyebrow">MORE THAN A SAREE</p>
          <h2>Made by hand.<br /><em>Carried forward.</em></h2>
          <p>Every weave holds a place, a person and generations of patient skill. We bring authentic regional craftsmanship into one considered collection—so the story behind your saree is always part of the drape.</p>
          <a className="text-link" href="#contact">Get to know us <span>→</span></a>
        </div>
      </section>

      <ContactSection />
    </>
  );
}

function CatalogPage({ products, error, onAdd, onRetry, initialFabric }) {
  const [search, setSearch] = useState("");
  const [fabric, setFabric] = useState(initialFabric || "All fabrics");
  const [region, setRegion] = useState("All regions");
  const [occasion, setOccasion] = useState("All occasions");
  const [sort, setSort] = useState("newest");
  const fabrics = ["All fabrics", ...new Set(products.map((product) => product.fabric))];
  const regions = ["All regions", ...new Set(products.map((product) => product.region))];
  const occasions = ["All occasions", ...new Set(products.map((product) => product.occasion))];

  useEffect(() => {
    setFabric(initialFabric || "All fabrics");
  }, [initialFabric]);

  const filtered = products
    .filter((product) => {
      const matchesSearch = `${product.saree_name} ${product.fabric} ${product.weave} ${product.region} ${product.occasion}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return (
        matchesSearch &&
        (fabric === "All fabrics" || product.fabric === fabric) &&
        (region === "All regions" || product.region === region) &&
        (occasion === "All occasions" || product.occasion === occasion)
      );
    })
    .sort((left, right) => {
      if (sort === "price-asc") return Number(left.price) - Number(right.price);
      if (sort === "price-desc") return Number(right.price) - Number(left.price);
      if (sort === "name") return left.saree_name.localeCompare(right.saree_name);
      return right.product_id - left.product_id;
    });

  return (
    <section className="page-shell catalog-page">
      <div className="catalog-intro">
        <div><p className="eyebrow">A THOUGHTFUL COLLECTION</p><h1>Find your <em>forever drape.</em></h1><p>Handloom stories, gathered from the places that make them.</p></div>
        <span className="catalog-count">{filtered.length} of {products.length} sarees</span>
      </div>
      <div className="catalog-tools">
        <div className="category-pills">
          {fabrics.map((item) => <button key={item} className={fabric === item ? "selected" : ""} onClick={() => setFabric(item)}>{item}</button>)}
        </div>
        <label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search weave, fabric, region..." /></label>
      </div>
      <div className="catalog-refine">
        <label>Region<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Occasion<select value={occasion} onChange={(event) => setOccasion(event.target.value)}>{occasions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option></select></label>
      </div>
      {error ? <ErrorMessage message={error} onRetry={onRetry} /> : filtered.length ? <ProductGrid products={filtered} onAdd={onAdd} /> : <div className="empty-state"><p>No sarees found for these filters.</p><button className="text-button" onClick={() => { setSearch(""); setFabric("All fabrics"); setRegion("All regions"); setOccasion("All occasions"); }}>Clear filters</button></div>}
    </section>
  );
}

function ProductGrid({ products, onAdd }) {
  if (!products.length) return <div className="empty-state"><p>Our first collection is being prepared.</p><p className="muted">Please check back soon.</p></div>;
  return (
    <div className="product-grid">
      {products.map((product) => (
        <article className="product-card" key={product.product_id}>
          <a className="product-image" href={`#product/${product.product_id}`}>
            <img src={product.image_url} alt={`${product.saree_name} styling inspiration`} loading="lazy" />
            <span className="editorial-tag">STYLE INSPIRATION</span>
            {product.review_count > 0 && <span className="product-badge">★ {Number(product.average_rating).toFixed(1)} · {product.review_count} REVIEWS</span>}
            <span className="image-arrow">↗</span>
          </a>
          <div className="product-info">
            <div className="product-meta"><span>{product.fabric} · {product.weave}</span><span>{product.region}</span></div>
            <div className="product-title-row"><a href={`#product/${product.product_id}`}><h3>{product.saree_name}</h3></a><strong>{money(product.price)}</strong></div>
            <div className="product-bottom"><span>{product.review_count ? `★ ${Number(product.average_rating).toFixed(1)} · ${product.review_count}` : product.stock > 0 ? "In stock" : "Sold out"}</span><button disabled={product.stock < 1} onClick={() => onAdd(product)}>Add to bag <span>+</span></button></div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductPage({ product, token, onAdd, onBuyNow, onReviewsChanged }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [rating, setRating] = useState(5);

  const loadReviews = useCallback(async () => {
    try {
      const result = await apiRequest(`/products/${product.product_id}/reviews`);
      setReviews(result.reviews);
      setReviewsError("");
    } catch (error) {
      setReviewsError(error.message);
    }
  }, [product.product_id]);

  useEffect(() => {
    setQuantity(1);
    setAdded(false);
    loadReviews();
  }, [loadReviews]);

  function add() {
    onAdd(product, quantity);
    setAdded(true);
  }

  async function submitReview(event) {
    event.preventDefault();
    setReviewBusy(true);
    setReviewMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await apiRequest(`/products/${product.product_id}/reviews`, {
        method: "POST",
        token,
        body: JSON.stringify({
          rating,
          review_text: form.get("review_text"),
        }),
      });
      formElement.reset();
      await loadReviews();
      await onReviewsChanged();
      setReviewMessage("Thank you. Your review has been added.");
    } catch (error) {
      setReviewMessage(error.message);
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <section className="page-shell detail-page">
      <div className="breadcrumbs"><a href="#home">Home</a><span>/</span><a href="#shop">Shop</a><span>/</span><span>{product.saree_name}</span></div>
      <div className="detail-layout">
        <div className="detail-image">
          <img src={product.image_url} alt={`${product.saree_name} styling inspiration`} />
          <span className="editorial-tag">STYLE INSPIRATION</span>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{product.category.toUpperCase()} · {product.region.toUpperCase()}</p>
          <h1>{product.saree_name}</h1>
          <p className="detail-price">{money(product.price)}</p>
          <p className="detail-description">{product.description}</p>
          <div className="craft-facts">
            <div><span>FABRIC</span><strong>{product.fabric}</strong></div>
            <div><span>WEAVE</span><strong>{product.weave}</strong></div>
            <div><span>REGION</span><strong>{product.region}</strong></div>
            <div><span>OCCASION</span><strong>{product.occasion}</strong></div>
          </div>
          <p className="stock-note">{product.stock > 0 ? `${product.stock} pieces available · Ships with care` : "Currently out of stock"}</p>
          <div className="purchase-row">
            <div className="quantity-control">
              <button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>−</button>
              <span>{quantity}</span>
              <button aria-label="Increase quantity" disabled={quantity >= product.stock} onClick={() => setQuantity((value) => value + 1)}>+</button>
            </div>
            <button className="button button-dark" disabled={product.stock < 1} onClick={add}>{added ? "Added to bag ✓" : "Add to bag"}</button>
          </div>
          <button className="button button-outline full-button buy-button" disabled={product.stock < 1} onClick={() => onBuyNow(product, quantity)}>Buy now</button>
          <p className="delivery-note">✦ Directly sourced from craft communities · Secure checkout</p>
          <p className="photo-credit">
            {product.image_source ? (
              <a href={product.image_source} target="_blank" rel="noreferrer">
                Photo: {product.image_credit} · {product.image_license}
              </a>
            ) : (
              <>Photo: {product.image_credit}</>
            )}
          </p>
          <p className="photo-disclaimer">Model photography is for styling inspiration. Please confirm the exact saree colours and details before ordering.</p>
        </div>
      </div>
      <section className="reviews-section">
        <div className="reviews-summary">
          <p className="eyebrow">CUSTOMER REVIEWS</p>
          <h2>Worn & <em>loved.</em></h2>
          {product.review_count > 0 ? (
            <div className="large-rating">{Number(product.average_rating).toFixed(1)} <span>★★★★★</span></div>
          ) : (
            <p>There are no reviews yet. Be the first to share your experience.</p>
          )}
          <p>{product.review_count} {product.review_count === 1 ? "review" : "reviews"}</p>
        </div>
        <div className="review-content">
          {token ? (
            <form className="review-form" onSubmit={submitReview}>
              <label>Your rating
                <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? "star" : "stars"}</option>)}
                </select>
              </label>
              <label>Your review
                <textarea name="review_text" rows="3" maxLength="1200" placeholder="Tell other shoppers what you loved..." required />
              </label>
              <button className="button button-outline" disabled={reviewBusy}>
                {reviewBusy ? "Submitting..." : "Share your review"}
              </button>
              {reviewMessage && <p className="form-message" role="status">{reviewMessage}</p>}
            </form>
          ) : (
            <p className="review-signin"><a className="text-link" href="#login">Sign in</a> to leave a review.</p>
          )}
          {reviewsError ? <ErrorMessage message={reviewsError} onRetry={loadReviews} /> : (
            <div className="review-list">
              {reviews.map((review) => (
                <article className="review" key={review.review_id}>
                  <div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </div>
                  <p>{review.review_text}</p>
                  <span>{review.first_name} {review.last_name} · {new Date(review.created_at).toLocaleDateString("en-IN")}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function AccountPage({ mode, busy, error, onSubmit }) {
  const isRegister = mode === "register";
  return (
    <section className="account-page">
      <div className="account-photo">
        <img src={uploadUrl("weaveverse-model-05.jpg")} alt="Model in a red and gold silk saree" />
        <div><p className="eyebrow">WEAVEVERSE</p><p>Crafted with care.<br /><em>Worn with meaning.</em></p></div>
      </div>
      <div className="account-panel">
        <a className="account-back" href="#home">← Back to the collection</a>
        <p className="eyebrow">{isRegister ? "JOIN OUR CIRCLE" : "WELCOME BACK"}</p>
        <h1>{isRegister ? <>A little more <em>you.</em></> : <>Good to see <em>you.</em></>}</h1>
        <p className="account-intro">{isRegister ? "Create your account and keep all your favourite weaves close." : "Sign in to find your orders and the sarees you love."}</p>
        <form className="form-stack account-form" onSubmit={onSubmit}>
          {isRegister && (
            <div className="form-row">
              <label>First name<input name="first_name" autoComplete="given-name" required maxLength="80" /></label>
              <label>Last name<input name="last_name" autoComplete="family-name" required maxLength="80" /></label>
            </div>
          )}
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength="254" /></label>
          <label>Password<input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength="8" maxLength="128" /></label>
          {isRegister && <label>Confirm password<input name="password_confirm" type="password" autoComplete="new-password" required minLength="8" maxLength="128" /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-dark full-button" disabled={busy}>
            {busy ? "Please wait..." : isRegister ? "Create my account" : "Sign in"}
          </button>
        </form>
        <p className="account-switch">
          {isRegister ? "Already have an account?" : "New to WeaveVerse?"}{" "}
          <a href={isRegister ? "#login" : "#register"}>{isRegister ? "Sign in" : "Create an account"}</a>
        </p>
        <p className="account-security">Your password is securely hashed before it is saved.</p>
      </div>
    </section>
  );
}

function AccountDashboard({ customer, orders }) {
  return (
    <section className="page-shell account-dashboard">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>Namaste, <em>{customer.first_name}.</em></h1>
      <p className="muted">{customer.email}</p>
      <div className="orders-heading"><h2>Your orders</h2><a className="text-link" href="#shop">Continue shopping <span>→</span></a></div>
      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order.order_id}>
              <div className="order-heading">
                <div><span>ORDER</span><strong>#{order.order_id}</strong></div>
                <div><span>PLACED</span><strong>{new Date(order.created_at).toLocaleDateString("en-IN")}</strong></div>
                <div><span>STATUS</span><strong className="order-status">{order.status}</strong></div>
                <strong>{money(order.total_amount)}</strong>
              </div>
              <ul>{order.items.map((item) => <li key={item.product_id}>{item.saree_name} <span>× {item.quantity}</span></li>)}</ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><p>Your order history is waiting for its first story.</p><a className="button button-dark" href="#shop">Explore sarees</a></div>
      )}
    </section>
  );
}

function ContactPage() {
  return <section className="page-shell contact-page"><p className="eyebrow">WE’RE HERE FOR YOU</p><h1>Let's talk <em>craft.</em></h1><p>Questions about a weave, an order, or the hands behind your saree? We'd love to help.</p><ContactSection /></section>;
}

function ContactSection() {
  return (
    <section className="contact-section" id="contact">
      <div><p className="eyebrow">A NOTE FROM YOU</p><h2>We'd love to<br /><em>hear your story.</em></h2><p>For questions about sarees, orders, or our weaver community, write to us. We’ll be in touch soon.</p><a className="text-link" href="mailto:hello@weaveverse.com">hello@weaveverse.com <span>↗</span></a></div>
      <div className="contact-aside"><span className="contact-sun">✳</span><p>Good things take time.<br />So does a beautiful weave.</p></div>
    </section>
  );
}

function ErrorMessage({ message, onRetry }) {
  return <div className="error-message" role="alert"><p>{message}</p>{onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}</div>;
}

function Footer() {
  return (
    <footer className="site-footer">
      <a className="brand footer-brand" href="#home" aria-label="WeaveVerse home"><BrandMark /><span className="brand-name">WeaveVerse<small>WEAVES THAT TELL STORIES</small></span></a>
      <p>Honouring the hands that weave<br />India's timeless stories.</p>
      <div className="footer-links"><a href="#shop">Shop sarees</a><a href="#contact">Contact</a><a href="mailto:hello@weaveverse.com">Email us</a></div>
      <small className="copyright">© 2026 WeaveVerse</small>
    </footer>
  );
}

export default App;
