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
import { readPrizePool, getCurrentRound, getUserTickets, buyTicket, getWinners, watchTicketEvents, watchWinnerEvents } from "./utils/ethersUtils";
import { ethers } from 'ethers';

export default function App() {
  const { t } = useTranslation();

  const [poolAmount, setPoolAmount] = useState(0.0); // Start with 0 since we'll fetch from contract
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(0); // Will be fetched from contract
  const [myTickets, setMyTickets] = useState(0); // Will be fetched based on connected wallet
  const [feed, setFeed] = useState([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [walletAddress, setWalletAddress] = useState(null);
  const [winnersList, setWinnersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get wallet address from window.ethereum if available
  useEffect(() => {
    const getWalletAddress = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (e) {
          console.error("Error getting wallet address:", e);
        }
      }
    };
    
    getWalletAddress();
    
    // Also listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress(null);
        }
      });
    }
  }, []);

  // Fetch initial data from smart contract
  useEffect(() => {
    const fetchData = async () => {
      try {
        const pool = await readPrizePool();
        const round = await getCurrentRound();
        const winners = await getWinners();
        
        setPoolAmount(pool);
        setCurrentRound(round);
        setWinnersList(winners);
        
        if (walletAddress) {
          const userTickets = await getUserTickets(walletAddress);
          setMyTickets(userTickets);
        }
      } catch (error) {
        console.error("Error fetching data from contract:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh data periodically
    const interval = setInterval(fetchData, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Subscribe to events
  useEffect(() => {
    let unsubscribeTicketEvents = null;
    let unsubscribeWinnerEvents = null;

    const setupEventListeners = () => {
      unsubscribeTicketEvents = watchTicketEvents((msg) => {
        setFeed(prev => [msg, ...prev].slice(0,15));
      });

      unsubscribeWinnerEvents = watchWinnerEvents((msg) => {
        setFeed(prev => [msg, ...prev].slice(0,15));
        // Refresh winners list when a new winner is announced
        getWinners().then(setWinnersList);
      });
    };

    setupEventListeners();

    return () => {
      if (unsubscribeTicketEvents) unsubscribeTicketEvents();
      if (unsubscribeWinnerEvents) unsubscribeWinnerEvents();
    };
  }, []);

  // Update user tickets when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      getUserTickets(walletAddress).then(setMyTickets);
    } else {
      setMyTickets(0);
    }
  }, [walletAddress]);

  const handleParticipate = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      // Get the signer from the connected wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Calculate the value to send (0.01 ETH/0.01 POL for example)
      // The exact price should come from the smart contract if available
      // For now, we'll use 0.01 ETH as the ticket price
      const ticketPrice = ethers.parseEther("0.01"); // 0.01 POL/ETH
      
      const result = await buyTicket(currentRound, ticketPrice, signer);
      
      if (result.success) {
        // Update UI immediately, then refresh from contract after a delay
        setMyTickets(t => t + 1);
        setTicketsBought(t => t + 1);
        setPoolAmount(p => +(p + 0.01).toFixed(2)); // Approximate update
        
        // Add to feed
        setFeed(prev => [`You bought a ticket for 0.01 POL`, ...prev].slice(0,15));
        
        // Wait a bit then refresh from contract
        setTimeout(async () => {
          const pool = await readPrizePool();
          const userTickets = await getUserTickets(walletAddress);
          
          setPoolAmount(pool);
          setMyTickets(userTickets);
        }, 2000);
      } else {
        alert(`Transaction failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Error buying ticket:", error);
      alert(`Error buying ticket: ${error.message}`);
    }
  };

  // Simple way to estimate tickets bought based on pool size
  // In reality, this should come from the contract if available
  useEffect(() => {
    // Estimate based on average ticket price
    const estimatedTickets = Math.round(poolAmount * 100); // Assuming ~0.01 POL per ticket
    setTicketsBought(estimatedTickets);
  }, [poolAmount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg-dark via-panel to-[#1a0533] text-white flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-dark via-panel to-[#1a0533] text-white flex flex-col">
      <header className="w-full py-6 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-4 ml-6 md:ml-16"> {/* moved from extremes */}
          <div className="w-28 h-12 bg-white text-black rounded-lg flex items-center justify-center font-bold shadow-lg">LOGO</div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">Seren Lottery Chain</div>
            <div className="text-sm md:text-base text-gray-300">{t("subtitle", "Verifiable Randomness — Fair Wins")}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mr-6 md:mr-16"> {/* moved from extremes */}
          <LanguageSelector />
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-6 md:px-12 py-6 flex-1">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white/5 border border-white/6 p-6 md:p-8 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg md:text-2xl font-bold">{t("currentJackpot", "Текущий джекпот")}</h2>
                  <div className="text-sm text-gray-300">Round: {currentRound}</div>
                </div>
                <div className="text-sm text-gray-300">{t("ticketsBought", "билетов куплено")}: {ticketsBought}</div>
              </div>

              <PoolProgressBar current={poolAmount} goal={poolTarget} />

              <div className="mt-4 text-center">
                <div className="font-semibold text-lg md:text-xl">{t("collectingTo", "Собираем пул до")} {poolTarget.toLocaleString()} POL!</div>
                <div className="text-sm md:text-base text-gray-300 mt-1">{t("eachTicketIncreases", "Каждый билет увеличивает джекпот.")}</div>
              </div>

              <div className="flex gap-4 justify-center mt-6 flex-wrap">
                <button onClick={handleParticipate} className="bg-gradient-to-r from-[#A855F7] to-[#F472B6] px-6 py-3 rounded-xl font-bold shadow-lg text-sm md:text-base transform hover:scale-105 transition">
                  {t("participate", "Участвовать — 0.01 POL")}
                </button>

                <LuckyButton />
              </div>

              <div className="text-center text-gray-300 mt-4 text-base">{t("myTickets", "Мои билеты")}: {myTickets}</div>
            </section>

            <HowItWorks />
          </div>

          <aside className="space-y-6">
            <Winners winners={winnersList} />

            <div className="bg-white/5 border border-white/6 p-4 rounded-2xl shadow-xl">
              <h4 className="font-bold mb-2 text-lg">{t("liveFeed", "Live feed:")}</h4>
              <LiveFeed events={feed} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="py-6 px-6 md:px-12 text-center text-gray-400">
        <div>{t("footerNote", "Provable randomness powered by Chainlink VRF")} • Powered by Polygon</div>
        <div className="mt-2">© 2025 Seren</div>
      </footer>
    </div>
  );
}
