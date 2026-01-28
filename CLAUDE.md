# CLAUDE.md - AI Assistant Guide for DutySnap

> **Last Updated:** 2026-01-27
> **Repository Status:** Active development - MVP phase

## Project Overview

**DutySnap** (working title) is a mobile application that uses Meta Ray-Ban smart glasses to capture product images, classify them using AI to determine HS codes, and calculate French import duties and taxes.

### Core Flow
```
📸 Capture image → 🏷️ Classify product → 📊 Get HS code → 💶 Calculate duty/VAT
   (Meta glasses)     (Zonos API)         (6-10 digit)      (French rates)
```

### Current Status

**Phase 1: Foundation** - Setting up project structure and Meta SDK integration.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Project Name** | DutySnap (working title) |
| **Repository** | `tbrobinson116/onepercentfitness` |
| **Primary Branch** | `main` |
| **Mobile App** | React Native + TypeScript |
| **Backend** | Node.js + Express |
| **Key APIs** | Meta Wearables SDK, Zonos Classify, Zonos Landed Cost |
| **Target Platform** | iOS 15.2+, Android 10+ |

---

## Tech Stack

### Mobile App
- **Framework:** React Native with TypeScript
- **State:** Zustand
- **Navigation:** React Navigation
- **Meta SDK:** Meta Wearables Device Access Toolkit v0.3.0

### Backend API
- **Runtime:** Node.js 20+
- **Framework:** Express or Fastify
- **Database:** PostgreSQL + Prisma
- **Image Storage:** AWS S3 or Cloudflare R2

### External Services
| Service | Purpose | Docs |
|---------|---------|------|
| **Meta Wearables SDK** | Glasses camera access | [Developer Portal](https://developers.meta.com/wearables/) |
| **Zonos Classify** | HS code classification | [API Docs](https://zonos.com/docs/supply-chain/classify) |
| **Zonos Landed Cost** | Duty/VAT calculation | [API Docs](https://zonos.com/docs/supply-chain/landed-cost) |

---

## Project Structure

```
dutysnap/
├── CLAUDE.md
├── README.md
├── package.json
│
├── app/                      # React Native mobile app
│   ├── src/
│   │   ├── components/
│   │   │   ├── glasses/      # Meta SDK integration
│   │   │   ├── scanner/      # Image capture UI
│   │   │   ├── results/      # Classification display
│   │   │   └── duty/         # Duty/tax display
│   │   ├── hooks/
│   │   │   ├── useGlassesConnection.ts
│   │   │   ├── useImageCapture.ts
│   │   │   └── useClassification.ts
│   │   ├── services/
│   │   │   ├── metaSDK.ts    # Meta Wearables abstraction
│   │   │   ├── api.ts        # Backend API client
│   │   │   └── storage.ts    # Local storage
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ScanScreen.tsx
│   │   │   ├── ResultsScreen.tsx
│   │   │   └── HistoryScreen.tsx
│   │   ├── types/
│   │   │   ├── product.ts
│   │   │   ├── classification.ts
│   │   │   └── duty.ts
│   │   └── App.tsx
│   └── package.json
│
├── api/                      # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── classify.ts   # POST /api/classify
│   │   │   └── duty.ts       # POST /api/duty
│   │   ├── services/
│   │   │   ├── zonos.ts      # Zonos API client
│   │   │   └── imageStorage.ts
│   │   └── index.ts
│   └── package.json
│
└── docs/                     # Documentation
    └── api.md
```

---

## Implementation Plan

### Phase 1: Foundation ✅ In Progress
- [ ] Set up React Native project with TypeScript
- [ ] Register as Meta Wearables developer
- [ ] Integrate Meta SDK for camera access
- [ ] Implement mock device testing flow
- [ ] Create basic UI: connection status, capture button

### Phase 2: Classification
- [ ] Set up backend API (Node.js)
- [ ] Integrate Zonos Classify API
- [ ] Implement image upload to S3/R2
- [ ] Create classification endpoint
- [ ] Display HS code results in app

### Phase 3: Duty Calculation
- [ ] Integrate Zonos Landed Cost API
- [ ] Build duty/tax display UI
- [ ] Add product value input
- [ ] Show breakdown: duties, VAT, total landed cost

### Phase 4: Polish
- [ ] Add user authentication
- [ ] Implement scan history
- [ ] Improve UX/UI
- [ ] Error handling and edge cases

---

## Key Domain Concepts

### HS Codes (Harmonized System)
- International product classification for customs
- 6 digits = universal, 8-10 digits = country-specific
- Example: `6403.99` = Footwear with leather uppers

### French Import Taxes
| Tax Type | Rate | Notes |
|----------|------|-------|
| Customs Duty | Varies by HS | 0-48%+ from TARIC |
| Standard VAT | 20% | Most goods |
| Reduced VAT | 10% / 5.5% / 2.1% | Specific categories |

### Zonos API Flow
```typescript
// 1. Classify product
POST /api/classify
{
  imageUrl: "https://...",
  productName: "optional description",
  shipToCountry: "FR"
}
// Returns: { hsCode: "6403.99.0000", confidence: 0.92 }

// 2. Calculate landed cost
POST /api/duty
{
  hsCode: "6403.99.0000",
  productValue: 150,
  currency: "EUR"
}
// Returns: { duties: 12.00, vat: 32.40, total: 194.40 }
```

---

## Environment Variables

```bash
# Backend API
PORT=3001
DATABASE_URL=postgresql://...

# Zonos API
ZONOS_API_KEY=your_zonos_api_key

# Image Storage (S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=dutysnap-images

# Optional: OpenAI for enhanced classification
OPENAI_API_KEY=

# Meta (if required for SDK)
META_APP_ID=
```

---

## Meta Wearables SDK Reference

### Supported Devices
- Ray-Ban Meta Gen-1 & Gen-2
- Oakley Meta HSTN

### Key Capabilities
```swift
// iOS - Capture photo
let imageData = try await session.capturePhoto(format: .jpeg)

// Android - Capture photo
val photo = session.capturePhoto(format = PhotoFormat.JPEG)
```

### SDK Setup
- Android: [github.com/facebook/meta-wearables-dat-android](https://github.com/facebook/meta-wearables-dat-android)
- iOS: [github.com/facebook/meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios)
- Mock device available for testing without hardware

---

## Commands Reference

```bash
# Mobile App (from /app directory)
npm install              # Install dependencies
npm start                # Start Metro bundler
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator

# Backend API (from /api directory)
npm install              # Install dependencies
npm run dev              # Start dev server
npm run build            # Build for production
npm test                 # Run tests

# Database
npx prisma migrate dev   # Run migrations
npx prisma studio        # Open Prisma Studio
```

---

## Git Conventions

### Branch Naming
- Feature: `feature/<description>`
- Bug fix: `fix/<description>`
- Claude AI: `claude/<session-id>`

### Commit Messages
```
feat(scan): add image capture from glasses
fix(duty): correct VAT calculation for reduced rates
docs(readme): update setup instructions
```

---

## API Endpoints

### POST /api/classify
Classify a product image and return HS code.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "productName": "optional product description"
}
```

**Response:**
```json
{
  "hsCode": "6403.99.0000",
  "hsCode6": "6403.99",
  "description": "Footwear with outer soles of rubber/plastics and uppers of leather",
  "confidence": 0.92
}
```

### POST /api/duty
Calculate import duties and taxes for France.

**Request:**
```json
{
  "hsCode": "6403.99.0000",
  "productValue": 150.00,
  "currency": "EUR",
  "originCountry": "US"
}
```

**Response:**
```json
{
  "duties": {
    "amount": 12.00,
    "rate": "8%"
  },
  "vat": {
    "amount": 32.40,
    "rate": "20%"
  },
  "totalLandedCost": 194.40,
  "breakdown": [
    { "type": "Product", "amount": 150.00 },
    { "type": "Customs Duty", "amount": 12.00 },
    { "type": "VAT", "amount": 32.40 }
  ]
}
```

---

## AI Assistant Guidelines

### When Working on This Project

1. **Read Before Writing:** Always read existing files before modifying
2. **Follow Patterns:** Match existing code style and architecture
3. **Minimal Changes:** Only change what's necessary
4. **Update CLAUDE.md:** Keep this file current as project evolves
5. **Test on Mock:** Use Meta SDK mock device during development

### Key Files to Understand
- `/app/src/services/metaSDK.ts` - Glasses integration
- `/app/src/services/api.ts` - Backend communication
- `/api/src/services/zonos.ts` - HS classification & duty lookup
- `/api/src/routes/classify.ts` - Main classification endpoint

### Things to Avoid
- Hardcoding API keys (use env vars)
- Skipping error handling for API calls
- Adding features not in current phase
- Breaking the capture → classify → duty flow

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Meta SDK not connecting | Ensure Bluetooth enabled, glasses paired in Meta View app |
| Classification fails | Check image quality, ensure product is clearly visible |
| Duty rates seem wrong | Verify HS code is correct, check origin country |
| Mock device not working | Reinstall SDK, check mock device configuration |

---

## Resources

- [Meta Wearables Developer Portal](https://developers.meta.com/wearables/)
- [Zonos Classify Docs](https://zonos.com/docs/supply-chain/classify)
- [Zonos Landed Cost Docs](https://zonos.com/docs/supply-chain/landed-cost)
- [EU TARIC Database](https://ec.europa.eu/taxation_customs/dds2/taric/)
- [French Customs (Douane)](https://www.douane.gouv.fr/)

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-01-27 | Complete rewrite for DutySnap customs classification app |
| 2026-01-27 | Initial CLAUDE.md created |

---

*Update this document as the project evolves.*
