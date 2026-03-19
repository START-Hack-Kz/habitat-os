import "./style.css";
import { renderApp } from "./app";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("App root element was not found.");
}

renderApp(appRoot);
