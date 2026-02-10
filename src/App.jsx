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
    <div className="min-h-screen bg-gradient-to-br from-bg-dark to-bg-darker text-white flex flex-col">
      <header className="w-full py-4 md:py-6 px-4 md:px-6 flex items-center justify-between sticky top-0 z-50 bg-transparent backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-accent to-[#EC4899] rounded-xl flex items-center justify-center font-bold shadow-lg text-black">SL</div>
          <div>
            <div className="text-xl md:text-2xl font-bold">Seren Lottery</div>
            <div className="text-xs md:text-sm text-txt-muted">{t("subtitle", "Verifiable Randomness — Fair Wins")}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <LanguageSelector />
          <WalletConnect />
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 flex-1">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="card p-6 md:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-txt-light">{t("currentJackpot", "Current Jackpot")}</h2>
                  <div className="text-sm text-txt-muted">Round: 1</div>
                </div>
                <div className="text-sm text-txt-muted bg-white/5 px-3 py-1 rounded-full">{t("ticketsBought", "Tickets bought")}: {ticketsBought}</div>
              </div>

              <PoolProgressBar current={poolAmount} goal={poolTarget} />

              <div className="mt-6 text-center">
                <div className="font-semibold text-lg md:text-xl text-txt-light">{t("collectingTo", "Collecting pool to")} {poolTarget.toLocaleString()} POL!</div>
                <div className="text-sm md:text-base text-txt-muted mt-2">{t("eachTicketIncreases", "Each ticket increases the jackpot.")}</div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button 
                  onClick={handleParticipate} 
                  className="btn btn-primary min-w-[200px]"
                >
                  {t("participate", "Participate — 30 POL")}
                </button>

                <LuckyButton />
              </div>

              <div className="text-center text-txt-muted mt-6 text-base">
                {t("myTickets", "My Tickets")}: <span className="font-semibold text-txt-light">{myTickets}</span>
              </div>
            </section>

            <HowItWorks />
          </div>

          <aside className="space-y-6">
            <Winners winners={[]} />

            <div className="card p-5">
              <h4 className="font-bold mb-4 text-lg text-txt-light">{t("liveFeed", "Live Feed")}</h4>
              <LiveFeed events={feed} />
            </div>
          </aside>
        </div>
      </main>

      <footer className="py-6 px-4 md:px-6 text-center text-txt-muted border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-sm">
          <span>{t("footerNote", "Provable randomness powered by Chainlink VRF")}</span>
          <span className="hidden md:inline">•</span>
          <span>Powered by Polygon</span>
        </div>
        <div className="mt-2 text-xs">© 2025 Seren Lottery. All rights reserved.</div>
      </footer>
    </div>
  );
}
