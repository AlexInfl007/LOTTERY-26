import React, { useState } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";

export default function WalletConnect() {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  const connect = async () => {
    if (typeof window === "undefined") {
      console.error("Window object is not available");
      return;
    }
    
    const eth = window.ethereum;
    if (!eth) {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }
    
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setConnected(true);
      }
    } catch (e) {
      console.error("Error connecting wallet:", e);
      if (e.code === 4001) {
        console.log("User rejected the connection request");
      }
    }
  };

  return (
    <button
      onClick={connect}
      className={`${styles.connectButton}`}
    >
      {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
    </button>
  );
}
