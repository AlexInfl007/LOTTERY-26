import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

import contractService from './utils/contractService';
import styles from "./styles/Home.module.css";

export default function App() {
  const { t } = useTranslation();

  const [poolAmount, setPoolAmount] = useState(300.0);
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(12);
  const [myTickets, setMyTickets] = useState(2);
  const [feed, setFeed] = useState([]);

  // Подписка на события смарт-контракта для обновления ленты
  useEffect(() => {
    // Временно оставляем демо-ленту, пока не настроим прослушивание событий
    const interval = setInterval(() => {
      const sample = [
        `0xA8b… ${t("events.deposited", "внес 30POL в пул")}`,
        `0xF7c… ${t("events.deposited", "внес 30POL в пул")}`,
        `0xD4e… ${t("events.bought", "купил 3 билета")}`,
        `0xB2a… ${t("events.depositedLarge", "внес 90POL в пул")}`
      ];
      setFeed(prev => [sample[Math.floor(Math.random()*sample.length)], ...prev].slice(0,15));
    }, 5000); // Обновляем каждые 5 секунд
    return () => clearInterval(interval);
  }, [t]);

  const handleParticipate = async () => {
    if (!walletConnected || !userAddress) {
      alert(t("connectWalletFirst", "Пожалуйста, подключите кошелек сначала"));
      return;
    }
    
    try {
      // Получаем провайдера и signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Вызываем функцию покупки билета в смарт-контракте
      await contractService.buyTicket(userAddress, signer);
      
      // После успешной покупки обновляем данные
      fetchContractData();
      updateUserTickets(userAddress);
      
      // Добавляем событие в фид
      setFeed(prev => [`You ${t("events.depositedShort", "внес 30POL")}`, ...prev].slice(0,15));
    } catch (error) {
      console.error('Error buying ticket:', error);
      alert(t("transactionFailed", "Ошибка транзакции: ") + error.message);
    }
  };

  return (
    <div className={styles.pageWrap}>
      <header className={styles.header}>
        <div className={styles.containerHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.logoBox}>S</div>
            <div className={styles.titleBlock}>
              <div className={styles.projectTitle}>Seren Lottery Chain</div>
              <div className={styles.subtitle}>{t("subtitle", "Verifiable Randomness — Fair Wins")}</div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <LanguageSelector />
            <WalletConnect onConnect={handleWalletConnect} />
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.leftColumn}>
          <section className={styles.jackpotSection}>
            <div className={styles.jackpotHeaderRow}>
              <div>
                <div className={styles.jackpotTitle}>
                  <span className={styles.jackpotIcon}>💰</span>
                  {t("currentJackpot", "Текущий джекпот")}
                </div>
                <div className={styles.roundLabel}>Round: {roundId}</div>
              </div>
              <div className={styles.subHeaderRow}>{t("ticketsBought", "билетов куплено")}: {ticketsBought}</div>
            </div>

            <PoolProgressBar current={poolAmount} goal={poolTarget} />

            <div className={styles.description}>
              <div className={styles.boldLine}>{t("collectingTo", "Собираем пул до")} {poolTarget.toLocaleString()} POL!</div>
              <div className={styles.mutedLine}>{t("eachTicketIncreases", "Каждый билет увеличивает джекпот.")}</div>
            </div>

            <div className={styles.actionRow}>
              <button 
                onClick={handleParticipate} 
                className={styles.participateButton}
                disabled={!walletConnected}
              >
                🎫 {t("participate", "Участвовать — 30 POL")}
              </button>

              <LuckyButton />
            </div>

            <div className={styles.ticketsInfo}>{t("myTickets", "Мои билеты")}: {myTickets}</div>
          </section>

          <HowItWorks />
        </div>

        <div className={styles.rightColumn}>
          <Winners winners={[]} />

          <div className={styles.sideCard}>
            <h4 className={styles.sideTitle}>📡 {t("liveFeed", "Live feed:")}</h4>
            <LiveFeed events={feed} />
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerLeft}>
            <div className={styles.smallLogo}></div>
            <span>{t("footerNote", "Provable randomness powered by Chainlink VRF")}</span>
          </div>
          <div className={styles.footerRight}>
            <span>Powered by Polygon</span>
          </div>
        </div>
        <div className={styles.contractInfo}>
          <span>Contract: </span>
          <a 
            href="https://polygonscan.com/address/0xf90169ad413429af4ae0a3b8962648d4a3289011" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            0xf90169AD413429af4AE0a3B8962648d4a3289011
          </a>
        </div>
        <div className={styles.footerBottom}>© 2025 Seren</div>
      </footer>
    </div>
  );
}
