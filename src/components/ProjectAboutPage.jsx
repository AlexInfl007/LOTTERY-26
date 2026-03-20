import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Home.module.css";

const CHECK_ITEMS = ["TicketBought", "WinnerRequested", "WinnerPicked"];

const shortenHex = (value) => {
  if (typeof value !== "string") return value;
  if (!value.startsWith("0x") || value.length < 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

export default function ProjectAboutPage({ onBack }) {
  const { t } = useTranslation();

  const intro = t("aboutPage.intro", { returnObjects: true });
  const threeSteps = t("aboutPage.threeSteps", { returnObjects: true });
  const fairness = t("aboutPage.fairness", { returnObjects: true });
  const faq = t("aboutPage.faq", { returnObjects: true });
  const technical = t("aboutPage.technical", { returnObjects: true });

  return (
    <main className={styles.aboutMain}>
      <section className={styles.aboutHero}>
        <button type="button" className={styles.backButton} onClick={onBack}>← {t("aboutPage.back", "Back to lottery")}</button>
        <h1>{t("aboutPage.title", "Seren Lottery — full project description")}</h1>
        {Array.isArray(intro) && intro.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.stepsTitle", "How it works: 3 simple steps")}</h2>
        {Array.isArray(threeSteps) && threeSteps.map((step, idx) => (
          <article key={idx} className={styles.aboutCard}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {Array.isArray(step.points) && (
              <ul>{step.points.map((item, i) => <li key={i}>{item}</li>)}</ul>
            )}
          </article>
        ))}
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.fairnessTitle", "Why this is fair")}</h2>
        {Array.isArray(fairness) && fairness.map((item, idx) => (
          <article key={idx} className={styles.aboutCard}>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.moneyTitle", "Where does the money go?")}</h2>
        <div className={styles.aboutTable}>
          <div><strong>{t("aboutPage.money.ticket", "You pay")}</strong><span>30 POL</span></div>
          <div><strong>{t("aboutPage.money.prize", "To winner")}</strong><span>27 POL (90%)</span></div>
          <div><strong>{t("aboutPage.money.fee", "Development + gas")}</strong><span>3 POL (10%)</span></div>
        </div>
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.technicalTitle", "Technical specification")}</h2>
        <div className={styles.aboutGrid}>
          {Array.isArray(technical) && technical.map((row, idx) => (
            <div key={idx} className={styles.specItem}>
              <strong>{row.label}</strong>
              <span className={styles.specValue} title={row.value}>{shortenHex(row.value)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.verificationTitle", "How to verify on your own")}</h2>
        <ol className={styles.aboutList}>
          <li>{t("aboutPage.verify.0", "Open Polygonscan with the contract address.")}</li>
          <li>{t("aboutPage.verify.1", "Check Read Contract values: round, ticketsCount, prizePool, open.")}</li>
          <li>{t("aboutPage.verify.2", "Open Events and inspect draw history.")}</li>
        </ol>
        <ul>
          {CHECK_ITEMS.map((eventName) => <li key={eventName}>{eventName}</li>)}
        </ul>
      </section>

      <section className={styles.aboutSection}>
        <h2>{t("aboutPage.faqTitle", "FAQ")}</h2>
        {Array.isArray(faq) && faq.map((item, idx) => (
          <article key={idx} className={styles.aboutCard}>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
