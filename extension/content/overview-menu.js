const EXT = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);
const qs = (root, sel) => root.querySelector(sel);
const qsa = (root, sel) => Array.from(root.querySelectorAll(sel));

const findConnectionRoot = (el) => {
  let cur = el;
  while (cur && cur !== document.body) {
    if (cur.matches?.("li.verbindung-list__result-item, .reiseloesung")) return cur;
    cur = cur.parentElement;
  }
  return null;
};

const extractSelection = (root) => {
  const depEl = qs(root, ".reiseplan__uebersicht-uhrzeit-von time");
  const arrEl = qs(root, ".reiseplan__uebersicht-uhrzeit-nach time");
  const fromEl = qs(root, ".test-reise-beschreibung-start-value");
  const toEl = qs(root, ".test-reise-beschreibung-ziel-value");
  const lineEls = qsa(root, ".verbindungsabschnitt-visualisierung__verkehrsmittel-text");

  const url = new URL(location.href);
  const hash = url.hash && url.hash.startsWith('#') ? url.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const dateParam = hashParams.get("hd") || url.searchParams.get("hd");
  const soei = hashParams.get("soei") || url.searchParams.get("soei");
  const zoei = hashParams.get("zoei") || url.searchParams.get("zoei");

  const depTime = depEl?.getAttribute("datetime") || depEl?.textContent?.trim() || "";
  const arrTime = arrEl?.getAttribute("datetime") || arrEl?.textContent?.trim() || "";
  const lines = lineEls.map((n) => n.textContent.trim()).filter(Boolean);

  return {
    dateTimeParam: dateParam || null,
    depTime,
    arrTime,
    fromName: fromEl?.textContent?.trim() || null,
    toName: toEl?.textContent?.trim() || null,
    fromEVA: soei || null,
    toEVA: zoei || null,
    lines,
    pageUrl: location.href
  };
};

const buildMenuItem = () => {
  const lang = (document.documentElement.getAttribute('lang') || navigator.language || 'de').toLowerCase();
  const isDe = lang.startsWith('de');
  const text = isDe ? 'Günstigste Aufteilung suchen' : 'Find cheapest split';

  // Create list item - match the exact structure of native items
  const li = document.createElement('li');
  li.className = '_content-button _content-button--with-icons';
  li.setAttribute('data-bahn-deals', '1');
  li.setAttribute('role', 'none');

  // Create button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('role', 'menuitem');
  btn.className = 'db-web-button test-db-web-button db-web-button--type-link db-web-button--size-large db-web-button--type-plain _list-button';
  
  // Ensure proper padding to match native menu items
  btn.style.padding = '12px 16px';
  btn.style.width = '100%';
  btn.style.textAlign = 'left';

  // Content wrapper
  const content = document.createElement('span');
  content.className = 'db-web-button__content';

  // Icon - using a simpler percentage/discount icon
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.className = 'db-color--dbBrand db-web-icon--custom-size icon-action-shopping-tag db-web-icon db-web-button__icon db-web-button__prepend-icon test-button-prependicon db-web-button__icon--primary';
  icon.style.setProperty('--334abfb0', '1.25rem');
  icon.style.setProperty('--7c108f1c', '1.25rem');
  icon.style.setProperty('--2c5586aa', 'initial');
  
  // If the icon class doesn't work, fallback to inline SVG
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
    <line x1="7" y1="7" x2="7.01" y2="7"></line>
    <path d="M14 10l-2 2m0-2l2 2" stroke="currentColor"/>
  </svg>`;

  // Label
  const label = document.createElement('span');
  label.className = 'db-web-button__label test-button-label';
  label.textContent = text;

  // Assemble
  content.appendChild(icon);
  content.appendChild(label);
  btn.appendChild(content);
  li.appendChild(btn);

  // Add the menuslot div that native items have
  const slot = document.createElement('div');
  slot.className = '_menuslot';
  li.appendChild(slot);

  return { li, btn };
};

const injectIntoMenu = (menuRoot, connectionRoot) => {
  const ul = menuRoot.querySelector('ul[role="menu"]');
  if (!ul) return false;
  if (ul.querySelector("li[data-bahn-deals]")) return true;
  const { li, btn } = buildMenuItem();
  li.setAttribute("data-bahn-deals", "1");
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const selection = extractSelection(connectionRoot);
    try {
      await EXT.runtime.sendMessage({ type: "open-analysis", selection });
    } catch {}
  });
  ul.appendChild(li);
  return true;
};

const observeMenuOpen = (actionMenuEl, connectionRoot) => {
  const mo = new MutationObserver((mutations, obs) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches?.('ul[role="menu"], div._content, div[role="menu"]')) {
          injectIntoMenu(actionMenuEl, connectionRoot);
        }
      }
    }
  });
  mo.observe(actionMenuEl, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 5000);
};

document.addEventListener("click", (e) => {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;
  const menuButton = target.closest?.(".test-menu-button, .DBWebActionMenu .db-web-button--type-icon");
  if (!menuButton) return;
  const connectionRoot = findConnectionRoot(menuButton);
  if (!connectionRoot) return;
  const actionMenu = menuButton.closest?.(".DBWebActionMenu");
  if (!actionMenu) return;
  observeMenuOpen(actionMenu, connectionRoot);
}, true);
