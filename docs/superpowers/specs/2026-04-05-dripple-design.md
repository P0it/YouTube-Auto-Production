# Dripple — Design Spec

## Overview

Dripple is a multiplayer English word card battle game. Players compete by arranging word cards into grammatically correct sentences. The game combines language learning with board game entertainment, featuring character-driven design inspired by Duolingo's visual style.

**Core concept:** A board game, not a learning app. Entertainment first.

## Target Audience

- All ages (children to adults)
- No difficulty level system — single unified experience
- Multilingual UI support (Korean, Japanese, English, etc.)

## Revenue Model

- Free to play + ad-supported (Google AdMob)
- Rewarded ads + banner ads

## Platform

- Mobile: iOS + Android (Flutter cross-platform)
- Web: Flutter Web

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Flutter (Dart) | Cross-platform UI + app shell |
| **Game Engine** | Flame Engine | Card physics, fan-shaped hand, drag & drop, game loop |
| **Character Animation** | Rive | Interactive character animations with State Machine (same as Duolingo) |
| **Backend** | Firebase | Auth, Realtime DB, Matchmaking |
| **Ads** | Google AdMob | Rewarded + banner ads |
| **Grammar Engine** | Custom rule-based (Dart) | Sentence validation via POS tagging + structure templates |
| **AI Player** | Custom rule-based (Dart) | Card selection algorithm for single-player mode |

### Why This Stack

- **Flutter + Flame + Rive** is the lightest combination that supports game-grade card interactions AND Duolingo-level character animations
- **No LLM/API dependency** — grammar validation and AI player are fully rule-based, keeping operational cost at $0
- **Firebase free tier** covers initial scale; backend only used for online multiplayer sync
- **gstack workflow** can be leveraged for development automation (design, QA, security, release)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Client (Flutter)                 │
├──────────┬──────────┬──────────┬────────────────┤
│  Flame   │   Rive   │ Grammar  │   AI Player    │
│  Engine  │ Runtime  │  Engine  │                │
│          │          │          │                │
│ Card     │ Character│ POS tag  │ Rule-based     │
│ physics, │ emotions,│ matching,│ card selection │
│ board,   │ reactions│ structure│ strategy       │
│ drag&drop│          │ templates│                │
└────┬─────┴────┬─────┴────┬─────┴───────┬────────┘
     │          │          │             │
     └──────────┴──────┬───┴─────────────┘
                       │
          ⬇ WebSocket / REST (online only) ⬇
                       │
     ┌─────────────────┴──────────────────┐
     │          Backend (Firebase)          │
     ├──────────┬───────────┬─────────────┤
     │   Auth   │ Realtime  │ Matchmaking │
     │          │    DB     │             │
     │ Login,   │ Game state│ Random,     │
     │ guest    │ sync,     │ friend      │
     │ mode     │ turn/card/│ invite      │
     │          │ emote     │             │
     └──────────┴───────────┴─────────────┘
```

### Key Design Decisions

1. **All game logic runs on the client** — offline AI battles work without internet
2. **Server only for online multiplayer** — Firebase Realtime DB syncs game state, turns, cards, emotes
3. **Grammar validation is rule-based** — no LLM, no API cost, deterministic results
4. **Character animations via Rive State Machine** — game events trigger emotion transitions

## Game Rules

### Objective

Players compete across multiple rounds. Each round, players arrange word cards to form grammatically correct English sentences. Points accumulate across rounds. The player with the highest total score at the end wins.

### Game Flow

1. **Setup:** 2~4 players. Each player receives 7 word cards from the deck.
2. **Turns:** Players take turns clockwise. On your turn, you may:
   - Place a word card from your hand into your sentence zone
   - Draw a card from the deck
   - Play a special card
3. **Sentence Submission:** When you believe your sentence is complete, press Submit.
   - If correct: earn points based on sentence length and complexity. All players see the sentence. Your character celebrates.
   - If incorrect: lose your turn. Error reason displayed. Other players' characters can react/taunt.
4. **Rounds:** A game consists of multiple rounds (e.g., 5 rounds). Scores accumulate.
5. **Winner:** Player with the highest total score after all rounds.

### Special Cards

| Card | Effect |
|------|--------|
| **SKIP** | Skip the next player's turn |
| **STEAL** | Take 1 random card from a chosen player |
| **UNDO** | Remove 1 card from an opponent's sentence zone (returns to their hand) |
| **WILD** | Can be used as any word |

### Scoring

- Base score: number of words in the completed sentence
- Bonus: consecutive correct sentences (combo multiplier)
- Penalty: incorrect submission loses the turn (no negative points)

## Grammar Engine

### Card Metadata

Each word card carries metadata for rule-based grammar validation:

```dart
class WordCard {
  String word;          // "cat"
  String pos;           // "noun", "verb", "adjective", "article", etc.
  int person;           // 1, 2, 3
  String number;        // "singular", "plural"
  bool countable;       // true/false (for nouns)
  bool vowelStart;      // true/false (for a/an detection)
  int? adjOrder;        // 1-8 for adjective ordering
  Map<String, String> meanings; // {"ko": "고양이", "ja": "猫", "en": "cat"}
}
```

### Validation Rules

| Rule | Check | Example |
|------|-------|---------|
| **Article agreement** | `a` + consonant start, `an` + vowel start | `a cat` ✅, `a apple` ❌ |
| **Singular/plural** | Article must match noun number | `a cats` ❌, `the cats` ✅ |
| **Subject-verb agreement** | Subject person/number matches verb form | `He likes` ✅, `He like` ❌ |
| **Adjective order** | Adjectives follow English ordering convention | `big red ball` ✅ |
| **Sentence structure** | Card sequence matches valid pattern (SVO, SVC, etc.) | `I like cats` ✅ |

### Semantic Validity

- Card sets are designed as semantically compatible groups — "The chair eats a book" is prevented by card set design, not by AI
- Complex structures (relative clauses, etc.) are avoided through card set curation

## Screens

### 1. Home

- Green gradient background (Duolingo-inspired)
- Custom Rive character with idle animation (blinking, swaying)
- PLAY button (primary CTA)
- Character / Ranking / Settings buttons
- Coin balance display

### 2. Mode Selection

- **AI Battle** — Play against 1~3 AI opponents (select count: 2/3/4 players)
- **Online Battle** — Random matchmaking (2~4 players), LIVE indicator
- **Friend Battle** — Invite via code/link (2~4 players)

### 3. Game Board (Core Screen)

**Layout (top to bottom):**

1. **Scoreboard bar** — All players' avatars + scores + round indicator (e.g., Round 3/5)
2. **Opponents area** — Each opponent shown as character avatar + card count (backs only)
   - Emote bubbles appear above characters on reaction
3. **Sentence zone** — Player's sentence building area. Placed cards shown in order. Empty slots as dashed placeholders
4. **Action bar** — Draw pile + Submit button + Undo
5. **Emote bar** — 5 custom character expression buttons (happy, angry, taunt, amazed, shocked)
   - NOT emoji — custom character face variations
6. **My hand** — Fan-shaped card arrangement at bottom. Cards show word only (no POS tags). Special cards have distinct color + icon

### 4. Sentence Judgment

- **Correct:** Green celebration screen. Sentence displayed. Points awarded. Player's character celebrates. Other characters react
- **Incorrect:** Red error screen. Sentence crossed out. Error reason shown (e.g., "a + plural noun not allowed"). Player's character embarrassed. Others can taunt

### 5. Final Result

- Podium-style ranking (1st/2nd/3rd with pedestals, 4th listed below)
- Winner gets crown animation
- Stats: sentences completed, special cards used, combo bonus
- "Home" and "Play Again" buttons

## Character & Emote System

### Characters

- Custom-designed characters (AI-generated concept art + Rive animation)
- Each player selects a character from available roster
- Characters have multiple emotion states managed by Rive State Machine:
  - Idle (default — blinking, subtle movement)
  - Happy (correct answer, winning)
  - Sad (wrong answer, losing)
  - Taunt (taunting opponent)
  - Shocked (opponent steals card, unexpected event)
  - Celebrate (winning the game)

### Emote System

- 5 emote buttons during gameplay
- Each emote triggers the player's character animation AND broadcasts to all players via Firebase Realtime
- Emotes are custom character expressions, NOT standard emoji
- Emote cooldown to prevent spam

### Design Assets

- Character concepts: AI-generated (Midjourney/DALL-E) then refined
- Character animations: Built in Rive with State Machine
- Card design, icons, UI elements: Custom-designed (AI-assisted)
- Visual style: Rounded corners, soft shadows, vibrant colors, playful typography

## Internationalization (i18n)

- All UI text externalized for translation
- Supported languages (initial): Korean, English, Japanese
- Card meanings stored as multilingual map
- Error messages for grammar validation localized

## Operational Costs

| Item | Cost |
|------|------|
| Grammar validation | $0 (client-side rules) |
| AI player | $0 (client-side rules) |
| Firebase (Auth + Realtime DB) | $0~25/month (free tier initially) |
| AdMob revenue | Positive |
| **Total monthly cost** | **$0~25** |

## Open Questions

1. Maximum number of players per game — currently spec'd as 2~4
2. Turn timer duration — suggested 30 seconds
3. Number of rounds per game — suggested 5, configurable in room settings
4. Card deck size and word selection criteria
5. Character roster size at launch
6. Detailed special card balance/frequency in deck
