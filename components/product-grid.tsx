"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/components/store-provider";
import { Reveal } from "@/components/reveal";
import { formatCfa, type Product } from "@/lib/types";

function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  return (
    <article className="product-card">
      <Link href={`/produits/${product.slug}`} className="product-photo">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 600px) 48vw, (max-width: 1000px) 30vw, 23vw"
            quality={75}
            unoptimized={product.images[0].startsWith("data:")}
          />
        ) : <div className="image-placeholder">Royal Shop</div>}
        <span className="condition-tag">{product.condition}</span>
        {product.stock === 1 && <span className="unique-tag">Pièce unique</span>}
      </Link>
      <div className="product-info">
        <div className="product-title-row">
          <Link href={`/produits/${product.slug}`}><h3>{product.name}</h3></Link>
          <span className="product-size">{product.size ?? "Unique"}</span>
        </div>
        <span className="product-category">{product.category}</span>
        <div className="product-buy-row">
          <strong>{formatCfa(product.price)}</strong>
          <button
            className={`quick-add ${added ? "is-added" : ""}`}
            aria-label={`Ajouter ${product.name} au panier`}
            onClick={() => {
              addToCart(product);
              setAdded(true);
              window.setTimeout(() => setAdded(false), 1200);
            }}
          >{added ? "Ajouté ✓" : "＋ Ajouter"}</button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, initialCategory }: { products: Product[]; initialCategory?: string }) {
  const { demoMode, demoState } = useStore();
  const currentProducts = useMemo(
    () => demoMode ? demoState.products.filter((product) => product.is_active && product.stock > 0) : products,
    [demoMode, demoState.products, products],
  );
  const categories = useMemo(
    () => ["Tout voir", ...Array.from(new Set(currentProducts.map((p) => p.category)))],
    [currentProducts],
  );
  const [categorySelection, setCategorySelection] = useState({
    source: initialCategory,
    value: initialCategory ?? "Tout voir",
  });
  const category = categorySelection.source === initialCategory
    ? categorySelection.value
    : initialCategory ?? "Tout voir";
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("Toutes les tailles");
  const [condition, setCondition] = useState("Tous les états");
  const [sort, setSort] = useState<"newest" | "price-asc" | "price-desc">("newest");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [pageSelection, setPageSelection] = useState({ source: initialCategory, value: 1 });
  const page = pageSelection.source === initialCategory ? pageSelection.value : 1;
  const setPage = (nextPage: number | ((currentPage: number) => number)) => {
    setPageSelection((current) => {
      const currentPage = current.source === initialCategory ? current.value : 1;
      return {
        source: initialCategory,
        value: typeof nextPage === "function" ? nextPage(currentPage) : nextPage,
      };
    });
  };
  const validCategory = categories.includes(category) ? category : "Tout voir";
  const pageSize = 12;
  const sizes = useMemo(
    () => ["Toutes les tailles", ...Array.from(new Set(currentProducts.map((p) => p.size).filter((value): value is string => Boolean(value))))],
    [currentProducts],
  );
  const conditions = useMemo(
    () => ["Tous les états", ...Array.from(new Set(currentProducts.map((p) => p.condition)))],
    [currentProducts],
  );
  const hasActiveFilters = validCategory !== "Tout voir"
    || query.trim().length > 0
    || size !== "Toutes les tailles"
    || condition !== "Tous les états"
    || maximumPrice.length > 0
    || sort !== "newest";
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredProducts = currentProducts.filter((product) => {
    const matchesCategory = validCategory === "Tout voir" || product.category === validCategory;
    const matchesQuery = !normalizedQuery || [product.name, product.category, product.description]
      .some((value) => value.toLocaleLowerCase("fr").includes(normalizedQuery));
    const matchesSize = size === "Toutes les tailles" || product.size === size;
    const matchesCondition = condition === "Tous les états" || product.condition === condition;
    const matchesPrice = !maximumPrice || product.price <= Number(maximumPrice);
    return matchesCategory && matchesQuery && matchesSize && matchesCondition && matchesPrice;
  });
  filteredProducts.sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
  const pageCount = Math.ceil(filteredProducts.length / pageSize);
  const safePage = Math.min(page, Math.max(pageCount, 1));
  const visibleProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resetFilters = () => {
    setCategorySelection({ source: initialCategory, value: "Tout voir" });
    setQuery("");
    setSize("Toutes les tailles");
    setCondition("Tous les états");
    setMaximumPrice("");
    setSort("newest");
    setPage(1);
  };

  return (
    <>
      <div className="catalog-toolbar">
        <div className="catalog-filter-area">
          <div className="category-filters" aria-label="Filtrer par catégorie">
          {categories.map((item) => (
            <button
              className={`filter-chip ${category === item ? "active" : ""}`}
              key={item}
              aria-pressed={category === item}
              onClick={() => { setCategorySelection({ source: initialCategory, value: item }); setPage(1); }}
            >{item}</button>
          ))}
          </div>
          <div className="catalog-extra-filters">
            <select className="filter-select" aria-label="Filtrer par taille" value={size} onChange={(event) => { setSize(event.target.value); setPage(1); }}>{sizes.map((value) => <option key={value}>{value}</option>)}</select>
            <select className="filter-select" aria-label="Filtrer par état" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1); }}>{conditions.map((value) => <option key={value}>{value}</option>)}</select>
            <input className="filter-price" aria-label="Prix maximum en FCFA" inputMode="numeric" placeholder="Prix max" value={maximumPrice} onChange={(event) => { setMaximumPrice(event.target.value.replace(/\D/g, "")); setPage(1); }} />
            <select className="filter-select sort-select" aria-label="Trier les produits" value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }}>
              <option value="newest">Nouveautés</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option>
            </select>
          </div>
        </div>
        <label className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.3 4.3" /></svg>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Chercher une pièce" aria-label="Chercher une pièce" />
        </label>
      </div>
      <div className="catalog-results-row" aria-live="polite">
        <span>{filteredProducts.length} article{filteredProducts.length !== 1 ? "s" : ""} trouvé{filteredProducts.length !== 1 ? "s" : ""}</span>
        {hasActiveFilters && <button type="button" onClick={resetFilters}>Effacer les filtres <span aria-hidden="true">×</span></button>}
      </div>
      {filteredProducts.length ? (
        <>
          <Reveal className="catalog-reveal">
            <div className="product-grid">
              {visibleProducts.map((product) => <ProductCard product={product} key={product.id} />)}
            </div>
          </Reveal>
          {pageCount > 1 && <nav className="catalog-pagination" aria-label="Pagination du catalogue">
            <button className="button button-outline button-small" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Précédent</button>
            <span>Page {safePage} sur {pageCount}</span>
            <button className="button button-outline button-small" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>Suivant →</button>
          </nav>}
        </>
      ) : (
        <div className="empty-catalog"><span>♡</span><h3>Aucune pièce trouvée</h3><p>Essayez une autre catégorie, un autre mot-clé ou élargissez votre prix maximum.</p>
          {hasActiveFilters && <button className="button button-outline button-small" onClick={resetFilters}>Effacer les filtres</button>}
        </div>
      )}
    </>
  );
}
