import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';
import { updateProviderWithSigner } from '../utils/ethersUtils';

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
      
      // Create provider with signer and update global contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      updateProviderWithSigner(signer);
    } catch (e) {
      console.error(e);
    }
  };

  // Check if already connected when component mounts
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            setConnected(true);
            
            // Create provider with signer and update global contract
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            updateProviderWithSigner(signer);
          }
        } catch (e) {
          console.error("Error checking connection:", e);
        }
      }
    };
    
    checkConnection();
  }, []);

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
