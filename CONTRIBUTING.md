# Contributing

## Project Overview

bahn.deals is a Firefox WebExtension that helps users find cheaper split-ticket combinations for Deutsche Bahn journeys. It analyzes trips on bahn.de and computes optimal partial ticket combinations.

## Architecture

### Extension Structure (MV2)
- **background.js**: Generated from modular source files (see Development section)
- **dbnav-lite.js**: Deutsche Bahn API wrapper
- **content/overview-menu.js**: Content script injecting "Find cheapest split" option into bahn.de search results
- **pages/**: Extension UI pages (popup, options, analysis)

### Project Structure

#### Background Services (Modular source files)
- `extension/background/services/` - Service classes (session, options, route, pricing, optimizer, analysis)
- `extension/background/utils/` - Utility functions (date handling, coordinate processing)

#### UI Components (ES6 Modules)
- `extension/pages/components/` - UI components (map, progress tracker, results, options form)
- `extension/pages/utils/` - UI utilities (formatting helpers)

#### Generated Files
- `extension/background.js` - Built from modular files (in .gitignore)

### Key APIs
- Deutsche Bahn Vendo/Movas APIs via dbnav profile (no API key required)
  - Taken from [public-transport/db-vendo-client](https://github.com/public-transport/db-vendo-client), but unable to use directly because of this being a webextension
  - If you know how to get this working, please share!
- Endpoints: locations search, journey planning, ticket refresh/pricing
- Throttling implemented to not hit rate limits

### Core Analysis Flow
1. Extract journey from bahn.de page (stations, times, trains)
2. Resolve station EVA numbers via locations API
3. Fetch full journey details with all intermediate stops
4. Generate all possible partial segments
5. Price each segment maintaining exact route/trains
6. Run dynamic programming optimization to find cheapest combination

## Development Workflow

### Building the Extension

The background script is generated from modular source files:

```bash
make build-background
```

This creates `extension/background.js` from the files in `extension/background/`.

### Development Steps

1. Edit the modular source files in `extension/background/`
2. Run `make build-background` to rebuild
3. Load/reload the extension in Firefox via `about:debugging`

## Important Implementation Details

- Uses MV2, migration to MV3 would be nice
- All API calls must run from background context (CORS restrictions)
- dbnav-lite.js provides minimal API wrapper
- Exact route matching required when pricing segments (compare train sequences)
- Session storage for passing data between content script and analysis page
- Respect user options: class (1st/2nd), age, BahnCard, Deutschlandticket
