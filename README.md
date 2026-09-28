# Royal Shop

Boutique e-commerce mono-vendeur de vêtements et friperie basée à Bobo-Dioulasso. Application Next.js App Router / TypeScript, Supabase Auth (code email), Postgres et Storage.

## Arborescence

```text
app/
  auth/callback/route.ts       Échange du lien de connexion Supabase
  admin/page.tsx               Espace admin avec données de test
  panier/                       Panier
  commande/                     Livraison, mobile money et preuve de paiement
  connexion/                    Connexion email par code ou lien magique
  mes-commandes/                Suivi des commandes du client connecté
  produits/[slug]/              Détail produit
  layout.tsx                    Shell, métadonnées et fournisseur de panier/session
  page.tsx                      Accueil et catalogue
  api/auth/rate-limit/route.ts  Limitation des tentatives OTP
proxy.ts                        Actualisation des cookies de session Supabase
components/
  admin-dashboard.tsx           Commandes, catalogue, livraison, paiements, statistiques
  cart-page.tsx                  Panier et récapitulatif
  checkout-form.tsx              Tunnel de commande
  login-form.tsx                 Connexion de test ou OTP Supabase
  product-detail.tsx             Galerie et ajout au panier
  product-grid.tsx               Filtres, recherche et cartes produits
  reveal.tsx                      Apparitions au défilement avec respect des préférences d'accessibilité
  site-shell.tsx                 Navigation et pied de page
  store-provider.tsx             Panier local et état de session
lib/
  data.ts                        Chargement serveur des produits et aperçu sans configuration
  demo-data.ts                   Catalogue, villes, paiements et commandes de test
  product-mapper.ts              Adaptation des lignes Supabase au modèle boutique
  types.ts                       Types métier et formatage FCFA
  supabase/client.ts             Client Supabase navigateur
  supabase/server.ts             Client Supabase App Router avec cookies
supabase/
  migrations/202609270001_initial_schema.sql
```

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

La boutique démarre entièrement en mode test, sans configurer Supabase et sans envoyer d'email ni effectuer de paiement réel. Les produits, photos ajoutées, commandes, profils et réglages sont conservés dans le stockage local du navigateur.

- Connecte-toi comme cliente ou comme administratrice depuis `/connexion`; le code OTP fictif est `123456`.
- Le parcours client couvre le catalogue, les filtres, le panier, les villes/quartiers, les modes de livraison, les moyens de paiement, l'envoi simulé d'une capture et le suivi.
- Dans `/admin`, essaie la revue/refus des paiements, le changement de statut, le catalogue, l'inventaire, les catégories, les villes, les quartiers, les transporteurs et les instructions mobile money. « Réinitialiser les tests » remet les données de départ.
- La démo inclut les secteurs 1 à 33 de Bobo-Dioulasso, les secteurs 1 à 55 de Ouagadougou et des quartiers/popularités cités dans ces deux villes; cette liste est modifiable dans l'administration. Les limites administratives et noms d'usage varient : vérifie la liste locale et l'accessibilité réelle auprès du vendeur avant tout déploiement.
- Les changements restent sur le navigateur utilisé; effacer son stockage local les supprime.

Pour connecter ultérieurement une vraie boutique, il faudra explicitement définir `NEXT_PUBLIC_DEMO_MODE=false` et utiliser les identifiants d'un projet Supabase dédié à cette boutique. Ne réutilise pas les clés de Faso Mode. Les consignes ci-dessous concernent uniquement ce déploiement réel.

## Initialisation Supabase

1. Appliquer les fichiers du dossier `supabase/migrations` dans l'ordre de leur nom, depuis le SQL Editor Supabase, ou utiliser `supabase db push`. L'installation initiale crée les tables, index, règles d'accès, fonctions de commande, espaces privés pour les preuves de paiement et premières villes du Burkina Faso. Les migrations suivantes ajoutent notamment les photos des commandes, la mise à jour des livraisons et l'enregistrement groupé des réglages de la boutique. Toutes les migrations requises doivent être commitées et appliquées au projet Supabase avant de déployer la version cliente qui en dépend; ne déployez pas de code reposant sur une migration locale non appliquée.
2. Dans Supabase Auth, activer la connexion email et configurer un modèle de courriel contenant le code `{{ .Token }}` et le lien `{{ .ConfirmationURL }}`. Cela permet au client de choisir un code à 6 chiffres ou un lien magique. Ajouter les URLs locales et de production aux URL de redirection autorisées, dont `/auth/callback`.
3. La limitation personnalisée des demandes de connexion est facultative. Pour l'activer, renseigner `SUPABASE_SERVICE_ROLE_KEY` et `TRUSTED_AUTH_RATE_LIMIT_IP_HEADER` dans l'environnement serveur. Cette variable d'en-tête doit désigner une adresse IP unique fournie par un proxy de confiance qui remplace l'en-tête entrant (et non une valeur arbitraire transmise par le navigateur). N'activez pas cette limitation personnalisée si l'hébergeur ne garantit pas ce comportement : en l'absence d'une configuration ou d'une adresse valide, l'application utilise les limites natives de Supabase Auth et journalise le mode dégradé. La clé service-role reste côté serveur; ne jamais la préfixer avec `NEXT_PUBLIC_` ni l'exposer au navigateur.
4. Créer un compte via `/connexion`, puis promouvoir le profil voulu en administrateur dans le SQL Editor :

   ```sql
   update public.profiles set role = 'admin' where email = 'vendeur@exemple.com';
   ```

   Le rôle par défaut demeure toujours `client`; le client public ne peut pas s'attribuer le rôle administrateur.
5. Connecté en `/admin`, ajouter des produits, régler le numéro et les consignes de paiement mobile money, et gérer villes, quartiers, frais locaux et sociétés de transport. Les captures de paiement sont privées; l'admin les consulte via des URL signées à durée limitée.

## Commandes

```bash
npm run lint
npm run build
```
