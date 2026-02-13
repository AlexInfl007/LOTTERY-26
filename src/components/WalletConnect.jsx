import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile devices
    const checkIsMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const connect = async () => {
    if (typeof window === "undefined") return;
    
    // Check for various wallet providers
    let ethereum = window.ethereum;
    
    // Check for different wallet types
    const hasMetaMask = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    const hasCoinbase = typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet;
    const hasTrustWallet = typeof window.ethereum !== 'undefined' && window.ethereum.isTrust;
    const hasInjectedWallet = typeof window.ethereum !== 'undefined';
    
    // If no injected wallet found, try to guide user appropriately
    if (!hasInjectedWallet) {
      if (isMobile) {
        // On mobile, suggest installing a wallet app
        try {
          // Use the actual domain of the site
          const currentDomain = window.location.hostname;
          const metamaskLink = currentDomain !== 'localhost' 
            ? `https://metamask.app.link/dapp/${currentDomain}`
            : 'https://metamask.io/download/';
          window.open(metamaskLink, '_blank');
        } catch (error) {
          // Fallback if opening the link fails
        }
        alert("Please install a crypto wallet like MetaMask, Trust Wallet, or Coinbase Wallet.");
      } else {
        // On desktop, suggest installing MetaMask or other wallet extension
        alert("Please install a crypto wallet like MetaMask, Trust Wallet, or Coinbase Wallet.");
      }
      return;
    }

    try {
      // Request account access
      const accounts = await ethereum.request({ 
        method: "eth_requestAccounts" 
      });
      
      setAddress(accounts[0]);
      setConnected(true);
      
      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Pass the connection details to the parent component
      onConnect && onConnect(accounts[0], provider, signer);
    } catch (error) {
      console.error("Wallet connection error:", error);
      if (error.code === 4001) {
        // User rejected the request
        console.log("User denied account access");
        alert("Connection was cancelled by the user.");
      } else if (error.code === -32002) {
        // Request already pending - MetaMask popup already open
        alert("A connection request is already pending. Please check your wallet extension.");
      } else {
        // Provide more specific error messages based on the error
        let errorMessage = `Wallet connection failed: ${error.message}`;
        
        if (error.message.includes("not connected to Ethereum network")) {
          errorMessage = "Wallet is not connected to an Ethereum network. Please switch to Polygon network in your wallet.";
        } else if (error.message.includes("invalid json rpc response")) {
          errorMessage = "Invalid response from wallet. Please make sure your wallet is unlocked and try again.";
        }
        
        alert(errorMessage);
      }
    }
  };

  return (
    <button
      onClick={connect}
      className={styles.connectButton}
    >
      <span>🔒</span>
      {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
    </button>
  );
}
