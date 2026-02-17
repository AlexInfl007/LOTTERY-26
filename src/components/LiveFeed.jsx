import React from "react";
import styles from "../styles/Home.module.css";

export default function LiveFeed({ events = [] }) {
  // Filter out invalid events and take only the most recent ones
  const validEvents = events.filter(e => e && typeof e === 'string').slice(0, 15);

  return (
    <div className={styles.feedScrollWrap}>
      {validEvents.length === 0 ? (
        <div className={styles.emptyBox}>{/* translated text handled by parent */}</div>
      ) : (
        <div className={styles.feedInner}>
          {validEvents.map((e, i) => (
            <div key={`${e}-${i}`} className={styles.feedRow}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
