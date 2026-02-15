import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { ethers } from 'ethers';
import { updateProvider } from '../utils/ethersUtils';

// Helper function to detect all available providers
function getAllProviders() {
  if (typeof window === 'undefined') {
    return [];
  }

  if (!window.ethereum) {
    return [];
  }

  // Check if multiple providers exist
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    return window.ethereum.providers;
  }

  // Return single provider as array
  if (window.ethereum) {
    return [window.ethereum];
  }

  return [];
}

// Helper function to detect the preferred provider among multiple wallets
function getPreferredProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  // Wait a bit for wallet extensions to initialize
  if (!window.ethereum) {
    return null;
  }

  // Check for specific wallet providers in order of preference
  // Check for MetaMask first (most common)
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    // Multiple providers detected
    for (const provider of window.ethereum.providers) {
      // Prioritize MetaMask over other wallets
      if (provider.isMetaMask && !provider.isBraveWallet && !provider.isTokenary && !provider.isAvalanche && !provider.isBitKeep) {
        return provider;
      }
    }
    
    // Then check for other known providers
    for (const provider of window.ethereum.providers) {
      if (provider.isCoinbaseWallet) return provider;
      if (provider.isTrustWallet) return provider;
      if (provider.isBraveWallet) return provider;
      if (provider.isTokenary) return provider;
      if (provider.isAvalanche) return provider;
      if (provider.isBitKeep) return provider;
    }
    
    // Fallback to first available provider
    return window.ethereum.providers[0];
  }

  // Single provider case - check for specific wallet types
  if (window.ethereum.isMetaMask) return window.ethereum;
  if (window.ethereum.isCoinbaseWallet) return window.ethereum;
  if (window.ethereum.isTrustWallet) return window.ethereum;
  if (window.ethereum.isBraveWallet) return window.ethereum;
  
  // Fallback to default provider
  return window.ethereum;
}

// Function to wait for wallet to be ready
async function waitForWalletReady() {
  return new Promise((resolve) => {
    if (window.ethereum && window.ethereum.isMetaMask) {
      resolve();
    } else if (window.ethereum && window.ethereum.providers) {
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
  const [availableWallets, setAvailableWallets] = useState([]);

  useEffect(() => {
    // Detect mobile devices
    const checkIsMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Detect available wallets on component mount
  useEffect(() => {
    const detectWallets = async () => {
      // Wait a bit for wallet extensions to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const providers = getAllProviders();
      const detectedWallets = [];
      
      for (const provider of providers) {
        if (provider.isMetaMask) {
          detectedWallets.push({ id: 'metamask', name: 'MetaMask', provider });
        } else if (provider.isCoinbaseWallet) {
          detectedWallets.push({ id: 'coinbase', name: 'Coinbase Wallet', provider });
        } else if (provider.isTrustWallet) {
          detectedWallets.push({ id: 'trust', name: 'Trust Wallet', provider });
        } else if (provider.isBraveWallet) {
          detectedWallets.push({ id: 'brave', name: 'Brave Wallet', provider });
        } else if (provider.isTokenary) {
          detectedWallets.push({ id: 'tokenary', name: 'Tokenary', provider });
        } else if (provider.isAvalanche) {
          detectedWallets.push({ id: 'avalanche', name: 'Core Wallet', provider });
        } else if (provider.isBitKeep) {
          detectedWallets.push({ id: 'bitkeep', name: 'BitKeep', provider });
        } else if (provider.isPhantom) {
          detectedWallets.push({ id: 'phantom', name: 'Phantom', provider });
        } else if (provider.isRabby) {
          detectedWallets.push({ id: 'rabby', name: 'Rabby', provider });
        } else if (provider.isOkxWallet) {
          detectedWallets.push({ id: 'okx', name: 'OKX Wallet', provider });
        } else if (provider.isBinance) {
          detectedWallets.push({ id: 'binance', name: 'Binance Web3 Wallet', provider });
        } else {
          // Generic provider
          detectedWallets.push({ id: 'other', name: 'Wallet', provider });
        }
      }
      
      setAvailableWallets(detectedWallets);
    };

    detectWallets();
  }, []);

  const connect = async () => {
    if (typeof window === "undefined") return;
    
    // If multiple wallets are available, show selection modal
    if (availableWallets.length > 1) {
      setShowWalletModal(true);
      return;
    }
    
    // If only one wallet is available, connect directly
    if (availableWallets.length === 1) {
      await connectToWallet(availableWallets[0]);
      return;
    }
    
    // If no wallets detected, show installation instructions
    setCheckingWallet(true);
    
    // Wait a bit to ensure any wallet extensions have loaded
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Use our improved provider detection function
    const ethereum = getPreferredProvider();
    
    // If no injected wallet found, try to guide user appropriately
    if (!ethereum) {
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

    await connectToWallet({ provider: ethereum });
  };

  // Function to connect to a specific wallet
  const connectToWallet = async (walletOption) => {
    const ethereum = walletOption.provider;

    setCheckingWallet(true);

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
      
      // Test the provider by making a simple call to ensure it's working
      try {
        // Test basic provider functionality
        await provider.getCode('0x0000000000000000000000000000000000000000');
        
        // Additional test for eth_newFilter which was causing issues
        try {
          // Create a simple filter to test if this method is available
          const filter = await provider.send('eth_newFilter', [{
            fromBlock: 'latest',
            toBlock: 'latest'
          }]);
          // If successful, we can remove the filter immediately
          await provider.send('eth_uninstallFilter', [filter]);
        } catch (filterTestError) {
          console.warn("Filter functionality test failed:", filterTestError);
          // Continue anyway as some wallets may have restricted filter methods
        }
      } catch (testError) {
        console.warn("Provider test failed, but continuing with connection:", testError);
      }
      
      // Update global provider with the user's provider
      updateProvider(provider);
      
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
        } else if (error.code === -32603) {
          errorMessage = 'Internal error. Please make sure your wallet is properly installed and unlocked.';
        } else if (error.code === -32075) {
          errorMessage = 'Method disabled. This may be due to browser restrictions or wallet configuration.';
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
      setShowWalletModal(false);
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
    <>
      <button
        onClick={connect}
        className={styles.connectButton}
      >
        <span>🔒</span>
        {connected ? (address ? `${address.slice(0,6)}…${address.slice(-4)}` : t("connected","Connected")) : t("connectWallet","Connect Wallet")}
      </button>
      
      {/* Wallet selection modal */}
      {showWalletModal && (
        <div className={styles.modalOverlay} onClick={() => setShowWalletModal(false)}>
          <div className={styles.walletModal} onClick={(e) => e.stopPropagation()}>
            <h3>Select Wallet</h3>
            <div className={styles.walletList}>
              {availableWallets.map((wallet, index) => (
                <button
                  key={index}
                  className={styles.walletOption}
                  onClick={() => connectToWallet(wallet)}
                >
                  <span className={styles.walletIcon}>📱</span>
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
