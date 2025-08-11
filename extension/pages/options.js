const EXT = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);

const DEFAULTS = {
  class: '2',
  age: 30,
  bahncard: 'none',
  dticket: false,
};

async function loadOptions() {
  const stored = await EXT.storage.local.get('options');
  return { ...DEFAULTS, ...(stored.options || {}) };
}

async function saveOptions(opts) {
  await EXT.storage.local.set({ options: opts });
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('form');
  const cls = document.getElementById('class');
  const age = document.getElementById('age');
  const bc = document.getElementById('bahncard');
  const dt = document.getElementById('dticket');
  const status = document.getElementById('status');

  const opts = await loadOptions();
  cls.value = String(opts.class);
  age.value = String(opts.age ?? '');
  bc.value = String(opts.bahncard);
  dt.checked = !!opts.dticket;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = {
      class: cls.value,
      age: Number(age.value || 0),
      bahncard: bc.value,
      dticket: dt.checked,
    };
    await saveOptions(next);
    status.style.display = 'inline';
    setTimeout(() => (status.style.display = 'none'), 1500);
  });
});
