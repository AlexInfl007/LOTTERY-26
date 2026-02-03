import React, { useState, useRef, useEffect } from "react";
import i18n from "../i18n";

const languages = [
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "ko", name: "한국어" },
];

export default function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(i18n.language || "en");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    setSelectedLang(code);
    setOpen(false);
  };

  return (
    <div className="relative text-white" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-gray-800 px-3 py-1 rounded-md hover:bg-gray-700 transition text-sm md:text-base"
      >
        🌐 {languages.find((l) => l.code === selectedLang)?.name}
      </button>

      {open && (
        <ul className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
          {languages.map((lang) => (
            <li
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`px-4 py-2 cursor-pointer hover:bg-gray-700 ${
                lang.code === selectedLang ? "bg-gray-800 font-bold" : ""
              }`}
            >
              {lang.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
