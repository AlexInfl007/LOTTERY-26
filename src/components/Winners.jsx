import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Home.module.css";

const abbr = (addr = "") => (addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "");

export default function Winners({ winners = [] }) {
  const { t } = useTranslation();

  return (
    <section className={styles.sideCard}>
      <div className={styles.sideTitle}>🏆 {t("recentWinners", "Последние победители")}</div>
      <div className={styles.sideSubtitle}>{t("winnersSubtitle", "История побед будет отображаться здесь")}</div>

      <div className={styles.winnersList}>
        {winners.length === 0 ? (
          <div className={styles.emptyBox}>{t("winnerPending", "В ожидании первого победителя")}</div>
        ) : (
          winners.slice(0, 15).map((w, i) => (
            <div key={i} className={styles.winnerRow}>
              <span className={styles.winnerAddr}>{abbr(w.address)}</span>
              <span className={styles.winnerRound}>
                {typeof w.round === "number" ? `#${w.round}` : `${Number(w.amount || 0).toFixed(2)} POL`}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
