import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';
import { updateProvider, updateContractInstance } from '../utils/ethersUtils';
import { connectWallet, isWalletConnected, getCurrentWalletAddress } from '../utils/walletConnector';


export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);

  useEffect(() => {
    // Detect mobile devices
    const checkIsMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        const isConnected = await isWalletConnected();
        if (isConnected) {
          const currentAddress = await getCurrentWalletAddress();
          if (currentAddress) {
            setAddress(currentAddress);
            setConnected(true);
          }
        }
      } catch (error) {
        console.warn('Error checking existing wallet connection:', error);
      }
    };

    checkExistingConnection();
  }, []);

  const connect = async () => {
    if (typeof window === "undefined") return;
    
    setCheckingWallet(true);

    try {
      // Use the new wallet connector
      const connectionResult = await connectWallet();
      
      setAddress(connectionResult.address);
      setConnected(true);
      
      // Update global provider and contract instance with the user's provider
      updateProvider(connectionResult.provider);
      updateContractInstance(connectionResult.provider);
      
      // Pass the connection details to the parent component
      onConnect && onConnect(connectionResult.address, connectionResult.provider, connectionResult.signer);
    } catch (error) {
      console.error("Wallet connection error:", error);

      if (error.message?.includes('Redirecting to MetaMask app')) {
        return;
      }

      // Provide more user-friendly error message
      const userMessage = error.message.includes('No active wallet found') 
        ? "Wallet connection failed. Please make sure your wallet is unlocked and connected to the Polygon network. If using MetaMask, check that it's properly installed and enabled."
        : error.message;
      alert(`Wallet connection failed: ${userMessage}`);
    } finally {
      setCheckingWallet(false);
    }
  };

  return (
    <>
      <button
        onClick={connect}
        className={styles.connectButton}
      >
        <span>🔒</span>
        {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
      </button>
    </>
  );
}
