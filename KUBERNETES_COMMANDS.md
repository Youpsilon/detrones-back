# Déploiement Local & Kubernetes - L'Antisèche pour la Soutenance

Ce document regroupe toutes les commandes nécessaires pour lancer l'infrastructure Complète du projet en local (Développement) et simuler une mise en Production (Kubernetes).

---

## DÉVELOPPEMENT (Docker Compose + CLI)
Idéal pour coder au quotidien avec rechargement à chaud.

### 1. Lancer TOUTE l'infrastructure Backend
*(Cette commande construit et lance simultanément PostgreSQL, Redis, le serveur Nuxt "back", et le "game-server" Colyseus).*
```bash
cd detrones-back
docker-compose up -d --build
```

### 2. Migration de la base de données (La 1ère fois uniquement)
*(Nécessaire pour créer les tables dans le conteneur Postgres fraîchement construit).*
```bash
cd detrones-back/back
npx prisma db push
```

### 3. Lancer le Front-end (VueJS)
*(Le front-end n'est pas dans Docker, il faut le lancer localement).*
```bash
cd detrones-front/web
pnpm install
pnpm dev
```

---

## PRODUCTION KUBERNETES (La Simulation K8s)
Avant de commencer, s'assurer que les conteneurs `docker-compose` sont éteints :
`docker-compose down`

### 1. Construire les images Docker
*(Pour que K8s puisse lancer le code, il doit posséder les images en local).*
```bash
cd detrones-back
docker build -t api-back:latest -f back/Dockerfile .
docker build -t api-game-server:latest -f game-server/Dockerfile .
```

### 2. Lancer Kubernetes : La Base de données
```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
```

### 3. Pousser la structure de la Base de Données
*(Il faut obligatoirement créer un tunnel vers Kubernetes pour y pousser Prisma).*
```bash
# Dans un terminal
kubectl port-forward svc/postgres 5432:5432

# Dans un autre terminal 
cd detrones-back/back
npx prisma db push

# (Puis faire Ctrl+C pour fermer le premier terminal)
```

### 4. Lancer Kubernetes : Les Serveurs
```bash
cd detrones-back
kubectl apply -f k8s/back.yaml
kubectl apply -f k8s/game-server.yaml
```

### 5. Ouvrir l'accès vers l'extérieur
*(Kubernetes est fermé de l'intérieur, il faut relier les ports de votre Mac au cluster K8s).*
*Ouvrir 2 terminaux distincts :*
```bash
# Terminal A : Rend le Back Nuxt accessible sur http://localhost:3000
kubectl port-forward svc/back 3000:80

# Terminal B : Rend le serveur de jeu Colyseus accessible sur ws://localhost:2567
kubectl port-forward svc/game-server 2567:2567
```

### 6. Lancer le Front
```bash
cd detrones-front/web
pnpm dev
```

---

## COMMANDES UTILES POUR LE JURY

### Voir l'état du cluster
```bash
# Lister tous les pods
kubectl get pods

# Surveiller les changements d'état en temps réel (Watch)
kubectl get pods -w
```

### Faire une démonstration de "Haute Disponibilité" (Auto-Healing)
*Le but est de montrer que si un serveur crashe, l'applicatif survit.*

1. Ouvrir à moitié un terminal avec : `kubectl get pods -w`
2. Dans un second terminal, obtenir le nom exact d'un pod : `kubectl get pods`
3. Exécuter un "Crash-test" en tuant un Pod brutalement (Copier-coller le nom) :
```bash
kubectl delete pod TON-NOM-DE-POD-ICI
# Exemple : kubectl delete pod back-564477b6bf-66shs
```
4. Regarder le premier terminal réagir, recréer le pod, et rediriger le trafic réseau instantanément.
