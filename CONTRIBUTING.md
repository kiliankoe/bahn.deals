# Contributing

## Project Overview

bahn.deals is a Firefox WebExtension that helps users find cheaper split-ticket combinations for Deutsche Bahn journeys. It analyzes trips on bahn.de and computes optimal partial ticket combinations.

## Architecture

### Extension Structure (MV2)
- **background.js** + **dbnav-lite.js**: Background scripts handling API calls, session management, and journey analysis
- **content/overview-menu.js**: Content script injecting "Find cheapest split" option into bahn.de search results
- **pages/**: Extension UI pages (popup, options, analysis)

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

## Development Commands

There's no build process, it's just plain JS.
Load the unpacked extension in Firefox via `about:debugging`.

## Important Implementation Details

- Uses MV2, migration to MV3 would be nice
- All API calls must run from background context (CORS restrictions)
- dbnav-lite.js provides minimal API wrapper
- Exact route matching required when pricing segments (compare train sequences)
- Session storage for passing data between content script and analysis page
- Respect user options: class (1st/2nd), age, BahnCard, Deutschlandticket
