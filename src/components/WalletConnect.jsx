import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';

// Function to detect all available wallet providers
function getAllAvailableProviders() {
  if (typeof window === 'undefined' || !window.ethereum) {
    return [];
  }

  // If there are multiple providers (window.ethereum.providers array)
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    return window.ethereum.providers.map(provider => {
      let name = 'Unknown Wallet';
      if (provider.isMetaMask) name = 'MetaMask';
      else if (provider.isCoinbaseWallet) name = 'Coinbase Wallet';
      else if (provider.isTrustWallet) name = 'Trust Wallet';
      else if (provider.isBraveWallet) name = 'Brave Wallet';
      else if (provider.isTokenary) name = 'Tokenary';
      else if (provider.isAvalanche) name = 'Core Wallet';
      else if (provider.isBitKeep) name = 'BitKeep';
      else if (provider.isOkxWallet || provider.isOKExWallet) name = 'OKX Wallet';
      else if (provider.isPhantom) name = 'Phantom';
      else if (provider.isRabby) name = 'Rabby';
      else if (provider.isImToken) name = 'imToken';
      else if (provider.isMathWallet) name = 'MathWallet';
      
      return { provider, name, id: name.toLowerCase().replace(/\s+/g, '') };
    });
  }

  // If there's a single provider, detect its type
  const singleProvider = window.ethereum;
  let name = 'Injected Wallet';
  if (singleProvider.isMetaMask) name = 'MetaMask';
  else if (singleProvider.isCoinbaseWallet) name = 'Coinbase Wallet';
  else if (singleProvider.isTrustWallet) name = 'Trust Wallet';
  else if (singleProvider.isBraveWallet) name = 'Brave Wallet';
  else if (singleProvider.isTokenary) name = 'Tokenary';
  else if (singleProvider.isAvalanche) name = 'Core Wallet';
  else if (singleProvider.isBitKeep) name = 'BitKeep';
  else if (singleProvider.isOkxWallet || singleProvider.isOKExWallet) name = 'OKX Wallet';
  else if (singleProvider.isPhantom) name = 'Phantom';
  else if (singleProvider.isRabby) name = 'Rabby';
  else if (singleProvider.isImToken) name = 'imToken';
  else if (singleProvider.isMathWallet) name = 'MathWallet';
  
  return [{ provider: singleProvider, name, id: name.toLowerCase().replace(/\s+/g, '') }];
}

// Function to wait for wallet to be ready
async function waitForWalletReady() {
  return new Promise((resolve) => {
    if (window.ethereum && (window.ethereum.isMetaMask || window.ethereum.providers)) {
      resolve();
    } else {
      // Wait for wallet to become available
      let attempts = 0;
      const checkWallet = () => {
        attempts++;
        if (window.ethereum && (window.ethereum.isMetaMask || window.ethereum.providers)) {
          resolve();
        } else if (attempts < 10) {
          setTimeout(checkWallet, 200);
        } else {
          resolve();
        }
      };
      checkWallet();
    }
  });
}

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [availableProviders, setAvailableProviders] = useState([]);

  useEffect(() => {
    // Detect mobile devices
    const checkIsMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const connectWithProvider = async (ethereum) => {
    if (!ethereum) return;

    try {
      // First, switch to Polygon network
      await switchToPolygonNetwork();
      
      // Request account access
      const accounts = await ethereum.request({ 
        method: "eth_requestAccounts" 
      });
      
      // Check if we got valid accounts
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }
      
      setAddress(accounts[0]);
      setConnected(true);
      
      // Create provider and signer using the detected ethereum provider
      const provider = new ethers.BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      
      // Close modal after successful connection
      setShowWalletModal(false);
      
      // Pass the connection details to the parent component
      onConnect && onConnect(accounts[0], provider, signer);
    } catch (error) {
      console.error("Wallet connection error:", error);
      if (error.code === 4001) {
        // User rejected the request
        console.log("User denied account access");
        alert("Connection was cancelled by the user. Please try again and approve the connection in your wallet.");
      } else {
        // More informative error handling
        let errorMessage = error.message || 'No active wallet found';
        
        // Handle common errors more specifically
        if (error.code === -32002) {
          errorMessage = 'Request already pending. Check your wallet extension and approve or reject the existing request.';
        } else if (errorMessage.includes('network')) {
          errorMessage = 'Network switch failed. Please check your wallet settings and ensure Polygon network is added.';
        } else if (errorMessage.includes('user rejected')) {
          errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
        } else if (errorMessage.includes('invalid json rpc')) {
          errorMessage = 'Invalid JSON-RPC response. Make sure your wallet is unlocked and properly configured.';
        }
        
        alert(`Wallet connection failed: ${errorMessage}`);
      }
    } finally {
      setCheckingWallet(false);
    }
  };

  const connect = async () => {
    if (typeof window === "undefined") return;
    
    setCheckingWallet(true);
    
    // Wait a bit to ensure any wallet extensions have loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get all available providers
    const providers = getAllAvailableProviders();
    
    if (providers.length === 0) {
      setCheckingWallet(false);
      if (isMobile) {
        // On mobile, suggest installing a wallet app with deep linking support
        try {
          // Use the actual domain of the site
          const currentDomain = window.location.hostname;
          // Try deep linking for various popular wallets
          const wallets = [
            `https://metamask.app.link/dapp/${currentDomain}`,
            `https://link.trustwallet.com/open_url?url=https://${currentDomain}`,
            `https://go.cb-w.com/dapp?cb_url=https://${currentDomain}`,
            `https://www.okx.com/web3/dapp?dappUrl=https://${currentDomain}`,
            `https://token.im/download`,
            'https://metamask.io/download/',
            'https://trustwallet.com/download',
            'https://coinbase.com/wallet/downloads'
          ];
          
          // Try to open the first available deep link
          for (const walletLink of wallets) {
            try {
              window.location.href = walletLink;
              break;
            } catch (e) {
              console.log(`Failed to open wallet link: ${walletLink}`);
            }
          }
        } catch (error) {
          console.error("Error opening wallet deep link:", error);
        }
        alert("Please install a crypto wallet like MetaMask, Trust Wallet, or Coinbase Wallet. Then refresh the page to connect.");
      } else {
        // On desktop, suggest installing MetaMask or other wallet extension
        alert("Please install a crypto wallet like MetaMask, Trust Wallet, or Coinbase Wallet. Then refresh the page to connect.");
      }
      return;
    }
    
    // If there's only one provider, connect directly
    if (providers.length === 1) {
      await connectWithProvider(providers[0].provider);
      return;
    }
    
    // If there are multiple providers, show selection modal
    setAvailableProviders(providers);
    setShowWalletModal(true);
    setCheckingWallet(false);
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
    <>
      <button
        onClick={connect}
        className={styles.connectButton}
      >
        <span>🔒</span>
        {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
      </button>

      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className={styles.modalOverlay} onClick={() => setShowWalletModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Select a Wallet</h3>
            <p className={styles.modalSubtitle}>Choose which wallet you'd like to connect with:</p>
            <div className={styles.walletList}>
              {availableProviders.map((wallet, index) => (
                <button
                  key={index}
                  className={styles.walletOption}
                  onClick={() => connectWithProvider(wallet.provider)}
                >
                  <span className={styles.walletIcon}>👛</span>
                  <span className={styles.walletName}>{wallet.name}</span>
                </button>
              ))}
            </div>
            <button 
              className={styles.cancelButton}
              onClick={() => setShowWalletModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
