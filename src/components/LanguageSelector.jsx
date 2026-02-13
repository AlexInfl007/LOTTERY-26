import React, { useState, useRef, useEffect } from "react";
import i18n from "../i18n";
import styles from "../styles/Home.module.css";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
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

  const currentLanguage = languages.find((l) => l.code === selectedLang);

  return (
    <div className={styles.langWrapper} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={styles.langButton}
      >
        <span>{currentLanguage?.flag}</span>
        <span>{currentLanguage?.name}</span>
        <span className={`${styles.chev} ${open ? styles.rotated : ''}`}>▼</span>
      </button>

      {open && (
        <ul className={styles.langMenu}>
          {languages.map((lang) => (
            <li
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={styles.langItem}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
