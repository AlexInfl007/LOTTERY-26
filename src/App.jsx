import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import PoolProgressBar from "./components/PoolProgressBar";
import WalletConnect from "./components/WalletConnect";
import LiveFeed from "./components/LiveFeed";
import Winners from "./components/Winners";
import HowItWorks from "./components/HowItWorks";
import LanguageSelector from "./components/LanguageSelector";
import LuckyButton from "./components/LuckyButton";

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 text-white flex flex-col">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div>

      <header className="relative w-full py-6 px-6 md:px-12 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center font-bold shadow-2xl shadow-purple-500/30">
            <span className="text-2xl">SL</span>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Seren Lottery Chain
            </div>
            <div className="text-sm md:text-base text-gray-300">{t("subtitle", "Verifiable Randomness — Fair Wins")}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSelector />
          <WalletConnect />
        </div>
      </header>

      <main className="relative container mx-auto px-6 md:px-12 py-6 flex-1 z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Main jackpot section with enhanced styling */}
            <section className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 p-8 rounded-3xl shadow-2xl shadow-purple-500/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {t("currentJackpot", "Текущий джекпот")}
                  </h2>
                  <div className="text-sm text-gray-300 mt-1">Round: 1 • Live</div>
                </div>
                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 px-4 py-2 rounded-xl border border-purple-500/30">
                  <div className="text-sm text-gray-300">{t("ticketsBought", "билетов куплено")}: {ticketsBought}</div>
                </div>
              </div>

              <PoolProgressBar current={poolAmount} goal={poolTarget} />

              <div className="mt-8 text-center">
                <div className="font-bold text-2xl md:text-3xl bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  {t("collectingTo", "Собираем пул до")} {poolTarget.toLocaleString()} POL!
                </div>
                <div className="text-base md:text-lg text-gray-300 mt-2">{t("eachTicketIncreases", "Каждый билет увеличивает джекпот.")}</div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button 
                  onClick={handleParticipate} 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-purple-500/30 transform hover:scale-105 transition-all duration-300"
                >
                  {t("participate", "Участвовать — 30 POL")}
                </button>

                <LuckyButton />
              </div>

              <div className="flex justify-center mt-6">
                <div className="bg-gradient-to-r from-blue-600/30 to-cyan-600/30 px-6 py-3 rounded-2xl border border-blue-500/30">
                  <div className="text-center text-gray-200 font-medium">{t("myTickets", "Мои билеты")}: <span className="text-xl font-bold text-cyan-300">{myTickets}</span></div>
                </div>
              </div>
            </section>

            <HowItWorks />
          </div>

          <aside className="space-y-8">
            <Winners winners={[]} />

            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 p-6 rounded-3xl shadow-2xl shadow-purple-500/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <h4 className="font-bold text-xl">{t("liveFeed", "Live feed:")}</h4>
              </div>
              <LiveFeed events={feed} />
            </div>

            {/* Additional information panel */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 p-6 rounded-3xl shadow-2xl shadow-purple-500/10">
              <h4 className="font-bold text-xl mb-4 text-purple-300">О системе</h4>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Честная система с подтверждением случайности</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-pink-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Безопасность на базе Polygon</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Прозрачные результаты</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="relative py-8 px-6 md:px-12 text-center text-gray-400 z-10">
        <div className="mb-2">{t("footerNote", "Provable randomness powered by Chainlink VRF")} • Powered by Polygon</div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
          <span>© 2025 Seren. Все права защищены.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors">Условия использования</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
