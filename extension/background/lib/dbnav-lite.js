// Minimal dbnav client (request builder + fetch) for MV2 background
// Note: This mirrors db-vendo-client request shapes to avoid bundling.

const DBNAV = {
  journeysEndpoint: "https://app.vendo.noncd.db.de/mob/angebote/fahrplan",
  locationsEndpoint: "https://app.vendo.noncd.db.de/mob/location/search",
  refreshJourneysEndpointTickets:
    "https://app.vendo.noncd.db.de/mob/angebote/recon",
};

const rnd = (n = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const correlationId = () => `${rnd(8)}_${rnd(8)}`;

const headers = (ctype) => ({
  "X-Correlation-ID": correlationId(),
  Accept: ctype,
  "Content-Type": ctype,
});

const formatOffset = (d) => {
  const off = -d.getTimezoneOffset(); // minutes
  const sign = off >= 0 ? "+" : "-";
  const a = Math.floor(Math.abs(off) / 60)
    .toString()
    .padStart(2, "0");
  const b = (Math.abs(off) % 60).toString().padStart(2, "0");
  return `${sign}${a}:${b}`;
};

const formatBerlinDateTime = (y, m, d, hh, mm, ss = 0) => {
  // Use system tz; acceptable for first prototype
  const dt = new Date(y, m - 1, d, hh, mm, ss);
  const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}T${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  return iso + formatOffset(dt);
};

const parseHd = (url) => {
  try {
    const u = new URL(url);
    const hash = u.hash.startsWith("#") ? u.hash.substring(1) : u.hash;
    const sp = new URLSearchParams(hash);
    const hd = sp.get("hd");
    if (!hd) return null;
    // hd example: 2025-08-25T12:00:36
    return hd;
  } catch (_) {
    return null;
  }
};

const lidFromEva = (eva) => `A=1@L=${String(eva)}@`;

async function dbnavLocations(query, maxResults = 5) {
  const body = {
    locationTypes: ["ST"],
    searchTerm: query,
    maxResults,
  };
  console.debug("[dbnav] locations body", body);
  const res = await fetch(DBNAV.locationsEndpoint, {
    method: "POST",
    headers: headers("application/x.db.vendo.mob.location.v3+json"),
    body: JSON.stringify(body),
    credentials: "omit",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[dbnav] locations failed", res.status, txt.slice(0, 500));
    throw new Error(`locations failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function dbnavRefreshTickets({ refreshToken, opts }) {
  const base = buildTravellers(opts || {});
  const body = {
    autonomeReservierung: false,
    einstiegsTypList: ["STANDARD"],
    ...base,
    reservierungsKontingenteVorhanden: false,
    verbindungHin: { kontext: refreshToken },
  };
  try {
    console.debug("[dbnav] recon body", JSON.stringify(body).slice(0, 500));
  } catch {
    console.debug("[dbnav] recon body (object)", body);
  }
  const res = await fetch(DBNAV.refreshJourneysEndpointTickets, {
    method: "POST",
    headers: headers("application/x.db.vendo.mob.verbindungssuche.v8+json"),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[dbnav] recon failed", res.status, txt.slice(0, 500));
    throw new Error(`recon failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return json;
}

function buildTravellers(opts) {
  const firstClass = String(opts.class) === "1";
  const age = Number(opts.age || NaN);
  const klasse = firstClass ? "KLASSE_1" : "KLASSE_2";
  // crude age group mapping
  let reisendenTyp = "ERWACHSENER";
  if (age < 6) reisendenTyp = "KLEINKIND";
  else if (age < 15) reisendenTyp = "FAMILIENKIND";
  else if (age < 27) reisendenTyp = "JUGENDLICHER";
  else if (age >= 65) reisendenTyp = "SENIOR";
  const bc = String(opts.bahncard || "none");
  const disc =
    bc === "bc25"
      ? "BAHNCARD25"
      : bc === "bc50"
        ? "BAHNCARD50"
        : "KEINE_ERMAESSIGUNG";
  const ermaess = `${disc} ${disc.startsWith("BAHN") ? klasse : "KLASSENLOS"}`;
  const tvlr = {
    klasse,
    reisendenProfil: {
      reisende: [
        {
          ermaessigungen: [ermaess],
          reisendenTyp,
          // omit age for now; server accepts inferred age groups
          // alter: isNaN(age) ? undefined : age,
        },
      ],
    },
  };
  return tvlr;
}

async function dbnavJourneys({ fromEva, toEva, depDateTime, opts }) {
  const base = buildTravellers(opts || {});
  const body = {
    autonomeReservierung: false,
    einstiegsTypList: ["STANDARD"],
    // fahrverguenstigungen set below only if needed
    ...base,
    reservierungsKontingenteVorhanden: false,
    reiseHin: {
      wunsch: {
        abgangsLocationId: lidFromEva(fromEva),
        verkehrsmittel: ["ALL"],
        zeitWunsch: {
          reiseDatum: depDateTime,
          zeitPunktArt: "ABFAHRT",
        },
        zielLocationId: lidFromEva(toEva),
        fahrradmitnahme: false,
      },
    },
  };
  // Note: omit fahrverguenstigungen for now; enabling DT flag here triggers validation errors on some routes.
  try {
    console.debug("[dbnav] journeys body", JSON.stringify(body));
  } catch {
    console.debug("[dbnav] journeys body (object)", body);
  }
  const res = await fetch(DBNAV.journeysEndpoint, {
    method: "POST",
    headers: headers("application/x.db.vendo.mob.verbindungssuche.v8+json"),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[dbnav] journeys failed", res.status, txt.slice(0, 500));
    throw new Error(`journeys failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// Export to background
self.DBNavLite = {
  parseHd,
  formatBerlinDateTime,
  dbnavLocations,
  dbnavJourneys,
  dbnavRefreshTickets,
};

