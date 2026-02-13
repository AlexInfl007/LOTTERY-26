import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);

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
    
    setCheckingWallet(true);
    
    // Wait a bit to ensure any wallet extensions have loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check for various wallet providers
    let ethereum = window.ethereum;
    
    // If no injected wallet found, try to guide user appropriately
    if (!ethereum) {
      setCheckingWallet(false);
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
      // First, switch to Polygon network
      await switchToPolygonNetwork();
      
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
        // Error when trying to connect while another connection request is pending
        alert("A connection request is already pending. Please check your wallet extension.");
      } else {
        alert(`Wallet connection failed: ${error.message || 'No active wallet found'}`);
      }
    } finally {
      setCheckingWallet(false);
    }
  };

  const switchToPolygonNetwork = async () => {
    const polygonChainParams = {
      chainId: '0x89', // 137 in decimal
      chainName: 'Polygon Mainnet',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      rpcUrls: ['https://polygon-rpc.com/'],
      blockExplorerUrls: ['https://polygonscan.com/']
    };

    try {
      // Try to switch to Polygon network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: polygonChainParams.chainId }],
      });
    } catch (switchError) {
      // This error code indicates that the chain is not added to MetaMask
      if (switchError.code === 4902) {
        try {
          // Add the Polygon network to the wallet
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [polygonChainParams],
          });
        } catch (addError) {
          console.error('Error adding Polygon network:', addError);
          throw addError;
        }
      } else {
        console.error('Error switching to Polygon network:', switchError);
        throw switchError;
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
