import React from "react";
import styles from "../styles/Home.module.css";

const abbr = (addr = "") => (addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "");

export default function Winners({ winners = [] }) {
  // Filter out invalid winner entries and sort by round (most recent first)
  const validWinners = winners
    .filter(w => w && w.address && w.round !== undefined && w.round !== null)
    .sort((a, b) => b.round - a.round)
    .slice(0, 15);

  return (
    <section className={styles.sideCard}>
      <div className={styles.sideTitle}>Winners 👑</div>
      <div className={styles.sideSubtitle}>(join to see yourself here)</div>

      <div className={styles.winnersList}>
        {validWinners.length === 0 ? (
          <div className={styles.emptyBox}>— no winners yet —</div>
        ) : (
          validWinners.map((w, i) => (
            <div key={`${w.address}-${w.round}-${i}`} className={styles.winnerRow}>
              <span className={styles.winnerAddr}>{abbr(w.address)}</span>
              <span className={styles.winnerRound}>#{w.round}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
