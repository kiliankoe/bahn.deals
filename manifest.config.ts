import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'bahn.deals',
  version: '0.2.0',
  description: 'Find cheaper split-ticket combinations for DB journeys.',
  action: {
    default_title: 'bahn.deals',
    default_popup: 'src/pages/popup.html',
  },
  background: {
    service_worker: 'src/background/main.ts'
  },
  permissions: [
    'storage',
    'scripting',
    'tabs',
    'alarms'
  ],
  host_permissions: [
    'https://www.bahn.de/*',
    'https://app.vendo.noncd.db.de/*',
    'https://tiles.openfreemap.org/*',
    'https://tile.openstreetmap.org/*'
  ],
  content_scripts: [
    {
      matches: ['https://www.bahn.de/buchung/fahrplan/suche*'],
      js: ['src/content/overview-menu.ts'],
      run_at: 'document_idle'
    }
  ],
  web_accessible_resources: [
    {
      resources: [],
      matches: ['<all_urls>']
    }
  ],
});
