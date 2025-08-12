import browser from 'webextension-polyfill';

export class OptionsForm {
  private elements = {
    classSelect: document.getElementById('class-select') as HTMLSelectElement | null,
    ageInput: document.getElementById('age-input') as HTMLInputElement | null,
    bahncardSelect: document.getElementById('bahncard-select') as HTMLSelectElement | null,
    dticketCheck: document.getElementById('dticket-check') as HTMLInputElement | null,
  };

  async init() {
    await this.loadOptions();
    this.setupEventListeners();
  }

  private async loadOptions() {
    try {
      const res = await browser.runtime.sendMessage({ type: 'get-options' });
      if (res?.options) this.setValues(res.options);
    } catch {}
  }

  private async saveOptions() {
    const options = this.getValues();
    try {
      await browser.runtime.sendMessage({ type: 'set-options', options });
    } catch {}
  }

  private setupEventListeners() {
    Object.values(this.elements).forEach((el) => el?.addEventListener('change', this.saveOptions.bind(this)));
  }

  getValues() {
    return {
      class: this.elements.classSelect?.value || '2',
      age: parseInt(this.elements.ageInput?.value || '30', 10),
      bahncard: this.elements.bahncardSelect?.value || 'none',
      dticket: this.elements.dticketCheck?.checked || false,
    };
  }

  private setValues(options: any) {
    if (this.elements.classSelect) this.elements.classSelect.value = options.class || '2';
    if (this.elements.ageInput) this.elements.ageInput.value = options.age || 30;
    if (this.elements.bahncardSelect) this.elements.bahncardSelect.value = options.bahncard || 'none';
    if (this.elements.dticketCheck) this.elements.dticketCheck.checked = options.dticket || false;
  }
}

