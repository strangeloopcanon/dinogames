# Cretaceous Hold'em

A dinosaur-themed multiplayer Texas Hold'em poker game. Each player joins from their own phone/tablet via a room code.

## Quick Start

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Open in browser (check terminal for URL)
# Share the URL with other players on the same network
```

## How to Play

1. **Create a room**: Enter your name and click "Join the Hunt" (leave room code blank to create)
2. **Share the code**: Tell others the 4-letter room code shown on screen
3. **Others join**: They enter the code and their name
4. **Start**: Once 2+ players join, click "Start the Hunt!"

## Dinosaur Theme

Your cards show dinosaurs instead of regular playing cards:

| Card | Dinosaur |
|------|----------|
| A | T. rex |
| K | Spinosaurus |
| Q | Giganotosaurus |
| J | Allosaurus |
| 10 | Triceratops |
| 9 | Stegosaurus |
| 8 | Velociraptor |
| 7 | Brachiosaurus |
| 6 | Ankylosaurus |
| 5 | Parasaurolophus |
| 4 | Dilophosaurus |
| 3 | Compsognathus |
| 2 | Microraptor |

Suits are "Clans": Claw (♠), Leaf (♥), Bone (♦), Egg (♣)

## Actions

| Poker Term | Dino Name |
|------------|-----------|
| Check | Stalk |
| Call | Match the Roar |
| Raise | Pounce |
| All-in | Meteor Strike |

## Hand Rankings

| Hand | Dino Name |
|------|-----------|
| High Card | Lone Fossil |
| Pair | Twin Eggs |
| Two Pair | Double Nest |
| Three of a Kind | Raptor Pack |
| Straight | Migration Line |
| Flush | Same Clan |
| Full House | Herd + Hunter |
| Four of a Kind | Stampede |
| Straight Flush | Perfect Hunt |
| Royal Flush | Meteor Prophecy |

## Betting

Fixed-limit Texas Hold'em:
- Starting chips: 20 Amber Nuggets
- Blinds: 1/2 (Hatchling/Adult)
- Bet size: 1 on preflop/flop, 2 on turn/river
- Max 3 raises per street

## Deploy (Optional)

```bash
# Deploy to Cloudflare via PartyKit
npx partykit deploy
```

This gives you a public URL like `https://dinopoker.yourname.partykit.dev`

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck
```

## Tech Stack

- [PartyKit](https://partykit.io/) - Real-time multiplayer framework
- TypeScript - Type-safe client and server
- [pokersolver](https://www.npmjs.com/package/pokersolver) - Hand evaluation
