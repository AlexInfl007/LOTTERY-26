import React, { useState } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";

export default function WalletConnect() {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  const connect = async () => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth) {
      alert("Please install MetaMask");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
      setConnected(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      onClick={connect}
      className="px-4 py-2 rounded-xl font-semibold transform hover:scale-105 transition"
      style={{
        background: "linear-gradient(90deg,#A855F7,#F472B6)",
        color: "white",
        boxShadow: "0 10px 30px rgba(168,85,247,0.15)"
      }}
    >
      {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
    </button>
  );
}
