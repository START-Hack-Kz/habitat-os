import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found.");
}

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Frontend starter</p>
      <h1>Habitat OS</h1>
      <p class="lede">
        The project now has a working browser entrypoint, a root <code>src/</code>
        folder, and a dev server you can build on.
      </p>
      <div class="actions">
        <a class="button primary" href="https://docs.amplify.aws/" target="_blank" rel="noreferrer">
          Amplify docs
        </a>
        <button class="button secondary" id="status-button" type="button">
          Check status
        </button>
      </div>
      <p class="status" id="status-text">Frontend is mounted and ready.</p>
    </section>
  </main>
`;

const statusButton = document.querySelector<HTMLButtonElement>("#status-button");
const statusText = document.querySelector<HTMLParagraphElement>("#status-text");

statusButton?.addEventListener("click", () => {
  if (statusText) {
    statusText.textContent = `UI is alive at ${new Date().toLocaleTimeString()}.`;
  }
});
