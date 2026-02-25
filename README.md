# Projet Président Online - Déploiement Docker & Kubernetes

Ce dépôt contient l'API (Nuxt.js + Prisma) et le serveur de jeu temps réel (Colyseus + Express) pour le jeu "Président Online". 

Dans le cadre de l'évaluation, ce projet a été entièrement dockerisé et préparé pour la production avec Kubernetes et Helm.

---

## 🏗️ Architecture des services

Le projet monorepo (pnpm) comprend quatre services interconnectés :
1. **`postgres`** : Base de données relationnelle persistante.
2. **`redis`** : Base de données clé/valeur pour la gestion de la présence des joueurs de Colyseus.
3. **`back`** : API REST (Nuxt 3 / Prisma) exposée sur le port `3000`.
4. **`game-server`** : Serveur WebSocket (Colyseus) pour la logique de jeu temps réel exposé sur le port `2567`.

Ces applications sont packagées à l'aide de **Dockerfiles Multi-stage** optimisés pour limiter le poids final des images en production (copie exclusive des environnements `standalone` et dossiers `dist`).

---

## 💻 1. Environnement de Développement (Docker Compose)

Il est possible de lancer toute l'architecture en une seule commande grâce à Docker Compose. C'est la méthode privilégiée pour le test ou le développement local.

### Prérequis
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ou Docker Compose)

### Lancer le projet
1. Placez-vous à la racine du dossier `api/`.
2. Construisez et démarrez les conteneurs :
   ```bash
   docker compose up --build -d
   ```
3. Vérifiez que les 4 services tournent correctement :
   ```bash
   docker compose ps
   ```

Vous pouvez alors accéder aux services via :
* L'API classique sur [http://localhost:3000](http://localhost:3000)
* Le serveur de jeu temps réel (WebSocket) sur `ws://localhost:2567` ou [http://localhost:2567](http://localhost:2567)

### Arrêter le projet
```bash
docker compose down
```

---

## 🚀 2. Environnement de Production (Kubernetes)

Le dossier `k8s/` contient tous les manifestes Kubernetes pour déployer l'architecture de manière robuste (Scalabilité via des *Deployments* avec Replicas et persistance via des *PVC*).

### Déploiement via manifestes standards (`k8s/`)

1. Assurez-vous d'avoir Kubernetes activé (ex: *Docker Desktop -> Settings -> Kubernetes -> Enable*).
2. Arrêtez les éventuels instances `docker-compose` locales : `docker compose down`.
3. Assurez-vous d'avoir construit les images Docker localement (`api-back` et `api-game-server`) via la commande docker compose de l'étape 1.
4. Appliquez l'ensemble des manifestes :
   ```bash
   kubectl apply -f ./k8s
   ```
5. Vérifiez l'état des Pods :
   ```bash
   kubectl get pods
   ```
   *(Attendre que tous les pods soient en statut `Running`)*.

6. **Tester l'accès :** Les services Kubernetes nécessitent la commande `port-forward` pour être liés à votre machine de développement :
   ```bash
   kubectl port-forward service/back 3000:80
   kubectl port-forward service/game-server 2567:2567
   ```
   L'application sera fonctionnelle sur [http://localhost:3000](http://localhost:3000).

---

## 🌟 Bonus : Déploiement Unifié (Helm)

Pour un déploiement encore plus adapté aux standards de l'industrie, une *Helm Chart* a été créée dans le dossier `chart/president`.
Helm permet de gérer l'intégralité de l'application (Bases de données + serveurs Node) avec des variables (fichier `values.yaml`).

### Installation
1. Si des ressources Kubernetes issues de l'étape 2 sont actives, supprimez-les : `kubectl delete -f ./k8s`
2. Installez la charte Helm complète :
   ```bash
   helm install president-stack ./chart/president
   ```

### Mise à jour
Pour modifier la configuration (ex: passer le back à 5 serveurs web en simultané), modifiez le fichier `values.yaml` (`replicas: 5`) puis exécutez :
```bash
helm upgrade president-stack ./chart/president
```

### Suppression
```bash
helm uninstall president-stack
```
