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
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("luckyTipTitle", "Совет удачи")}</div>
            <div style={{ color: "var(--txt-muted)" }}>{tip || t("luckyFallback", "Удача улыбается смелым!")}</div>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
              <button className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
