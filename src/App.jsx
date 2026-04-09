import React, { useEffect, useRef, useState } from "react";
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
import { readPrizePool, watchTicketEvents, buyTicket, getUserTickets, getRecentWinners, watchWinnerEvents, updateProvider, updateContractInstance, getTicketsCount, getCurrentProvider, getRecentTicketPurchases } from "./utils/ethersUtils";

export default function App() {
  const { t, i18n } = useTranslation();
  const [isAboutPage, setIsAboutPage] = useState(() => window.location.hash === "#/about");

  const [poolAmount, setPoolAmount] = useState(null); // Initialize as null, will be updated from contract when wallet is connected
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(null); // Initialize as null, will be updated from contract when wallet is connected
  const [myTickets, setMyTickets] = useState(0); // Initialize as 0, will be updated from contract when wallet is connected
  const [feed, setFeed] = useState([]);
  const [winners, setWinners] = useState(null); // Initialize winners state as null when wallet is not connected
  const [walletAddress, setWalletAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeTicketRef = useRef(() => {});
  const unsubscribeWinnerRef = useRef(() => {});
  const lastObservedTicketsRef = useRef(null);
  const formatShortAddress = (address) => {
    if (!address || address.length < 10) return address || "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  // Initialize data from smart contract when wallet is connected
  useEffect(() => {
    let mounted = true;
    
    const initializeData = async () => {
      // Check if wallet is connected
      const currentProvider = await getCurrentProvider();
      if (!currentProvider) {
        if (mounted) {
          setPoolAmount(null);
          setTicketsBought(null);
          setWinners(null);
          setMyTickets(0);
          setFeed([]);
          lastObservedTicketsRef.current = null;
          setLoading(false);
        }
        return;
      }
      
      try {
        // Wait for contract initialization (max 10 seconds with retries)
        let attempts = 0;
        let contractInitialized = false;
        while (attempts < 20 && !contractInitialized) {
          try {
            await readPrizePool();
            contractInitialized = true; // Mark as initialized if no error thrown
          } catch (error) {
            if (error.message && !error.message.includes('Contract not initialized') && 
                !error.message.includes('No provider available') && 
                !error.message.includes('No valid provider')) {
              // If it's a different error, rethrow it
              throw error;
            }
            await new Promise(resolve => {
              const channel = new MessageChannel();
              channel.port1.onmessage = () => resolve();
              channel.port2.postMessage('');
              channel.port1.close();
              channel.port2.close();
            });
            attempts++;
          }
        }
        
        if (!contractInitialized) {
          console.error("Contract failed to initialize after multiple attempts");
          throw new Error("Contract failed to initialize");
        }
        
        if (!mounted) return;
        
        // Get initial pool amount from contract
        const initialPool = await readPrizePool();
        setPoolAmount(initialPool);
        
        // Get initial tickets count from contract
        const initialTicketsCount = await getTicketsCount();
        setTicketsBought(initialTicketsCount);
        lastObservedTicketsRef.current = typeof initialTicketsCount === 'number' ? initialTicketsCount : 0;

        let formattedRecentFeed = [];
        try {
          const recentPurchases = await getRecentTicketPurchases(15, 5000);
          formattedRecentFeed = recentPurchases.map((purchase) => {
            const timestamp = new Date(purchase.timestamp).toLocaleTimeString();
            const shortAddress = formatShortAddress(purchase.from);
            return `${t('events.ticketPurchased', 'New ticket purchased')} • ${shortAddress} • ${timestamp}`;
          });
        } catch (feedError) {
          console.warn("Unable to preload ticket feed:", feedError);
        }

        if (formattedRecentFeed.length > 0) {
          setFeed(formattedRecentFeed);
        } else if (typeof initialTicketsCount === 'number' && initialTicketsCount > 0) {
          setFeed([
            `${t('events.ticketPurchased', 'New ticket purchased')} #${initialTicketsCount}`
          ]);
        } else {
          setFeed([]);
        }
        
        // Get recent winners from contract
        const recentWinners = await getRecentWinners();
        setWinners(recentWinners);
        
        unsubscribeTicketRef.current = await watchTicketEvents((eventMessage) => {
          setFeed(prev => [eventMessage, ...prev].slice(0,15));
          setTicketsBought(t => (typeof t === 'number' ? t + 1 : 1));
        });

        unsubscribeWinnerRef.current = watchWinnerEvents && typeof watchWinnerEvents === 'function'
          ? await watchWinnerEvents((winnerData) => {
              setWinners(prev => [winnerData, ...prev].slice(0, 15));
            })
          : () => {};
      } catch (error) {
        console.error("Error initializing data:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeData();
    
    return () => {
      mounted = false;
      unsubscribeTicketRef.current();
      unsubscribeWinnerRef.current();
    };
  }, [walletAddress]);

  // Periodically update the prize pool to reflect new contributions when wallet is connected
  useEffect(() => {
    let intervalId;
    
    const updatePool = async () => {
      // Check if wallet is connected before attempting to update
      const currentProvider = await getCurrentProvider();
      if (!currentProvider) {
        // Skip update if no wallet connected
        return;
      }
      
      try {
        const updatedPool = await readPrizePool();
        setPoolAmount(updatedPool);

        const updatedTicketsCount = await getTicketsCount();
        if (typeof updatedTicketsCount === 'number') {
          setTicketsBought(updatedTicketsCount);

          const previousCount = lastObservedTicketsRef.current;
          if (typeof previousCount === 'number' && updatedTicketsCount > previousCount) {
            const newPurchases = updatedTicketsCount - previousCount;
            const timestamp = new Date().toLocaleTimeString();

            setFeed((previousFeed) => {
              const newEvents = Array.from({ length: Math.min(newPurchases, 5) }, (_, index) => (
                `${t('events.ticketPurchased', 'New ticket purchased')} #${previousCount + index + 1} • ${timestamp}`
              ));

              return [...newEvents, ...previousFeed].slice(0, 15);
            });
          }

          lastObservedTicketsRef.current = updatedTicketsCount;
        }
      } catch (error) {
        console.error("Error updating prize pool:", error);
      }
    };
    
    // Using a recursive setTimeout pattern instead of setInterval to avoid CSP issues
    const scheduleUpdate = () => {
      intervalId = setTimeout(async () => {
        await updatePool();
        scheduleUpdate(); // Schedule the next update
      }, 10000); // Update every 10 seconds
    };
    
    scheduleUpdate();

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [walletAddress, t]);

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
  const onWalletConnect = async (address, web3Provider, signer) => {
    setWalletAddress(address);
    setSigner(signer);
    
    // Update provider in ethers utils
    updateProvider(web3Provider);
    updateContractInstance(web3Provider);
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
                    <div className={styles.roundLabel}>Round: 1</div>
                  </div>
                  <div className={styles.subHeaderRow}>{t("ticketsBought", "билетов куплено")}: {ticketsBought !== null ? ticketsBought : '*'}</div>
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

                <div className={styles.ticketsInfo}>{t("myTickets", "Мои билеты")}: {!walletAddress ? '*' : myTickets}</div>
              </section>

              <HowItWorks onReadMore={openAboutPage} />
            </div>

            <div className={styles.rightColumn}>
              <Winners winners={Array.isArray(winners) ? winners : []} />

              <div className={styles.sideCard}>
                <h4 className={styles.sideTitle}>📡 {t("liveFeed", "Live feed:")}</h4>
                {feed.length > 0 ? <LiveFeed events={feed} /> : <div className={styles.placeholderText}>{t("liveFeedWaiting", "No purchase activity yet — live updates will appear here.")}</div>}
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
