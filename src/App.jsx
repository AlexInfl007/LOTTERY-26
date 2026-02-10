import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

import contractABI from "./contractABI.json";

import styles from "./styles/Home.module.css";

const CONTRACT_ADDRESS = "0xf90169ad413429af4ae0a3b8962648d4a3289011";
const POLYGON_RPC_URL = "https://polygon-rpc.com/";

export default function App() {
  const { t } = useTranslation();

  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  
  const [poolAmount, setPoolAmount] = useState(0);
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(0);
  const [myTickets, setMyTickets] = useState(0);
  const [feed, setFeed] = useState([]);

  // Initialize provider and contract
  useEffect(() => {
    const initContract = async () => {
      try {
        // Create a provider for reading data from blockchain
        const rpcProvider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        setProvider(rpcProvider);

        // Create contract instance for read-only operations
        const readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider);
        setContract(readOnlyContract);

        // Load initial data
        await loadContractData(readOnlyContract);
      } catch (error) {
        console.error("Error initializing contract:", error);
      }
    };

    const loadContractData = async (contractInstance) => {
      try {
        // Get contract balance (pool amount)
        const balance = await contractInstance.getContractBalance();
        setPoolAmount(parseFloat(ethers.formatEther(balance)));

        // Get total tickets bought (using current ticket ID as proxy)
        const currentTicketId = await contractInstance.getCurrentTicketId();
        setTicketsBought(Number(currentTicketId));

        // Listen to events
        setupEventListeners(contractInstance);
      } catch (error) {
        console.error("Error loading contract data:", error);
      }
    };

    const setupEventListeners = (contractInstance) => {
      // Listen for TicketPurchased events
      contractInstance.on("TicketPurchased", (player, ticketId, timestamp) => {
        setFeed(prev => [`0x${player.toString().slice(-8)}... bought a ticket`, ...prev].slice(0, 15));
        setTicketsBought(t => t + 1);
        
        // Update pool amount by fetching current balance
        contractInstance.getContractBalance()
          .then(balance => setPoolAmount(parseFloat(ethers.formatEther(balance))))
          .catch(console.error);
      });

      // Listen for LotteryWon events
      contractInstance.on("LotteryWon", (winner, amount, ticketId) => {
        setFeed(prev => [`0x${winner.toString().slice(-8)}... won ${ethers.formatEther(amount)} POL`, ...prev].slice(0, 15));
      });
    };

    initContract();

    // Cleanup event listeners on unmount
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, []);

  // Function to update user's tickets when connected
  useEffect(() => {
    if (contract && userAddress) {
      const updateUserTickets = async () => {
        try {
          const userTickets = await contract.getUserTickets(userAddress);
          setMyTickets(userTickets.length);
        } catch (error) {
          console.error("Error getting user tickets:", error);
        }
      };
      
      updateUserTickets();
    }
  }, [contract, userAddress]);

  const handleParticipate = async () => {
    if (!provider || !userAddress) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Get the signer (user's wallet) to interact with the contract
      const signer = await provider.getSigner();
      const writeContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

      // Get ticket price from contract
      const ticketPrice = await writeContract.ticketPrice();
      
      // Purchase ticket
      const tx = await writeContract.purchaseTicket({ value: ticketPrice });
      await tx.wait();

      // Update UI after successful transaction
      setFeed(prev => [`You bought a ticket`, ...prev].slice(0, 15));
      
      // Update user tickets count
      const userTickets = await contract.getUserTickets(userAddress);
      setMyTickets(userTickets.length);
      
      // Update pool amount
      const balance = await contract.getContractBalance();
      setPoolAmount(parseFloat(ethers.formatEther(balance)));
    } catch (error) {
      console.error("Error purchasing ticket:", error);
      alert(`Error purchasing ticket: ${error.message}`);
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
            <WalletConnect onConnect={setUserAddress} onDisconnect={() => setUserAddress(null)} />
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
              <button onClick={handleParticipate} className={styles.participateButton}>
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
