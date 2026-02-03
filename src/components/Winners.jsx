import React from "react";
import styles from "../styles/Home.module.css";

const abbr = (addr = "") => (addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "");

export default function Winners({ winners = [] }) {
  return (
    <section className={styles.sideCard}>
      <div className={styles.sideTitle}>Winners 👑</div>
      <div className={styles.sideSubtitle}>(join to see yourself here)</div>

      <div className={styles.winnersList}>
        {winners.length === 0 ? (
          <div className={styles.emptyBox}>— no winners yet —</div>
        ) : (
          winners.slice(0, 15).map((w, i) => (
            <div key={i} className={styles.winnerRow}>
              <span className={styles.winnerAddr}>{abbr(w.address)}</span>
              <span className={styles.winnerRound}>#{w.round}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
