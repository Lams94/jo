# Déploiement sur Netlify

## Étapes de déploiement :

### 1. Préparer Supabase
- Créer un compte Supabase (https://supabase.com)
- Créer un nouveau projet
- Dans l'onglet SQL Editor, exécuter :
```sql
-- Table des recherches
CREATE TABLE searches (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  keywords TEXT NOT NULL,
  min_years INTEGER,
  min_salary INTEGER,
  max_salary INTEGER,
  sources TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des offres d'emploi
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  salary TEXT,
  published TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des correspondances
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id),
  search_id INTEGER REFERENCES searches(id),
  analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Préparer les clés API
- OpenAI : Générer une clé API sur https://platform.openai.com/api-keys
- SendGrid : Créer un compte et générer une clé API sur https://sendgrid.com

# Note: Replace with your actual OpenAI API key

### 3. Déployer sur GitHub
- Créer un repo GitHub
- Pousser ce code :
```bash
git init
git add .
git commit -m "Initial JobScout deployment"
git remote add origin https://github.com/YOUR_USERNAME/jobscout-netlify.git
git push -u origin main
```

### 4. Déployer sur Netlify
- Aller sur https://netlify.com
- Se connecter avec GitHub
- Cliquer "New site from Git" > "Deploy with GitHub"
- Sélectionner le repo créé
- Configurer le build :
  - **Build command** : `npm run build`
  - **Publish directory** : `dist`
- Ajouter les variables d'environnement dans "Site settings" > "Environment variables" :
  ```
  OPENAI_API_KEY=sk-...
  SUPABASE_URL=https://your-project-id.supabase.co
  SUPABASE_KEY=your-anon-key
  SENDGRID_API_KEY=SG.xxxx
  SITE_URL=https://your-site-name.netlify.app
  ```
- Cliquer "Deploy site"

### 5. Configurer les fonctions planifiées
- Dans Netlify, aller dans "Site settings" > "Build & deploy" > "Continuous deployment"
- Les fonctions sont automatiquement détectées
- Pour la fonction `checkJobs`, elle s'exécute toutes les 15 minutes (modifiable dans le code)

### 6. Tester le déploiement
- Ouvrir l'URL générée par Netlify
- Ajouter une recherche dans l'interface
- Vérifier les logs Netlify pour s'assurer que les fonctions s'exécutent
- Les offres correspondantes apparaîtront dans "Matches"

## Développement local
```bash
npm install
npm run start  # Démarre netlify dev avec les fonctions
```
# jobscout
# jo
# jo
# jo
