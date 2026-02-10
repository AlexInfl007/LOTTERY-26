import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Home.module.css";

export default function LuckyButton() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";

  const sessionShownKey = `seren_lucky_shown_${lang}`;
  const sessionTipKey = `seren_lucky_tip_${lang}`;

  const [hasShown, setHasShown] = useState(() => {
    try { return sessionStorage.getItem(sessionShownKey) === "1"; } catch { return false; }
  });
  const [tip, setTip] = useState(() => {
    try { return sessionStorage.getItem(sessionTipKey) || ""; } catch { return ""; }
  });
  const [modalOpen, setModalOpen] = useState(false);

  // get phrases (array) from i18n
  const phrasesFromI18n = t("luckyPhrases", { returnObjects: true });
  const phrases = Array.isArray(phrasesFromI18n) && phrasesFromI18n.length ? phrasesFromI18n : [];

  // update local state when language changes
  useEffect(() => {
    try {
      const s = sessionStorage.getItem(sessionShownKey) === "1";
      const st = sessionStorage.getItem(sessionTipKey) || "";
      setHasShown(!!s);
      setTip(st);
    } catch {
      setHasShown(false);
      setTip("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleClick = () => {
    // If no tip yet for this language, pick one randomly and store it — but in any case open modal
    if (!hasShown) {
      const pick = (phrases.length ? phrases : [
        t("luckyFallback", "Удача улыбается смелым!")
      ])[Math.floor(Math.random() * (phrases.length || 1))];
      try {
        sessionStorage.setItem(sessionTipKey, pick);
        sessionStorage.setItem(sessionShownKey, "1");
      } catch {}
      setTip(pick);
      setHasShown(true);
      setModalOpen(true);
      return;
    }
    // already have tip for this language — just show modal (same tip)
    setModalOpen(true);
  };

  return (
    <>
      <button className={styles.luckyButton + " transform hover:scale-105 transition"} onClick={handleClick}>
        🎲 {t("feelingLucky", "Мне повезёт!")}
      </button>

      {modalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-gray-800 p-6 rounded-xl max-w-md w-full mx-4 border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: '1.2em', marginBottom: 8, color: 'white' }}>{t("luckyTipTitle", "Совет удачи")}</div>
            <div style={{ color: "#ccc", marginBottom: 16 }}>{tip || t("luckyFallback", "Удача улыбается смелым!")}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button 
                className="bg-gradient-to-r from-[#A855F7] to-[#F472B6] px-6 py-2 rounded-lg font-medium"
                onClick={() => setModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
