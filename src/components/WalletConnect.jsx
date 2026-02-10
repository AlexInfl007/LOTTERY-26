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
      alert("Please open this page in a browser that supports Web3 wallets");
      return;
    }
    
    const eth = window.ethereum;
    if (!eth) {
      alert("Please install MetaMask or another Web3 wallet");
      return;
    }
    
    try {
      // Request account access
      const accounts = await eth.request({ 
        method: "eth_requestAccounts" 
      });
      
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        setAddress(userAddress);
        setConnected(true);
        if (onConnect) onConnect(userAddress);
        
        // Set up account change listener
        eth.on('accountsChanged', handleAccountsChanged);
      }
    } catch (e) {
      console.error("Error connecting wallet:", e);
      if (e.code === 4001) {
        alert("User rejected the connection request");
      } else {
        alert(`Error connecting wallet: ${e.message}`);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      disconnect();
    } else {
      // Account changed
      const newAddress = accounts[0];
      setAddress(newAddress);
      if (onConnect) onConnect(newAddress);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
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
            
            // Set up account change listener
            window.ethereum.on('accountsChanged', handleAccountsChanged);
          }
        } catch (e) {
          console.error("Error checking existing connection:", e);
        }
      }
    };

    checkExistingConnection();

    // Clean up event listener on unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
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
