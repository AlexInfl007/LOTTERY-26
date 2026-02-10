import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";

export default function WalletConnect({ onConnect, onDisconnect }) {
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
      // Request account access
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        setAddress(userAddress);
        setConnected(true);
        
        // Create provider and signer for ethers
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        if (onConnect) onConnect(userAddress, provider, signer);
      }
    } catch (e) {
      console.error("Error connecting wallet:", e);
      if (e.code === 4001) {
        console.log("User rejected the connection request");
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
            
            // Create provider and signer for ethers
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            
            if (onConnect) onConnect(userAddress, provider, signer);
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
