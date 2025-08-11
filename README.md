# bahn.deals 🚂💰

A Firefox WebExtension that finds cheaper split-ticket combinations for Deutsche Bahn journeys by analyzing all possible partial segments of your trip.

## Overview

When booking train tickets on bahn.de, the end-to-end price isn't always the cheapest option. By splitting your journey into multiple segments, you can often save money while taking the exact same trains. This extension automates the process of finding the optimal split-ticket combination.

## Usage

1. Search for a journey on [bahn.de](https://www.bahn.de)

2. Click the 3-dot menu (⋮) on any journey in the search results

3. Select "Günstigste Aufteilung suchen" from the menu

4. Configure your preferences (optional):
   - Travel class (1st/2nd)
   - BahnCard discount
   - Age (affects pricing)

5. Click "Analyse starten" to begin the analysis

6. Book the cheapest possible ticket!

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/kiliankoe/bahn.deals.git
   cd bahn.deals
   ```

2. Open Firefox and navigate to `about:debugging`

3. Click "This Firefox" in the left sidebar

4. Click "Load Temporary Add-on"

5. Navigate to the `extension` folder and select `manifest.json`

The extension is now loaded and ready to use!

## How It Works

The extension uses Deutsche Bahn's internal APIs (via the vendored `db-vendo-client`) to:

1. **Extract Journey Details**: Captures your selected journey including all trains and stops
2. **Generate Segments**: Creates all possible origin-destination pairs along your route
3. **Price Segments**: Queries prices for each segment, ensuring they use the same trains
4. **Optimize**: Uses dynamic programming to find the cheapest combination covering your full journey
5. **Present Results**: Shows the optimal split with clear savings information

## Privacy

- All API calls are made directly from your browser to Deutsche Bahn servers
- No data is sent to third-party servers
- No personal information is stored beyond your configured preferences
- The extension only activates on bahn.de pages

## Known Limitations

- Currently Firefox-only (Chrome support planned)
- Only works with direct Deutsche Bahn tickets (not international or special offers)
- Cannot book tickets directly - provides information for manual booking
- Rate limits may cause slower analysis for very long routes

### Development Setup

1. Make changes to files in the `extension/` directory
2. Reload the extension in `about:debugging`
3. Test on bahn.de

## Disclaimer

This is an unofficial tool and is not affiliated with Deutsche Bahn. Use at your own discretion. Always verify prices on bahn.de before purchasing tickets.
