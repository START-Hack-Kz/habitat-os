import "./style.css";
import { renderApp } from "./app";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root element was not found.");
}

renderApp(app);
