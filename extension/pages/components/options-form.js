/**
 * Component for managing user options form
 */
export class OptionsForm {
  constructor() {
    this.elements = {
      classSelect: document.getElementById("class-select"),
      ageInput: document.getElementById("age-input"),
      bahncardSelect: document.getElementById("bahncard-select"),
      dticketCheck: document.getElementById("dticket-check"),
    };

    this.EXT =
      (typeof browser !== "undefined" && browser) ||
      (typeof chrome !== "undefined" && chrome);
  }

  /**
   * Initialize options form
   */
  async init() {
    await this.loadOptions();
    this.setupEventListeners();
  }

  /**
   * Load saved options
   */
  async loadOptions() {
    try {
      const res = await this.EXT.runtime.sendMessage({ type: "get-options" });
      if (res?.options) {
        this.setValues(res.options);
      }
    } catch (e) {
      console.error("Failed to load options:", e);
    }
  }

  /**
   * Save current options
   */
  async saveOptions() {
    const options = this.getValues();
    try {
      await this.EXT.runtime.sendMessage({ type: "set-options", options });
    } catch (e) {
      console.error("Failed to save options:", e);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    Object.values(this.elements).forEach((el) => {
      if (el) {
        el.addEventListener("change", this.saveOptions.bind(this));
      }
    });
  }

  /**
   * Get current form values
   * @returns {Object} Options object
   */
  getValues() {
    return {
      class: this.elements.classSelect?.value || "2",
      age: parseInt(this.elements.ageInput?.value || "30", 10),
      bahncard: this.elements.bahncardSelect?.value || "none",
      dticket: this.elements.dticketCheck?.checked || false,
    };
  }

  /**
   * Set form values
   * @param {Object} options - Options to set
   */
  setValues(options) {
    if (this.elements.classSelect) {
      this.elements.classSelect.value = options.class || "2";
    }
    if (this.elements.ageInput) {
      this.elements.ageInput.value = options.age || 30;
    }
    if (this.elements.bahncardSelect) {
      this.elements.bahncardSelect.value = options.bahncard || "none";
    }
    if (this.elements.dticketCheck) {
      this.elements.dticketCheck.checked = options.dticket || false;
    }
  }
}
