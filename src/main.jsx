import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/globals.css";
import "./i18n"; // initialize i18n
import { initializePolygonProvider } from "./utils/polygonProvider";

// Инициализация провайдера Polygon при запуске приложения
initializePolygonProvider()
  .then(provider => {
    console.log("Провайдер Polygon успешно инициализирован");
  })
  .catch(error => {
    console.error("Ошибка инициализации провайдера Polygon:", error);
  });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
