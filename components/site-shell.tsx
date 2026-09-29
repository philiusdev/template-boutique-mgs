"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/store-provider";
import { getNameMonogram } from "@/lib/name";

export function SiteHeader() {
  const { cartCount, userEmail, userDisplayName, role } = useStore();
  const pathname = usePathname();
  const accountMonogram = getNameMonogram(userDisplayName, userEmail ?? "");
  const accountLabel = userDisplayName || userEmail || "Mon compte";
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPath(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  return (
    <>
      <div className="announcement">
        Livraison partout au Burkina Faso
        <span aria-hidden="true"> · </span> Paiement mobile money
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="icon-button mobile-menu-button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuPath(menuOpen ? null : pathname)}
          >
            <span className="menu-lines" />
          </button>
          <Link href="/" className="brand" aria-label="Royal Shop, accueil">
            <span className="brand-mark">R</span>
            <span className="brand-copy">
              <strong>Royal Shop</strong>
              <small>La mode pour tous</small>
            </span>
          </Link>
          <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} id="main-navigation">
            <Link href="/produits" aria-current={pathname.startsWith("/produits") ? "page" : undefined} onClick={() => setMenuPath(null)}>La collection</Link>
            <Link href="/#notre-histoire" onClick={() => setMenuPath(null)}>Notre histoire</Link>
            {role === "admin" && <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined} onClick={() => setMenuPath(null)}>Administration</Link>}
          </nav>
          <div className="header-actions">
            <Link
              className="icon-button account-button"
              href={userEmail ? "/profil" : "/connexion"}
              aria-label={userEmail ? `Mon compte, ${accountLabel}` : "Se connecter"}
            >
              {userEmail ? <span className="account-monogram" aria-hidden="true">{accountMonogram}</span> : <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c.5-3.4 3.1-5.3 7-5.3s6.5 1.9 7 5.3" />
              </svg>}
            </Link>
            <Link className="cart-link" href="/panier" aria-label={`Panier, ${cartCount} article(s)`}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 4.5h2l2.1 10.1h9.8l2.2-7.1H6.2" />
                <circle cx="9.5" cy="18.5" r="1.2" />
                <circle cx="17" cy="18.5" r="1.2" />
              </svg>
              <span>Panier</span>
              <b>{cartCount}</b>
            </Link>
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-nav" aria-label="Navigation principale">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg>
          <span>Accueil</span>
        </Link>
        <Link href="/produits" aria-current={pathname.startsWith("/produits") ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>
          <span>Collection</span>
        </Link>
        <Link href="/panier" aria-current={pathname === "/panier" ? "page" : undefined} aria-label={`Panier, ${cartCount} article(s)`}>
          <span className="bottom-nav-cart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2h10L20 7H6" /><circle cx="9" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></svg>
            {cartCount > 0 && <b>{cartCount > 9 ? "9+" : cartCount}</b>}
          </span>
          <span>Panier</span>
        </Link>
        <Link href={userEmail ? "/profil" : "/connexion"} aria-current={pathname === "/profil" || pathname === "/connexion" ? "page" : undefined}>
          {userEmail ? <span className="mobile-account-monogram" aria-hidden="true">{accountMonogram}</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.5-3.4 3.1-5.3 7-5.3s6.5 1.9 7 5.3" /></svg>}
          <span>{userEmail ? "Compte" : "Connexion"}</span>
        </Link>
      </nav>
      <InstallAppPrompt pathname={pathname} />
    </>
  );
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_ACCEPTED_KEY = "atelier-naya-install-accepted";
const HOME_SCREEN_SESSION_KEY = "atelier-naya-home-screen-session";
const INSTALL_DISMISSED_UNTIL_KEY = "atelier-naya-install-dismissed-until";

function InstallAppPrompt({ pathname }: { pathname: string }) {
  const pendingInstallRef = useRef<InstallPromptEvent | null>(null);
  const [installOffer, setInstallOffer] = useState<{ event: InstallPromptEvent; pathname: string } | null>(null);
  const [manualInstallPath, setManualInstallPath] = useState<string | null>(null);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  useEffect(() => {
    const isStandaloneApp = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true);
    const appIsInstalled = () => {
      if (isStandaloneApp()) return true;
      try {
        return localStorage.getItem(INSTALL_ACCEPTED_KEY) === "true";
      } catch (error) {
        console.error("Impossible de vérifier l'installation de l'application :", error);
        return false;
      }
    };
    const rememberInstallation = () => {
      try {
        localStorage.setItem(INSTALL_ACCEPTED_KEY, "true");
      } catch (error) {
        console.error("Impossible d'enregistrer l'installation de l'application :", error);
      }
    };
    const promptIsDismissed = () => {
      try {
        return Number(localStorage.getItem(INSTALL_DISMISSED_UNTIL_KEY) ?? 0) > Date.now();
      } catch (error) {
        console.error("Impossible de vérifier la préférence d'installation :", error);
        return false;
      }
    };
    const launchUrl = new URL(window.location.href);
    const launchedFromHomeScreen = launchUrl.searchParams.get("source") === "home-screen";
    if (launchedFromHomeScreen) {
      try {
        sessionStorage.setItem(HOME_SCREEN_SESSION_KEY, "true");
      } catch (error) {
        console.error("Impossible de mémoriser l'ouverture depuis le raccourci :", error);
      }
      rememberInstallation();
      launchUrl.searchParams.delete("source");
      window.history.replaceState(
        window.history.state,
        "",
        `${launchUrl.pathname}${launchUrl.search}${launchUrl.hash}`,
      );
    }
    let openedFromHomeScreen = launchedFromHomeScreen;
    try {
      openedFromHomeScreen ||= sessionStorage.getItem(HOME_SCREEN_SESSION_KEY) === "true";
    } catch (error) {
      console.error("Impossible de vérifier l'ouverture depuis le raccourci :", error);
    }
    if (isStandaloneApp() || openedFromHomeScreen) {
      document.body.classList.add("app-home-screen");
    }
    const canOfferInstall = pathname === "/" || pathname === "/produits";
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let promptTimer: number | undefined;
    const scheduleInstallOffer = () => {
      if (!canOfferInstall || appIsInstalled() || promptIsDismissed()) return;
      if (promptTimer !== undefined) window.clearTimeout(promptTimer);
      const pendingInstallEvent = pendingInstallRef.current;
      if (pendingInstallEvent) {
        promptTimer = window.setTimeout(() => {
          if (pendingInstallRef.current === pendingInstallEvent) {
            setInstallOffer({ event: pendingInstallEvent, pathname });
          }
        }, 8000);
      } else if (isAppleMobile) {
        promptTimer = window.setTimeout(() => {
          if (!pendingInstallRef.current) setManualInstallPath(pathname);
        }, 8000);
      }
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (appIsInstalled() || promptIsDismissed()) return;
      pendingInstallRef.current = event as InstallPromptEvent;
      setManualInstallPath(null);
      scheduleInstallOffer();
    };
    const onInstalled = () => {
      rememberInstallation();
      pendingInstallRef.current = null;
      setInstallOffer(null);
      setManualInstallPath(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    scheduleInstallOffer();
    return () => {
      if (promptTimer !== undefined) window.clearTimeout(promptTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [pathname]);

  const canOfferInstall = pathname === "/" || pathname === "/produits";
  const manualInstallAvailable = manualInstallPath === pathname;
  const installEvent = installOffer?.pathname === pathname ? installOffer.event : null;
  if (!canOfferInstall || (!installEvent && !manualInstallAvailable)) return null;
  return <div className="install-app-card" role="region" aria-label="Installer l'application">
    <span className="install-app-icon">R</span>
    <span className="install-app-copy">
      <strong>Royal Shop sur ton écran d’accueil</strong>
      <small>{manualInstallAvailable ? "Ajoutez un raccourci pour retrouver la boutique facilement." : "Ouvre la boutique comme une application."}</small>
      {showManualInstructions && <small className="install-ios-instructions">Touchez <b>Partager</b>, choisissez <b>Sur l’écran d’accueil</b>, puis confirmez.</small>}
    </span>
    <button onClick={async () => {
      if (manualInstallAvailable) {
        setShowManualInstructions((visible) => !visible);
        return;
      }
      try {
        const promptedEvent = installEvent;
        if (!promptedEvent) return;
        await promptedEvent.prompt();
        const choice = await promptedEvent.userChoice;
        pendingInstallRef.current = null;
        if (choice.outcome === "accepted") {
          try {
            localStorage.setItem(INSTALL_ACCEPTED_KEY, "true");
          } catch (error) {
            console.error("Impossible d'enregistrer l'installation de l'application :", error);
          }
        } else {
          try {
            localStorage.setItem(INSTALL_DISMISSED_UNTIL_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
          } catch (error) {
            console.error("Impossible d'enregistrer la préférence d'installation :", error);
          }
        }
      } catch (error) {
        console.error("Impossible de lancer l'installation de la boutique :", error);
        pendingInstallRef.current = null;
      }
      setInstallOffer(null);
    }}>{manualInstallAvailable ? (showManualInstructions ? "Compris" : "Étapes") : "Installer"}</button>
    <button className="install-dismiss" aria-label="Fermer" onClick={() => {
      try {
        localStorage.setItem(INSTALL_DISMISSED_UNTIL_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
      } catch (error) {
        console.error("Impossible d'enregistrer la préférence d'installation :", error);
      }
      pendingInstallRef.current = null;
      setInstallOffer(null);
      setManualInstallPath(null);
      setShowManualInstructions(false);
    }}>×</button>
  </div>;
}

export function NetworkNotice() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return <div className="network-notice" role="status">Connexion interrompue · certaines images ou pages peuvent ne pas se charger.</div>;
}
