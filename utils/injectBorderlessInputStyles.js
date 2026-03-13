// Inject borderless input styles at app startup (web only)
// Ensures styles are in the document before any WebTextInput with borderless renders
if (typeof document !== "undefined" && document.head) {
  const BORDERLESS_STYLE_ID = "webtextinput-borderless-style";
  if (!document.getElementById(BORDERLESS_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = BORDERLESS_STYLE_ID;
    style.textContent = `
      input.webtextinput-borderless, textarea.webtextinput-borderless,
      input[data-borderless="true"], textarea[data-borderless="true"] {
        border: none !important;
        border-width: 0 !important;
        box-shadow: none !important;
        -webkit-box-shadow: none !important;
        outline: none !important;
        background: transparent !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        appearance: none !important;
      }
      input.webtextinput-borderless:focus, textarea.webtextinput-borderless:focus,
      input.webtextinput-borderless:active, textarea.webtextinput-borderless:active,
      input[data-borderless="true"]:focus, input[data-borderless="true"]:active {
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
      }
      input.webtextinput-borderless[type=number]::-webkit-outer-spin-button,
      input.webtextinput-borderless[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0 !important;
      }
      input.webtextinput-borderless[type=number] {
        -moz-appearance: textfield !important;
      }
    `;
    document.head.appendChild(style);
  }
}
