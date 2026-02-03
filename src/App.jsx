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

export default function App() {
  const { t } = useTranslation();

  const [poolAmount, setPoolAmount] = useState(300.0);
  const poolTarget = 1000000;
  const [ticketsBought, setTicketsBought] = useState(12);
  const [myTickets, setMyTickets] = useState(2);
  const [feed, setFeed] = useState([]);

  // simulate Live Feed updates (demo). Keep last 15 events
  useEffect(() => {
    const interval = setInterval(() => {
      const sample = [
        `0xA8b… ${t("events.deposited", "внес 30POL в пул")}`,
        `0xF7c… ${t("events.deposited", "внес 30POL в пул")}`,
        `0xD4e… ${t("events.bought", "купил 3 билета")}`,
        `0xB2a… ${t("events.depositedLarge", "внес 90POL в пул")}`
      ];
      setFeed(prev => [sample[Math.floor(Math.random()*sample.length)], ...prev].slice(0,15));
      setPoolAmount(p => Math.min(poolTarget, +(p + Math.random()*50).toFixed(2)));
      setTicketsBought(t => t + Math.floor(Math.random()*3));
    }, 3000);
    return () => clearInterval(interval);
  }, [t]);

  const handleParticipate = () => {
    setMyTickets(t => t + 1);
    setTicketsBought(t => t + 1);
    setPoolAmount(p => +(p + 30).toFixed(2));
    setFeed(prev => [`You ${t("events.depositedShort", "внес 30POL")}`, ...prev].slice(0,15));
  };

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
                <button onClick={handleParticipate} className="bg-gradient-to-r from-[#A855F7] to-[#F472B6] px-6 py-3 rounded-xl font-bold shadow-lg text-sm md:text-base transform hover:scale-105 transition">
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
