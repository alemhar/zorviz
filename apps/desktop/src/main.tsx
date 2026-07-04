import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

window.onerror = function (message, source, lineno) {
  const div = document.createElement("div");
  div.style.color = "red";
  div.style.padding = "20px";
  div.style.background = "white";
  div.style.position = "absolute";
  div.style.top = "0";
  div.style.zIndex = "9999";
  div.innerText = "Error: " + message + "\nAt: " + source + ":" + lineno;
  document.body.appendChild(div);
};

// Trap Promise rejections
window.onunhandledrejection = function (event) {
  const div = document.createElement("div");
  div.style.color = "red";
  div.style.padding = "20px";
  div.style.background = "white";
  div.style.position = "absolute";
  div.style.top = "50px";
  div.style.zIndex = "9999";
  div.innerText = "Unhandled Rejection: " + event.reason;
  document.body.appendChild(div);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
