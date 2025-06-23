/** A small web component which enable us to integrate a small quiz into a webpage. */
const plunningPokerStyles = new CSSStyleSheet();
plunningPokerStyles.replaceSync(``);

class PlunningPoker extends HTMLElement {
  #ws = null;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    shadow.adoptedStyleSheets = [plunningPokerStyles];
    shadow.innerHTML = `
            <main>
            <div class="select-mode">
            <button id="clientButton">Join Quizzy</button>
            <button id="adminButton">Administrate Quizzy</button>
            </div>
            </main>`;
  }

  connectedCallback() {
    const wsURL = this.getAttribute("ws-url");

    /**
     * Joiner logic
     */

    /**
     * Admin logic
     */
  }

  disconnectedCallback() {
    console.log("PlanningPoker component disconnected");
  }
}

customElements.define("ld-planning-poker", PlunningPoker);
