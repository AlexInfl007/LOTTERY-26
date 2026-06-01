import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import ProjectAboutPage from "./components/ProjectAboutPage";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

import styles from "./styles/Home.module.css";
import { updateSeo } from "./seo";
import { 
  readPrizePool, 
  buyTicket, 
  getUserTickets, 
  getTicketsCount, 
  getRecentTicketEvents,
  getCurrentRound
} from "./utils/ethersUtils";

export default function App() {
  const { t, i18n } = useTranslation();
  const [isAboutPage, setIsAboutPage] = useState(() => window.location.hash === "#/about");

  const [poolAmount, setPoolAmount] = useState(null);
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [myTickets, setMyTickets] = useState(null);
  const [feed, setFeed] = useState([]);
  const [feedError, setFeedError] = useState("");
  const [winners, setWinners] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(true);
  const MAX_FEED_ITEMS = 15;

  const formatFeedFromEvents = (events = []) => {
    return events.map((eventItem) => {
      const timestamp = eventItem?.timestamp ? new Date(eventItem.timestamp).toLocaleTimeString() : "";
      const shortAddress = formatShortAddress(eventItem?.buyer);
      const roundLabel = Number.isFinite(eventItem?.round) ? `Round ${eventItem.round}` : "Round ?";

      return `${t('events.ticketPurchased', 'New ticket purchased')} (30 POL) • ${shortAddress} • ${roundLabel} • ${timestamp}`;
    });
  };

  const formatShortAddress = (address) => {
    if (!address || address.length < 10) return address || "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Load lottery data ONLY when wallet is connected
  const refreshLotteryData = async (address) => {
    if (!address) return;

    const updatedPool = await readPrizePool();
    if (typeof updatedPool === 'number') {
      setPoolAmount(updatedPool);
    }

    const updatedRound = await getCurrentRound();
    if (typeof updatedRound === 'number') {
      setCurrentRound(updatedRound);
    }

    const updatedTicketsCount = await getTicketsCount();
    if (typeof updatedTicketsCount === 'number' && updatedTicketsCount >= 0) {
      setTicketsBought(updatedTicketsCount);
    } else if (typeof updatedPool === "number" && updatedPool > 0) {
      const poolDerivedTickets = Math.floor(updatedPool / 30);
      if (poolDerivedTickets > 0) {
        setTicketsBought(poolDerivedTickets);
      }
    }

    const updatedUserTickets = await getUserTickets(address);
    if (typeof updatedUserTickets === 'number') {
      setMyTickets(updatedUserTickets);
    }
  };

  // Load live feed events ONLY when wallet is connected
  const seedFeedFromChain = async () => {
    const recentEvents = await getRecentTicketEvents(MAX_FEED_ITEMS);
    
    if (recentEvents && recentEvents.length > 0) {
      const formattedRecentFeed = formatFeedFromEvents(recentEvents);
      setFeedError("");
      setFeed(formattedRecentFeed);
      return true;
    }

    setFeedError(t('liveFeedNoPurchases', 'Нет покупок'));
    return false;
  };

  useEffect(() => {
    const onHashChange = () => setIsAboutPage(window.location.hash === "#/about");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openAboutPage = () => {
    window.location.hash = "/about";
  };

  const openHomePage = () => {
    window.location.hash = "";
  };

  useEffect(() => {
    const isAbout = isAboutPage;
    const pageTitle = isAbout
      ? t("seo.aboutTitle", "Seren Lottery Chain — How the on-chain lottery works")
      : t("seo.homeTitle", "Seren Lottery Chain — On-chain Polygon lottery with verifiable randomness");
    const pageDescription = isAbout
      ? t("seo.aboutDescription", "Learn how Seren Lottery Chain works, how winners are selected, and how the Polygon smart contract can be verified publicly.")
      : t("seo.homeDescription", "Seren Lottery Chain is a transparent on-chain Polygon lottery with Chainlink VRF, public smart-contract verification, and a live jackpot interface.");

    document.documentElement.lang = i18n.language || "en";
    updateSeo({
      title: pageTitle,
      description: pageDescription,
      path: "/",
    });
  }, [isAboutPage, t, i18n.language]);

  // Load contract data ONLY when wallet is connected (walletAddress changes)
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      // Skip if no wallet connected
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      try {
        if (!mounted) return;

        // Load lottery data for the connected wallet
        await refreshLotteryData(walletAddress);

        // Load live feed events
        await seedFeedFromChain();
      } catch (error) {
        console.error("Error initializing lottery data:", error);
        setFeedError(error?.message || t('liveFeedNoPurchases', 'Нет покупок'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeData();

    return () => {
      mounted = false;
    };
  }, [walletAddress, t]);


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
        await refreshLotteryData(walletAddress);
        seedFeedFromChain().catch(() => {});
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
  const onWalletConnect = async (address, web3Provider, signer) => {
    setWalletAddress(address);
    setSigner(signer);
  };

  // Handle wallet disconnect
  const onWalletDisconnect = () => {
    setWalletAddress(null);
    setSigner(null);
    setPoolAmount(null);
    setTicketsBought(null);
    setMyTickets(null);
    setFeed([]);
    setFeedError("");
  };

  return (
    <div className={styles.pageWrap}>
      <header className={styles.header}>
        <div className={styles.containerHeader}>
          <div className={styles.headerLeft}>
            <img src="/images/logo.png" alt="Seren Logo" className={styles.logoImage} />
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

      {isAboutPage ? (
        <ProjectAboutPage onBack={openHomePage} />
      ) : (
        <main className={styles.main}>
          <section className={styles.heroIntro} aria-label="Project overview">
            <p className={styles.heroEyebrow}>Polygon • Chainlink VRF • On-chain transparency</p>
            <h1 className={styles.heroTitle}>Seren Lottery Chain</h1>
            <p className={styles.heroText}>
              {t(
                "seo.heroText",
                "Seren Lottery Chain — это прозрачная крипто-лотерея в сети Polygon, которая работает на собственном смарт контракте, где пользователь может подключить кошелек, внести монеты в общий пул, следить за джекпотом, изучить смарт-контракт и убедиться, что выбор победителя работает через Chainlink VRF."
              )}
            </p>
            <p className={styles.heroTextSecondary}>
              {t(
                "seo.heroTextSecondary",
                "Главная цель — честный шанс выиграть в игре где все права равны. Риск потери средств — часть игры, но именно он делает победу по-настоящему ценной."
              )}
            </p>
          </section>

          <div className={styles.contentGrid}>
            <div className={styles.leftColumn}>
              <section className={styles.jackpotSection}>
                <div className={styles.jackpotHeaderRow}>
                  <div>
                    <div className={styles.jackpotTitle}>
                      <span className={styles.jackpotIcon}>💰</span>
                      {t("currentJackpot", "Текущий джекпот")}
                    </div>
                    <div className={styles.roundLabel}>Round: {currentRound !== null ? currentRound : "*"}</div>
                  </div>
                  <div className={styles.subHeaderRow}>{t("ticketsBought", "Всего билетов")}: {ticketsBought !== null ? ticketsBought : '*'}</div>
                </div>

                {poolAmount !== null ? (
                  <>
                    <PoolProgressBar current={poolAmount} goal={poolTarget} />

                    <div className={styles.description}>
                      <div className={styles.boldLine}>{t("collectingTo", "Собираем пул до")} {poolTarget.toLocaleString()} POL!</div>
                      <div className={styles.mutedLine}>{t("eachTicketIncreases", "Каждый билет увеличивает джекпот.")}</div>
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholderContainer}>
                    <div className={styles.placeholderText}>Please connect wallet to view lottery data</div>
                  </div>
                )}

                {!walletAddress && (
                  <div className={styles.walletNotConnectedMessage}>
                    <p className={styles.connectPrompt}>Please connect your wallet to participate and view lottery data</p>
                  </div>
                )}

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

                <div className={styles.ticketsInfo}>{t("myTickets", "Мои билеты")}: {walletAddress && myTickets !== null ? myTickets : '*'}</div>
              </section>

              <HowItWorks onReadMore={openAboutPage} />
            </div>

            <div className={styles.rightColumn}>
              <Winners winners={Array.isArray(winners) ? winners : []} />

              <div className={styles.sideCard}>
                <h4 className={styles.sideTitle}>📡 {t("liveFeed", "Live feed:")}</h4>
                {feed.length > 0 ? <LiveFeed events={feed} /> : <div className={styles.placeholderText}>{feedError || t("liveFeedWaiting", "No purchase activity yet — live updates will appear here.")}</div>}
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerLeft}>
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
