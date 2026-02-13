import React from "react";
import styles from "../styles/Home.module.css";

export default function PoolProgressBar({ current = 0, goal = 1000000 }) {
  const pct = Math.max(0, Math.min(100, Math.round((current / goal) * 10000) / 100));
  const formatted = Number(current).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${pct}%`, transition: "width 700ms ease" }}
          aria-hidden="true"
        >
          <div className={styles.progressCenterAmountInside} style={{ left: `${Math.min(pct, 95)}%` }}>
            {formatted} POL
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <div className={styles.subLeft}>{pct}%</div>
        <div className={styles.subRight}>{goal.toLocaleString()} POL</div>
      </div>
    </div>
  );
}
