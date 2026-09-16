## Plan: AgriTrade productionization

TL;DR: Build the next phase around the existing screen structure and shared state, then fill in the missing production flows: real price data handling, persistent lot/chat updates, and a clean verification pass. The app already has a strong UI shell in [src/AgriTradeApp.jsx](src/AgriTradeApp.jsx), a price dashboard in [src/components/HomeScreen.jsx](src/components/HomeScreen.jsx), and a basic context store in [src/context/TradeContext.jsx](src/context/TradeContext.jsx), so the plan should reuse those patterns instead of starting from scratch.

### Steps
1. Audit and wire the existing app foundation
   - Confirm how the role-based navigation in [src/AgriTradeApp.jsx](src/AgriTradeApp.jsx) drives farmer/buyer screens and identify any broken or unconnected state transitions.
   - Reuse [src/context/TradeContext.jsx](src/context/TradeContext.jsx) for shared lots/chats/role state and extend it with the missing transaction actions (confirm deal, mark paid, refresh state) instead of duplicating logic in components.
   - Validate the current mock data and data contracts in [src/data/mockData.js](src/data/mockData.js) against the screens that consume them.
   - Add a geolocation capture step at the end of the welcome/auth flow in [WelcomeAuth.jsx](WelcomeAuth.jsx): trigger browser geolocation after the user picks role/phone/OTP/name, capture the farmer’s current location, and store city/district with latitude/longitude in the profile so the app can use that data for mandi and warehouse recommendations.

2. Stabilize the real data layer
   - Keep Supabase-backed price fetching in [src/services/mandiService.js](src/services/mandiService.js) as the source of truth for market prices, but add explicit loading/error/fallback behavior to avoid blank states.
   - Normalize commodity and market fields consistently so the catalog search, selected commodity pills, and the table in [src/components/HomeScreen.jsx](src/components/HomeScreen.jsx) all use the same data shape.
   - Decide whether current price results should be cached locally or refreshed on demand; this should be reflected in the planned screen behavior and verification steps.

3. Finish the core trade workflow
   - Extend the current lot creation flow in [src/AgriTradeApp.jsx](src/AgriTradeApp.jsx) so published lots are pushed into shared state and immediately show up in the correct lists.
   - Add the missing chat lifecycle actions in [src/context/TradeContext.jsx](src/context/TradeContext.jsx): offer updates, confirmation states, and payment completion, so the screens can transition cleanly from negotiating to paid.
   - Make the detail screens and chat UI consistent with the same shared data model so farmer and buyer experiences remain aligned.

4. Polish UX and styling
   - Use [src/constants/theme.js](src/constants/theme.js) and [src/index.css](src/index.css) to finish visual consistency for empty states, chips, cards, and action buttons across farmer and buyer flows.
   - Review the shared design tokens already used in [src/AgriTradeApp.jsx](src/AgriTradeApp.jsx), especially color, spacing, and pill/button states, to prevent design drift between screens.
   - Add any small but important mobile behaviors already hinted at in the UI (scrolling, back navigation, modal layering, accessible labels).

5. Verify end-to-end
   - Run the existing project checks: build and lint (`npm run build`, `npm run lint`).
   - Smoke-test the app locally with the existing scripts (`npm run start` or `npm run dev`) and confirm the key flows: home search, lot publish, offer negotiation, and payment state changes.
   - Capture any remaining issues as explicit follow-up tasks rather than leaving them hidden in the code.

### Relevant files
- [src/AgriTradeApp.jsx](src/AgriTradeApp.jsx) — main screen orchestration, lot/chat navigation, and transaction UI
- [src/context/TradeContext.jsx](src/context/TradeContext.jsx) — shared state and missing transaction actions
- [src/components/HomeScreen.jsx](src/components/HomeScreen.jsx) — commodity search, catalog pills, and market table
- [src/services/mandiService.js](src/services/mandiService.js) — Supabase queries for market data
- [src/lib/supabaseClient.js](src/lib/supabaseClient.js) — connection/config entry point
- [src/data/mockData.js](src/data/mockData.js) — current in-memory lots/chats for testing flows
- [src/constants/theme.js](src/constants/theme.js) and [src/index.css](src/index.css) — styling/design tokens
- [README.md](README.md) — project summary and setup reference

### Verification
1. Run `npm run build` to confirm the current React/Vite app still compiles.
2. Run `npm run lint` to surface any code issues introduced by refactoring.
3. Run `npm run start` or `npm run dev` and manually verify these flows: commodity search/filter, create lot, negotiate offer, confirm rate, and payment screen updates.

### Decisions
- Keep the current role-based architecture and reuse the existing mock data for transaction flow until a fuller backend is ready.
- Treat Supabase price data as the live source for mandi prices, while keeping lot/chat state in client-side shared state for this phase.
- Avoid adding new frameworks or large rewrites; the implementation should build on the existing React component structure and context store.

### Further considerations
1. Decide whether the eventual backend should persist lots/chats in Supabase or stay in a lightweight local persistence layer for the first release.
2. Define the exact UX for buyer/farmer confirmations and payment statuses before expanding the state model.
3. If the goal is a demo rather than a production app, the current mock-state flow is acceptable as-is and only the data layer needs hardening.
