import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/globals.css";
import "./i18n"; // initialize i18n
import Web3Modal from './components/Web3Modal.jsx'

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Web3Modal>
      <App />
    </Web3Modal>
  </React.StrictMode>
);
