// Thin adapter for DB Vendo/Movas API calls for MV3 service worker.
// Intended to be replaced or backed by `db-vendo-client` if it exposes
// browser-compatible entry points. For now, we implement minimal calls
// using fetch and match the request/response shapes used by services.

export const DBNAV = {
  journeysEndpoint: 'https://app.vendo.noncd.db.de/mob/angebote/fahrplan',
  locationsEndpoint: 'https://app.vendo.noncd.db.de/mob/location/search',
  refreshJourneysEndpointTickets: 'https://app.vendo.noncd.db.de/mob/angebote/recon',
};

const rnd = (n = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const correlationId = () => `${rnd(8)}_${rnd(8)}`;

const headers = (ctype: string) => ({
  'X-Correlation-ID': correlationId(),
  Accept: ctype,
  'Content-Type': ctype,
});

const formatOffset = (d: Date) => {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.floor(Math.abs(off) / 60)
    .toString()
    .padStart(2, '0');
  const b = (Math.abs(off) % 60).toString().padStart(2, '0');
  return `${sign}${a}:${b}`;
};

export const formatBerlinDateTime = (y: number, m: number, d: number, hh: number, mm: number, ss = 0) => {
  const dt = new Date(y, m - 1, d, hh, mm, ss);
  const iso = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}T${hh
    .toString()
    .padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  return iso + formatOffset(dt);
};

export const parseHd = (url: string | null | undefined) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const hash = u.hash.startsWith('#') ? u.hash.substring(1) : u.hash;
    const sp = new URLSearchParams(hash);
    const hd = sp.get('hd');
    return hd || null;
  } catch {
    return null;
  }
};

const lidFromEva = (eva: string | number) => `A=1@L=${String(eva)}@`;

export async function dbnavLocations(query: string, maxResults = 5) {
  const body = {
    locationTypes: ['ST'],
    searchTerm: query,
    maxResults,
  };
  console.log('Searching locations for:', query);
  const res = await fetch(DBNAV.locationsEndpoint, {
    method: 'POST',
    headers: headers('application/x.db.vendo.mob.location.v3+json'),
    body: JSON.stringify(body),
    credentials: 'omit',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`locations failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log('Locations response:', data);
  return data;
}

function buildTravellers(opts: { class?: string; age?: number; bahncard?: string }) {
  const firstClass = String(opts.class) === '1';
  const age = Number(opts.age || NaN);
  const klasse = firstClass ? 'KLASSE_1' : 'KLASSE_2';
  let reisendenTyp = 'ERWACHSENER';
  if (age < 6) reisendenTyp = 'KLEINKIND';
  else if (age < 15) reisendenTyp = 'FAMILIENKIND';
  else if (age < 27) reisendenTyp = 'JUGENDLICHER';
  else if (age >= 65) reisendenTyp = 'SENIOR';
  const bc = String(opts.bahncard || 'none');
  const disc = bc === 'bc25' ? 'BAHNCARD25' : bc === 'bc50' ? 'BAHNCARD50' : 'KEINE_ERMAESSIGUNG';
  const ermaess = `${disc} ${disc.startsWith('BAHN') ? klasse : 'KLASSENLOS'}`;
  return {
    klasse,
    reisendenProfil: {
      reisende: [
        {
          ermaessigungen: [ermaess],
          reisendenTyp,
        },
      ],
    },
  };
}

export async function dbnavJourneys({
  fromEva,
  toEva,
  depDateTime,
  opts,
}: {
  fromEva: string;
  toEva: string;
  depDateTime: string;
  opts: { class?: string; age?: number; bahncard?: string };
}) {
  const base = buildTravellers(opts || {});
  const body = {
    autonomeReservierung: false,
    einstiegsTypList: ['STANDARD'],
    ...base,
    reservierungsKontingenteVorhanden: false,
    reiseHin: {
      wunsch: {
        abgangsLocationId: lidFromEva(fromEva),
        verkehrsmittel: ['ALL'],
        zeitWunsch: { reiseDatum: depDateTime, zeitPunktArt: 'ABFAHRT' },
        zielLocationId: lidFromEva(toEva),
        fahrradmitnahme: false,
      },
    },
  };
  const res = await fetch(DBNAV.journeysEndpoint, {
    method: 'POST',
    headers: headers('application/x.db.vendo.mob.verbindungssuche.v8+json'),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`journeys failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function dbnavRefreshTickets({
  refreshToken,
  opts,
}: {
  refreshToken: string;
  opts: { class?: string; age?: number; bahncard?: string };
}) {
  const base = buildTravellers(opts || {});
  const body = {
    autonomeReservierung: false,
    einstiegsTypList: ['STANDARD'],
    ...base,
    reservierungsKontingenteVorhanden: false,
    verbindungHin: { kontext: refreshToken },
  };
  console.log('Refreshing ticket with token:', refreshToken);
  const res = await fetch(DBNAV.refreshJourneysEndpointTickets, {
    method: 'POST',
    headers: headers('application/x.db.vendo.mob.verbindungssuche.v8+json'),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`recon failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log('Refresh response sections:', data?.verbindung?.verbindungsAbschnitte?.length);
  return data;
}
