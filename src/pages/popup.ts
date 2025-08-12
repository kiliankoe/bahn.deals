import browser from 'webextension-polyfill';

document.addEventListener('DOMContentLoaded', async () => {
  const actions = document.getElementById('actions');
  if (!actions) return;
  const btn = document.createElement('button');
  btn.textContent = 'Analyse-Seite öffnen';
  btn.addEventListener('click', async () => {
    const url = browser.runtime.getURL('src/pages/analysis.html');
    await browser.tabs.create({ url });
  });
  actions.appendChild(btn);
});

