import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Home.module.css";

export default function HowItWorks() {
  const { t } = useTranslation();

  // Try to read structured steps; fallback to default texts
  const steps = t("howSteps", { returnObjects: true });
  const hasSteps = Array.isArray(steps) && steps.length === 3;

  return (
    <section className={styles.howSection}>
      <h3 className={styles.howTitle}>{t("howTitle", "Как сорвать джекпот за 3 шага?")}</h3>

      <div className={styles.howCards}>
        {(hasSteps ? steps : [
          { title: t("howSteps.0.title", "Подключи кошелек и внеси в пул 30POL"), text: t("howSteps.0.text", "Твои 30POL...") },
          { title: t("howSteps.1.title", "Жди своего звездного часа"), text: t("howSteps.1.text", "Пул растет...") },
          { title: t("howSteps.2.title", "Победа!"), text: t("howSteps.2.text", "Chainlink VRF...") }
        ]).map((s, i) => (
          <div className={styles.howCard} key={i}>
            <div className={styles.howNumber}>{i+1}</div>
            <div className={styles.howCardTitle}>{s.title}</div>
            <div className={styles.howText}>{s.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
