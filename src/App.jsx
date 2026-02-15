import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

import styles from "./styles/Home.module.css";
import { readPrizePool, watchTicketEvents, buyTicket, getUserTickets, watchPrizePoolUpdates, getRecentWinners } from "./utils/ethersUtils";
import { ethers } from 'ethers';

export default function App() {
  const { t } = useTranslation();

  const [poolAmount, setPoolAmount] = useState(0); // Initialize as 0, will be updated from contract
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(0); // Initialize as 0, will be updated from contract
  const [myTickets, setMyTickets] = useState(0); // Initialize as 0, will be updated from contract
  const [feed, setFeed] = useState([]);
  const [winners, setWinners] = useState([]); // Initialize winners state
  const [walletAddress, setWalletAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize data from smart contract
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get initial pool amount from contract
        const initialPool = await readPrizePool();
        setPoolAmount(initialPool);
        
        // Get recent winners from contract
        const recentWinners = await getRecentWinners();
        setWinners(recentWinners);
        
        // Set up event listener for ticket purchases
        const unsubscribeTicket = watchTicketEvents((eventMessage) => {
          setFeed(prev => [eventMessage, ...prev].slice(0,15));
          // Also increment tickets bought counter when we receive a ticket purchase event
          setTicketsBought(t => t + 1);
        });
        
        // Set up event listener for winner selections
        const unsubscribeWinner = watchWinnerEvents && typeof watchWinnerEvents === 'function' 
          ? watchWinnerEvents((winnerData) => {
              setWinners(prev => [winnerData, ...prev].slice(0, 15));
            })
          : () => {};
        
        // Set up event listener for prize pool updates
        const poolUnsubscribe = watchPrizePoolUpdates((updatedPool) => {
          setPoolAmount(updatedPool);
        });
        
        // Cleanup subscriptions
        return () => {
          unsubscribeTicket();
          unsubscribeWinner();
          poolUnsubscribe();
        };
      } catch (error) {
        console.error("Error initializing data:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // Periodically update the prize pool to reflect new contributions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const updatedPool = await readPrizePool();
        setPoolAmount(updatedPool);
      } catch (error) {
        console.error("Error updating prize pool:", error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Update user's tickets when wallet connects
  useEffect(() => {
    const fetchUserTickets = async () => {
      if (walletAddress) {
        try {
          const userTickets = await getUserTickets(walletAddress);
          setMyTickets(userTickets);
        } catch (error) {
          console.error("Error fetching user tickets:", error);
        }
      }
    };

    fetchUserTickets();
  }, [walletAddress]);

  const handleParticipate = async () => {
    if (!signer) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      setLoading(true);
      
      // Buy ticket via smart contract
      const result = await buyTicket(signer);
      
      if (result.success) {
        // Update local state after successful transaction
        setMyTickets(t => t + 1);
        // Don't update tickets/pool immediately - wait for the blockchain event
        // The event listener will update these values when the transaction is confirmed
        setFeed(prev => [`You ${t("events.depositedShort", "внес 30POL")}`, ...prev].slice(0,15));
      } else {
        console.error("Transaction failed:", result.error);
        alert(`Transaction failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Error buying ticket:", error);
      alert(`Error buying ticket: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Callback function to pass to WalletConnect component
  const onWalletConnect = async (address, provider, signer) => {
    setWalletAddress(address);
    setSigner(signer);
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
            <WalletConnect onConnect={onWalletConnect} />
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
                <div className={styles.roundLabel}>Round: 1</div>
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
                className={`${styles.participateButton} ${loading ? styles.disabled : ''}`}
                disabled={loading}
              >
                🎫 {loading ? t("processing", "Обработка...") : t("participate", "Участвовать — 30 POL")}
              </button>

              <LuckyButton />
            </div>

            <div className={styles.ticketsInfo}>{t("myTickets", "Мои билеты")}: {myTickets}</div>
          </section>

          <HowItWorks />
        </div>

        <div className={styles.rightColumn}>
          <Winners winners={winners} />

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
