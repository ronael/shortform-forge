# Content Planner Launch Handoff

This document records the operational decisions for launching the bilingual
curious-question accounts and the prompt to use later in the `content-planner`
project.

Content Planner should contain human interventions and decisions. Shortform
Forge remains responsible for deterministic production and QA.

## Brands

- French: `Bizarrement Curieux`
- English: `Oddly Curious`

The reusable public names, handles, descriptions, bios, and account-privacy
checklist are maintained in
`production-profiles/bizarrement-curieux/CHANNEL_SETUP.md`. Keep private login
and recovery information out of this repository and Content Planner.

## Account Architecture

### Private owner account

Create one private owner email address, for example `owner@brand-domain`, that
never appears publicly. It owns both YouTube Brand channels:

- Bizarrement Curieux
- Oddly Curious

YouTube allows one Google Account to manage multiple Brand channels. Use YouTube
Studio permissions instead of sharing the owner password.

Reference: https://support.google.com/youtube/answer/4642409

### Backup owner

Create a second private recovery address, preferably at another provider. Add it
as a secondary owner of both YouTube channels.

Reference: https://support.google.com/youtube/answer/4628007

### Operational addresses

Create one operational address per language:

- `fr@brand-domain`
- `en@brand-domain`

Use the French address for the French TikTok and Instagram accounts. Use the
English address for the English TikTok and Instagram accounts. TikTok requires a
different email address for each account.

Reference: https://support.tiktok.com/en/log-in-troubleshoot/log-in/email-and-phone-number

The two Instagram accounts may be grouped in the same Meta account-management
space for easier switching. Keep their identities distinct and disable automatic
profile synchronization and cross-posting.

Reference: https://www.facebook.com/help/943858526073065

### Public contact

Create `contact@brand-domain` for bios and commercial requests. Never use it as
a platform login.

### Security rules

- Use a password manager and a unique password for every account.
- Enable app-based 2FA or passkeys.
- Keep recovery codes offline.
- Do not store passwords, tokens, cookies, or recovery codes in Content Planner.
- Do not use Gmail `+fr` and `+en` aliases for critical accounts.
- Never expose the private owner address publicly.
- Reserve social handles before finalizing the logos.

## Editorial Mix

Target the following mix:

- 30 percent everyday science;
- 25 percent amusing but intelligent questions;
- 20 percent animals, geography, and natural phenomena;
- 25 percent subjects connected to news, games, politics, culture, or online
  trends.

News can supply the hook while the explanation remains evergreen. Examples:

- an open-world game release leads to a question about why virtual maps feel
  larger than they are;
- an election leads to a neutral explanation of misleading electoral maps;
- a heat wave leads to why cities remain hot at night;
- a viral eruption leads to how volcanoes can produce lightning;
- a console release leads to why SSDs reduce loading screens;
- an AI trend leads to why generated motion can look artificial.

For political or sensitive subjects, separate facts from opinion, avoid
predictions and personal attacks, record the verification date, and require
stronger human review.

## Anti-Cringe Filter

A comic question must pass these checks:

1. The question remains interesting after the joke.
2. The answer contains a real reveal.
3. The script works without fake slang or an infantilizing tone.
4. The humor comes naturally from the fact, comparison, or timing.
5. Available footage can support the joke.

Avoid forced jokes, simulated reactions, excessive slang, fake viral phrases,
emoji-heavy writing, and bodily subjects selected only for shock value.

## Content Planner Prompt

Copy the following prompt into a conversation opened on the `content-planner`
project.

```md
# Création des tâches humaines — Lancement des comptes bilingues

Tu travailles dans le projet `content-planner`.

Avant toute modification :

- lire `AGENTS.md` ;
- lire `README.md` ;
- inspecter le modèle de données et les workflows existants ;
- réutiliser les projets, statuts et checklists existants lorsque possible.

Ne réalise aucune nouvelle recherche stratégique.

Les décisions ci-dessous sont déjà prises. Ton rôle est uniquement de créer les
tâches nécessitant une intervention humaine.

## Marques

- Français : `Bizarrement Curieux`
- Anglais : `Oddly Curious`

## Architecture validée

- une adresse privée propriétaire des deux chaînes YouTube ;
- une adresse privée de récupération et propriétaire secondaire ;
- une adresse opérationnelle française ;
- une adresse opérationnelle anglaise ;
- une adresse publique de contact ;
- deux chaînes YouTube de marque distinctes ;
- un compte TikTok et un compte Instagram par langue ;
- mots de passe uniques, 2FA et codes de récupération hors de Content Planner ;
- aucune publication automatique.

## Projet à créer

Créer :

`Lancement — Bizarrement Curieux / Oddly Curious`

## Tâches humaines à créer

### Infrastructure et sécurité

- Acheter ou sélectionner le domaine de la marque
- Créer l’adresse propriétaire privée
- Créer l’adresse propriétaire de secours
- Créer l’adresse opérationnelle française
- Créer l’adresse opérationnelle anglaise
- Créer l’adresse publique de contact
- Configurer le gestionnaire de mots de passe
- Activer la 2FA sur chaque adresse
- Sauvegarder les codes de récupération hors ligne

Ne jamais stocker les mots de passe ou codes dans Content Planner.

### Réservation des identités

- Vérifier et réserver le handle français sur YouTube
- Vérifier et réserver le handle français sur TikTok
- Vérifier et réserver le handle français sur Instagram
- Vérifier et réserver le handle anglais sur YouTube
- Vérifier et réserver le handle anglais sur TikTok
- Vérifier et réserver le handle anglais sur Instagram
- Documenter les handles retenus et leurs variantes de secours

### Création des comptes

- Créer la chaîne YouTube Bizarrement Curieux
- Créer la chaîne YouTube Oddly Curious
- Ajouter le propriétaire de secours aux deux chaînes
- Configurer les permissions YouTube Studio
- Créer le compte TikTok français
- Créer le compte TikTok anglais
- Créer le compte Instagram français
- Créer le compte Instagram anglais
- Ajouter les comptes Instagram au même espace de gestion
- Désactiver la synchronisation automatique des profils
- Désactiver le cross-posting automatique

### Identité visuelle

- Lancer la génération des deux logos avec le prompt validé
- Sélectionner la meilleure proposition
- Demander les corrections nécessaires
- Valider le logo français
- Valider le logo anglais
- Exporter les avatars carrés
- Exporter les versions haute résolution
- Vérifier la lisibilité des avatars à petite taille

### Configuration éditoriale

- Valider la bio française
- Valider la bio anglaise
- Ajouter les logos et les bios aux six comptes
- Configurer les liens publics
- Configurer les paramètres de langue et de pays
- Vérifier les paramètres de téléchargement haute qualité
- Vérifier les réglages de commentaires et de modération

### Première publication

Créer une tâche humaine par vidéo et par langue :

- revoir le master final ;
- valider les faits ;
- valider les plans et les espèces représentées ;
- valider le titre et la description ;
- publier manuellement ;
- enregistrer l’URL publiée ;
- vérifier le rendu après compression de la plateforme.

Créer ces tâches pour les cinq vidéos françaises et les cinq vidéos anglaises
déjà produites.

### Prochain batch

Créer une tâche humaine pour :

- examiner les dix sujets proposés ;
- ajouter des sujets plus comiques ;
- ajouter des sujets liés à l’actualité ;
- ajouter des sujets jeux vidéo, géographie, culture et politique ;
- sélectionner les cinq prochains sujets ;
- rejeter les sujets présentant un risque de cringe ;
- valider les scripts avant production ;
- valider les vidéos finales avant publication.

## Règles

Ne crée pas de tâches pour les opérations que Shortform Forge peut exécuter
automatiquement.

Les tâches Content Planner doivent correspondre à :

- une décision humaine ;
- une création de compte ;
- une connexion à une plateforme ;
- une validation ;
- une action juridique ou de sécurité ;
- une publication manuelle ;
- une appréciation éditoriale.

Ne crée aucun compte externe et ne publie aucun contenu.

À la fin, présenter la liste des tâches créées, leurs dépendances et les actions
humaines prioritaires.
```
