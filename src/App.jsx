import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

import styles from "./styles/Home.module.css";
import { readPrizePool, watchTicketEvents, buyTicket, getUserTickets, getRecentWinners, watchWinnerEvents, updateProvider, updateContractInstance, getTicketsCount, getCurrentProvider, SUPPORTS_TICKET_EVENTS, SUPPORTS_HISTORICAL_WINNERS } from "./utils/ethersUtils";

export default function App() {
  const { t } = useTranslation();

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
        
        // Get recent winners from contract
        const recentWinners = await getRecentWinners();
        setWinners(recentWinners);
        
        if (SUPPORTS_TICKET_EVENTS) {
          unsubscribeTicketRef.current = await watchTicketEvents((eventMessage) => {
            setFeed(prev => [eventMessage, ...prev].slice(0,15));
            setTicketsBought(t => t + 1);
          });
        }

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
      } catch (error) {
        console.error("Error updating prize pool:", error);
      }
    };
    
    // Using a recursive setTimeout pattern instead of setInterval to avoid CSP issues
    const scheduleUpdate = () => {
      intervalId = setTimeout(async () => {
        await updatePool();
        scheduleUpdate(); // Schedule the next update
      }, 30000); // Update every 30 seconds
    };
    
    scheduleUpdate();

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [walletAddress]);

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

          <HowItWorks />
        </div>

        <div className={styles.rightColumn}>
          {winners !== null ? (
            SUPPORTS_HISTORICAL_WINNERS || (winners && winners.length > 0) ? <Winners winners={winners} /> : (
              <div className={styles.winnersPlaceholder}>
                <h4 className={styles.sideTitle}>🏆 {t("recentWinners", "Последние победители")}</h4>
                <div className={styles.placeholderText}>Winner history is unavailable in current contract ABI.</div>
              </div>
            )
          ) : (
            <div className={styles.winnersPlaceholder}>
              <h4 className={styles.sideTitle}>🏆 {t("recentWinners", "Последние победители")}</h4>
              <div className={styles.placeholderText}>Please connect wallet to view winners</div>
            </div>
          )}

          <div className={styles.sideCard}>
            <h4 className={styles.sideTitle}>📡 {t("liveFeed", "Live feed:")}</h4>
            {SUPPORTS_TICKET_EVENTS ? <LiveFeed events={feed} /> : <div className={styles.placeholderText}>On-chain ticket events are unavailable in current contract ABI.</div>}
          </div>
        </div>
      </main>

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
