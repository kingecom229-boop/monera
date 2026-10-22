# MONERA — Plateforme Bancaire Digitale Nouvelle Génération

Architecture bancaire full-stack moderne construite avec **React 18**, **Vite**, **Tailwind CSS**, **Framer Motion**, **Node.js**, **Express.js** et **PostgreSQL** (`pg` + moteur PostgreSQL 16 embarqué `@electric-sql/pglite` pour une exécution immédiate sans configuration externe ou via `DATABASE_URL` en production).

## Structure des Ressources Visuelles
- `/assets/LOGO.png` & `/client/public/assets/logo.png` — Identité visuelle principale MONERA
- `/assets/FAVICON.png` & `/client/public/assets/favicon.png` — Icône navigateur officielle MONERA

## Fonctionnalités Clés
- **Espace Public & Simulateur de Crédit** : Expérience institutionnelle haute précision, simulateur d'amortissement temps réel et aperçu interactif 3D.
- **Espace Membre Sécurisé** :
  - Attribution automatique d'un **Identifiant Client (`MNR-XXXXXX`)** et d'un **RIB-MONERA** normalisé.
  - **Carte Virtuelle Infinite 3D** interactive (inclinaison 3D, recto/verso, verrouillage instantané, affichage/masquage confidentiel du solde).
  - **Virements Instantanés entre Membres** avec vérification en temps réel du bénéficiaire et **demande d'annulation** soumise à validation administrative.
  - **Demandes de Prêts en Ligne** et remboursement d'échéances.
  - **Confirmations Holographiques 3D** animées à chaque événement clé.
- **Back-Office Administration Complet** :
  - Vue exécutive des encours, volumes et files d'attente prioritaires.
  - Suivi et contrôle des transferts (**Approuver** / **Valider l'annulation & restituer les fonds à l'expéditeur**).
  - Gestion intégrale des membres (liste complète, ajout, suppression, gel/activation, **crédit** et **débit** atomiques).
  - Approbation des prêts avec déblocage automatique des fonds sur le compte membre.
  - Gouvernance complète des paramètres du site et journal d'audit immuable.

## Démarrage Rapide

```bash
npm run install:all
npm run build
npm start
```

En mode développement avec rechargement à chaud :
```bash
npm run dev:server
npm run dev:client
```
