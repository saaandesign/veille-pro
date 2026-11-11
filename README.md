# Veille Pro

Application mobile de veille recrutement et de suivi de candidatures, avec le Daruma comme mascotte :
un œil est peint quand on formule le vœu, le second se peint à chaque étape de candidature et se
complète le jour où l'on signe.

## Ce que fait l'app

- **Offres** : la veille du jour, triée par % de match, avec la date de publication
  (récente, moyenne ou ancienne) et une fiche détaillée pour chaque offre.
- **Candidatures** : « J'ai postulé », puis Relancée, Entretien, Signé ou Refus.
  Ces informations restent uniquement sur le téléphone.
- **Tendances** : les compétences et outils les plus demandés, avec un conseil.

## Comment elle est faite

Une app web installable (PWA), sans outil de compilation :

| Fichier | Rôle |
| --- | --- |
| `index.html` | La structure des écrans et le dessin du Daruma |
| `styles.css` | La charte graphique (anthracite #262222, blanc cassé #fafaf9, rouge #e13232) |
| `app.js` | Le fonctionnement : afficher les offres, suivre les candidatures |
| `data/offres.json` | La veille du jour : c'est le seul fichier à mettre à jour chaque jour |
| `sw.js`, `manifest.webmanifest` | Ce qui permet d'installer l'app et de l'ouvrir hors ligne |
| `icons/` | L'icône Daruma de l'écran d'accueil |

## Mettre en ligne (une seule fois)

Dans GitHub : **Settings → Pages → Branch : `main` / `(root)` → Save**.
Au bout d'une minute, l'app est disponible à l'adresse `https://saaandesign.github.io/veille-pro/`.

## Installer sur le téléphone

- **iPhone (Safari)** : ouvrir l'adresse, bouton Partager, puis « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir l'adresse, menu ⋮, puis « Ajouter à l'écran d'accueil » ou « Installer l'application ».

## Format de `data/offres.json`

```json
{
  "miseAJour": "2026-11-11",
  "exemple": false,
  "offres": [
    {
      "id": "identifiant-unique",
      "titre": "Social Media Manager",
      "entreprise": "Nom de l'entreprise",
      "contrat": "CDI",
      "lieu": "Paris 10e",
      "teletravail": false,
      "publiee": "2026-11-09",
      "match": 92,
      "lien": "https://lien-vers-l-annonce",
      "pourquoi": "Pourquoi ce % de match",
      "missions": ["..."],
      "attendus": ["..."],
      "angle": "Comment se positionner"
    }
  ],
  "tendances": [{ "nom": "Suite Adobe", "pct": 68 }],
  "conseil": "Le conseil du jour"
}
```

Mettre `"exemple": true` affiche « Offres d'exemple » en haut de la liste.
