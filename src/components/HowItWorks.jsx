import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Home.module.css";

export default function HowItWorks({ onReadMore }) {
  const { t } = useTranslation();

  const steps = t("howSteps", { returnObjects: true });
  const hasSteps = Array.isArray(steps) && steps.length === 3;

  return (
    <section className={styles.howSection}>
      <h3 className={styles.howTitle}>{t("howTitle", "Как сорвать джекпот за 3 шага?")}</h3>

      <div className={styles.howCards}>
        {[...(hasSteps ? steps : [
          { title: t("howSteps.0.title", "Подключи кошелек и внеси в пул 30POL"), text: t("howSteps.0.text", "Твои 30POL...") },
          { title: t("howSteps.1.title", "Жди своего звездного часа"), text: t("howSteps.1.text", "Пул растет...") },
          { title: t("howSteps.2.title", "Победа!"), text: t("howSteps.2.text", "Chainlink VRF...") }
        ]), {
          title: t("readMoreProject", "Read more about project"),
          text: t("readMoreProjectHint", "Open detailed description, transparency and technical architecture"),
          isLink: true
        }].map((s, i) => (
          <button
            type="button"
            onClick={s.isLink ? onReadMore : undefined}
            className={`${styles.howCard} ${s.isLink ? styles.howCardLink : ''}`}
            key={i}
          >
            {!s.isLink && <div className={styles.howNumber}>{i+1}</div>}
            <div className={styles.howCardTitle}>{s.title}</div>
            <div className={styles.howText}>{s.text}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
