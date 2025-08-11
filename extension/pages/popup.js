const EXT = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome);

document.addEventListener('DOMContentLoaded', async () => {
  const actions = document.getElementById('actions');
  const btn = document.createElement('button');
  btn.textContent = 'Analyse-Seite öffnen';
  btn.addEventListener('click', async () => {
    const url = EXT.runtime.getURL('pages/analysis.html');
    await EXT.tabs.create({ url });
  });
  actions.appendChild(btn);
});
