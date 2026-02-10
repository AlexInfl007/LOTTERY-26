import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";

export default function WalletConnect({ onConnect, onDisconnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're running in the browser
  useEffect(() => {
    setIsClient(true);
  }, []);

  const connect = async () => {
    if (typeof window === "undefined" || !isClient) {
      console.error("Web3 wallet connection only works in browser environment");
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
        const userAddress = accounts[0];
        setAddress(userAddress);
        setConnected(true);
        if (onConnect) onConnect(userAddress);
      }
    } catch (e) {
      console.error("Error connecting wallet:", e);
      if (e.code === 4001) {
        console.log("User rejected the connection request");
      } else {
        alert(`Failed to connect wallet: ${e.message}`);
      }
    }
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
    if (onDisconnect) onDisconnect();
  };

  // Check if already connected on component mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            const userAddress = accounts[0];
            setAddress(userAddress);
            setConnected(true);
            if (onConnect) onConnect(userAddress);
          }
        } catch (e) {
          console.error("Error checking existing connection:", e);
        }
      }
    };

    checkExistingConnection();
  }, [onConnect]);

  return (
    <button
      onClick={connected ? disconnect : connect}
      className={`${styles.connectButton}`}
    >
      {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
    </button>
  );
}
