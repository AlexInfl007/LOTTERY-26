import React from "react";
import styles from "../styles/Home.module.css";

export default function LiveFeed({ events = [] }) {
  return (
    <div className={styles.feedScrollWrap}>
      {events.length === 0 ? (
        <div className={styles.emptyBox}>{/* translated text handled by parent */}</div>
      ) : (
        <div className={styles.feedInner}>
          {events.map((e, i) => (
            <div key={i} className={styles.feedRow}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
