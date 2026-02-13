import React, { useState } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';

export default function WalletConnect({ onConnect }) {
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
      if (accounts.length === 0) {
        alert("Wallet connection failed: No active wallet found");
        return;
      }
      setAddress(accounts[0]);
      setConnected(true);
      // Pass the address and provider to the parent component
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      onConnect && onConnect(accounts[0], provider, signer);
    } catch (e) {
      console.error("Wallet connection error:", e);
      // Provide more informative error message based on error type
      if (e.code === 4001) {
        // User rejected request
        alert("Wallet connection failed: Connection was rejected by user");
      } else if (e.code === -32002) {
        // Request already pending
        alert("Wallet connection failed: Connection request already pending");
      } else {
        alert(`Wallet connection failed: ${e.message || "No active wallet found"}`);
      }
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
