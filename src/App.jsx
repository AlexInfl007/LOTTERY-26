import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";
import { 
  getCurrentPoolAmount, 
  getTotalTicketsSold, 
  participateInLottery,
  getRecentTransactions,
  getWinners,
  isWalletConnected,
  getConnectedAddress
} from "./utils/contractInteraction";

import styles from "./styles/Home.module.css";

// Component for Live Feed section to avoid overlap with Winners
function LiveFeedSection({ feed, t }) {
  return (
    <div className="bg-white/5 border border-white/6 p-4 rounded-2xl shadow-xl">
      <h4 className="font-bold mb-2 text-lg">{t("liveFeed", "Live feed:")}</h4>
      <LiveFeed events={feed} />
    </div>
  );
}

export default function App() {
  const { t } = useTranslation();

  const [poolAmount, setPoolAmount] = useState(0); // Start with 0, will be updated from contract
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(0); // Start with 0, will be updated from contract
  const [myTickets, setMyTickets] = useState(0);
  const [feed, setFeed] = useState([]);
  const [walletConnected, setWalletConnected] = useState(false);

  // Fetch initial data from the smart contract
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pool, tickets] = await Promise.all([
          getCurrentPoolAmount(),
          getTotalTicketsSold()
        ]);
        setPoolAmount(pool);
        setTicketsBought(tickets);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchData();

    // Set up periodic updates from the contract
    const interval = setInterval(async () => {
      try {
        const [pool, tickets, recentTransactions] = await Promise.all([
          getCurrentPoolAmount(),
          getTotalTicketsSold(),
          getRecentTransactions()
        ]);

        setPoolAmount(pool);
        setTicketsBought(tickets);

        // Update feed with real transaction data
        if (recentTransactions && recentTransactions.length > 0) {
          const newFeed = recentTransactions.map(tx => {
            const addr = tx.user.substring(0, 6) + "..." + tx.user.substring(tx.user.length - 4);
            return `${addr} ${t("events.deposited", `внес ${tx.amount}POL в пул`)}`;
          });
          
          setFeed(prev => [...newFeed, ...prev].slice(0, 15));
        }
      } catch (error) {
        console.error("Error updating data:", error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [t]);

  const handleParticipate = async () => {
    try {
      // Participate in the lottery via smart contract
      const tx = await participateInLottery(30); // 30 POL
      
      // Update local state after successful transaction
      setMyTickets(t => t + 1);
      setPoolAmount(p => +(p + 30).toFixed(2));
      
      // Add to feed
      const address = await getConnectedAddress();
      if (address) {
        const shortAddr = address.substring(0, 6) + "..." + address.substring(address.length - 4);
        setFeed(prev => [`You (${shortAddr}) ${t("events.depositedShort", "внес 30POL")}`, ...prev].slice(0,15));
      }
    } catch (error) {
      console.error("Error participating in lottery:", error);
      // Show error to user
      alert("Transaction failed: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-dark via-panel to-[#1a0533] text-white flex flex-col">
      <header className="w-full py-6 px-6 md:px-12 flex items-center justify-center">
        <div className="flex items-center gap-4"> {/* centered */}
          <div className="w-28 h-12 bg-white text-black rounded-lg flex items-center justify-center font-bold shadow-lg">LOGO</div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">Seren Lottery Chain</div>
            <div className="text-sm md:text-base text-gray-300">{t("subtitle", "Verifiable Randomness — Fair Wins")}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-auto"> {/* move to right */}
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
                  <div className="text-sm text-gray-300">Round: 1</div>
                </div>
                <div className="text-sm text-gray-300">{t("ticketsBought", "билетов куплено")}: {ticketsBought}</div>
              </div>

              <PoolProgressBar current={poolAmount} goal={poolTarget} />

              <div className="mt-4 text-center">
                <div className="font-semibold text-lg md:text-xl">{t("collectingTo", "Собираем пул до")} {poolTarget.toLocaleString()} POL!</div>
                <div className="text-sm md:text-base text-gray-300 mt-1">{t("eachTicketIncreases", "Каждый билет увеличивает джекпот.")}</div>
              </div>

              <div className="flex gap-4 justify-center mt-6 flex-wrap">
                <button onClick={handleParticipate} className="bg-gradient-to-r from-[#A855F7] to-[#F472B6] px-6 py-3 rounded-xl font-bold shadow-lg text-sm md:text-base transform hover:scale-105 transition duration-300 hover:shadow-xl">
                  {t("participate", "Участвовать — 30 POL")}
                </button>

                <LuckyButton />
              </div>

              <div className="text-center text-gray-300 mt-4 text-base">{t("myTickets", "Мои билеты")}: {myTickets}</div>
            </section>

            <HowItWorks />
          </div>

          <aside className="space-y-6">
            <Winners winners={[]} />

            <LiveFeedSection feed={feed} t={t} />
          </aside>
        </div>
      </main>

      <footer className="py-6 px-6 md:px-12 flex justify-center items-center text-gray-400">
        <div className="text-center">
          <div>{t("footerNote", "Provable randomness powered by Chainlink VRF")} • Powered by Polygon</div>
          <div className="mt-2">© 2025 Seren</div>
        </div>
      </footer>
    </div>
  );
}
