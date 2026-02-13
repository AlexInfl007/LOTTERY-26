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
    // Don't close immediately to allow for visual feedback
    setTimeout(() => setOpen(false), 150);
  };

  const currentLanguage = languages.find((l) => l.code === selectedLang);

  return (
    <div className={styles.langWrapper} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={styles.langButton}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={styles.flag}>{currentLanguage?.flag}</span>
        <span className={styles.langName}>{currentLanguage?.name}</span>
        <span className={`${styles.chev} ${open ? styles.rotated : ''}`}>▼</span>
      </button>

      {open && (
        <ul className={styles.langMenu} role="menu">
          {languages.map((lang) => (
            <li
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={styles.langItem}
              role="menuitem"
            >
              <span className={styles.flag}>{lang.flag}</span>
              <span className={styles.langName}>{lang.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
