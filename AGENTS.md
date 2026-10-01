# template-boutique-mgs — conventions de code

Modèle de boutique Next.js 16 + Supabase : back-office `/admin`, catalogue,
panier, paiement, et l'espace « Mon agence ». Tout le projet est en français,
code compris. Les règles ci-dessous sont vérifiables dans le dépôt.

## Langue

- Commentaires, messages et noms de routes en français.
- Un commentaire explique **pourquoi**, jamais **quoi**. Le modèle est
  `lib/agency-bouton-flottant.ts` : chaque paragraphe nomme un risque
  (« LE MODE DÉMONSTRATION NE JOIE AUCUN RÔLE, ET PASSE EN PREMIER »), la garde
  concernée, et ce qu'elle ferme. Un fichier long sans docblock est un manque.
- Accents dans les commentaires et les messages, sans exception :
  `app/api/agency/_interne/securite.ts` renvoie « Accès réservé à
  l'administration. ». Seuls les noms de fichiers, les identifiants, les
  constantes et les variables d'environnement sont en ASCII strict, accents
  supprimés (`DEVISE_PAR_DEFAUT`, `MGS_AGENCY_REQUIRER_SESSION`,
  `202609290001_save_delivery_settings_together.sql`).

## Nommage

- Fichiers : kebab-case ASCII — `components/checkout-form.tsx`,
  `lib/safe-internal-path.ts`. Les `components/agency/Agency*.tsx` en PascalCase
  viennent du connecteur copié, c'est leur forme d'origine : ne pas l'étendre.
- Fonctions et variables : camelCase français, verbe + nom du métier —
  `chargerEspaceAgenceAdmin()`, `construireReponseCreationDemande()`,
  `formaterMontant()`. Les noms anglais du connecteur copié (`callAgency`,
  `loadAgencySpace`) sont figés par la copie, on ne les touche pas.
- Constantes : `SCREAMING_SNAKE_CASE` français — `ROLES_ADMINISTRATION`,
  `STATUTS_DEMANDE`, `MESSAGE_DEMANDE_ENVOYEE`.
- Composants : PascalCase (`AdminDashboard`, `StoreProvider`).
- Routes d'URL en français : `/produits/[slug]`, `/mes-commandes`, `/profil`.
  `/cart` et `/panier` rendent le même `CartPage`, `/checkout` et `/commande` le
  même `CheckoutForm` : ces alias anglais sont un héritage, ne pas en ajouter.
- Imports via l'alias `@/` (`tsconfig.json`), jamais de chemin relatif long.

## Fichiers copiés : jamais de retouche locale

`lib/agency/`, `components/agency/`, `components/agency.css` et
`app/api/agency/` sont la copie mot pour mot de `mgs-agency-connector/`. On
corrige dans le connecteur, on recopie, on vérifie :

```bash
diff -r ../mgs-agency-connector/lib/agency lib/agency
diff -r ../mgs-agency-connector/components/agency components/agency
diff -r ../mgs-agency-connector/app/api/agency app/api/agency
```

Un écart sur ces arbres est un bug, pas une amélioration. Seul
`app/api/health/route.ts` est propre au site. `lib/agency/contrat-partage.ts`
porte un bandeau « COPIE VERBATIME » qui donne la procédure de recopie depuis la
plateforme : s'en servir plutôt que d'inventer la sienne.

## Un seul point de chargement de l'espace d'agence

`lib/agency-bouton-flottant.ts` (`chargerEspaceAgenceAdmin`) est la porte unique :
mode démonstration, puis session, puis `profiles.role ∈ ROLES_ADMINISTRATION`.
Il vit **hors** de `lib/agency/` pour ne pas polluer la copie — voir son
docblock. Ne jamais appeler `loadAgencySpace()` ailleurs.

Le point de montage du modèle est `app/admin/page.tsx` : la page filtre déjà
elle-même (`profile?.role !== "admin"`), puis appelle la porte, qui revérifie.
**Jamais dans un layout racine** : y charger l'espace sérialiserait factures et
coordonnées du commerçant dans le HTML public (`app/layout.tsx` explique la fuite,
`MGS_WEBSITE_URL` / `AgencyCredit` restent seuls autorisés en pied de page).

## Dégradation, secrets, erreurs

- Plateforme muette ⇒ le site continue : `callAgency()` renvoie `null` et ne lève
  jamais (`lib/agency/client.ts`). Ne jamais convertir ce `null` en échec.
- `MGS_SITE_SECRET` n'est jamais `NEXT_PUBLIC_`, jamais lu depuis un composant
  client. `app/api/agency/_interne/securite.ts` est le seul fichier qui lit la
  session ; `_interne/` est le dossier du code partagé entre routes (non routé).
- Erreurs et refus passent par `repErreur()` / `repRefus()`, pour que les quatre
  routes d'agence partagent le format `{ error, champs }`.
- Journaux serveur : `console.error("[mgs-agency] …")`, jamais de secret ni de
  donnée de demandeur. Un refus n'est jamais une page blanche : les routes
  d'agence nomment leur motif (`MotifRefus` : `non_connecte`, `technique`,
  `role`) et disent au visiteur quoi faire (« Réessayez dans un instant. »).

## Avant de dire « terminé »

```bash
npm run lint        # eslint-config-next, seul contrôle automatique du dépôt
npx tsc --noEmit    # strict: true
```

plus le trio de `diff -r` ci-dessus si un fichier copié a été touché.

## Commits

Message en français, une ligne, sans point final. Deux formes coexistent dans
l'historique : `type: description` (`feat:`, `fix:`, `docs:`, `style:`, `chore:`,
`refactor:`, `perf:`, `ci:`) et `Domaine: phrase` (« Agence commune: bouton
flottant sur toutes les pages »). S'aligner sur les 5 derniers commits.

---

Le bloc ci-dessous est généré et réécrit par `next dev` (voir
`node_modules/next/dist/server/lib/generate-agent-files.js`) : ne pas l'éditer,
ne pas le supprimer, et le committer avec le travail.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->