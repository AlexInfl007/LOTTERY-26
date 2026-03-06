import { ethers } from 'ethers';
import { initializeContract } from '../../utils/contractManager';
import { setSharedProvider } from './providerStore';

// Configuration for Polygon Mainnet
const POLYGON_MAINNET_CONFIG = {
  chainId: '0x89', // 137 in hex
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18
  },
  rpcUrls: ['https://polygon-rpc.com/', 'https://rpc-mainnet.matic.network'],
  blockExplorerUrls: ['https://polygonscan.com/']
};

// Function to wait for wallet extensions to initialize
async function waitForWalletInitialization(timeout = 1500) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // Using a recursive setTimeout pattern instead of setInterval to avoid CSP issues
    const checkProvider = () => {
      if (window.ethereum && 
          (window.ethereum.providers || 
           window.ethereum.isMetaMask || 
           window.ethereum.isCoinbaseWallet ||
           window.ethereum.isTrustWallet ||
           window.ethereum.isBraveWallet ||
           window.ethereum.isPhantom ||
           window.ethereum.isRabby ||
           window.ethereum.isOkxWallet ||
           window.ethereum.isBinance ||
           window.ethereum.isTokenPocket)) {
        resolve();
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        resolve();
      } else {
        setTimeout(checkProvider, 50); // Check every 50ms
      }
    };
    
    checkProvider();
  });
}

// Function to detect and return the preferred provider
async function getPreferredProvider() {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
    return null;
  }

  // Wait for wallet extensions to properly initialize
  await waitForWalletInitialization(1500);

  // Additional check after waiting
  if (!window.ethereum) {
    return null;
  }

  const providerSupportsRpc = async (provider) => {
    if (!provider?.request || typeof provider.request !== 'function') {
      return false;
    }

    try {
      await provider.request({ method: 'eth_chainId' });
      return true;
    } catch {
      return false;
    }
  };

  // Check for multiple providers (for wallets that inject multiple providers)
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    // Prioritize MetaMask over other wallets
    for (const provider of window.ethereum.providers) {
      if (provider.isMetaMask && 
          !provider.isBraveWallet && 
          !provider.isTokenary && 
          !provider.isAvalanche && 
          !provider.isBitKeep && 
          !provider.isCoinbaseWallet &&
          !provider.isTrustWallet) {
        if (await providerSupportsRpc(provider)) {
          return provider;
        }
      }
    }
    
    // Then check for other known providers in priority order
    for (const provider of window.ethereum.providers) {
      if (
        provider.isCoinbaseWallet ||
        provider.isTrustWallet ||
        provider.isBraveWallet ||
        provider.isRabby ||
        provider.isOkxWallet ||
        provider.isBinance ||
        provider.isTokenPocket ||
        provider.isPhantom ||
        provider.isAvalanche ||
        provider.isBitKeep ||
        provider.isTokenary
      ) {
        if (await providerSupportsRpc(provider)) {
          return provider;
        }
      }
    }
    
    // Fallback to first available provider
    if (window.ethereum.providers.length > 0) {
      for (const provider of window.ethereum.providers) {
        if (await providerSupportsRpc(provider)) {
          return provider;
        }
      }
    }
    
    return null;
  }

  // Single provider case - check for specific wallet types in priority order
  if (
    window.ethereum.isMetaMask ||
    window.ethereum.isCoinbaseWallet ||
    window.ethereum.isTrustWallet ||
    window.ethereum.isBraveWallet ||
    window.ethereum.isRabby ||
    window.ethereum.isOkxWallet ||
    window.ethereum.isBinance ||
    window.ethereum.isTokenPocket ||
    window.ethereum.isPhantom
  ) {
    if (await providerSupportsRpc(window.ethereum)) {
      return window.ethereum;
    }
  }

  // Fallback to default provider
  return (await providerSupportsRpc(window.ethereum)) ? window.ethereum : null;
}

// Function to switch to Polygon network
export const switchToPolygonNetwork = async (ethereumProvider) => {
  try {
    // Try to switch to Polygon network
    await ethereumProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_MAINNET_CONFIG.chainId }],
    });
    return true;
  } catch (switchError) {
    // This error code indicates that the chain is not added to wallet
    if (switchError.code === 4902) {
      try {
        // Add the Polygon network to the wallet
        await ethereumProvider.request({
          method: 'wallet_addEthereumChain',
          params: [POLYGON_MAINNET_CONFIG],
        });
        return true;
      } catch (addError) {
        console.error('Error adding Polygon network:', addError);
        throw addError;
      }
    } else if (switchError.code === -32002) {
      // User already has a pending request to switch networks
      throw new Error('Network switch request already pending. Please check your wallet and approve/reject the existing request.');
    } else {
      console.error('Error switching to Polygon network:', switchError);
      throw switchError;
    }
  }
};

// Main wallet connection function
export const connectWallet = async () => {
  if (typeof window === "undefined") {
    throw new Error("Window object not available");
  }

  // Get the preferred provider (this now includes initialization wait)
  const ethereum = await getPreferredProvider();
  
  if (!ethereum) {
    throw new Error("No crypto wallet found. Please install a wallet like MetaMask, Trust Wallet, or Coinbase Wallet.");
  }

  try {
    // Verify that the provider is responsive before attempting connection
    try {
      await ethereum.request({ method: 'eth_chainId' });
    } catch (error) {
      console.error("Wallet provider is not responding:", error);
      throw new Error("Wallet provider is not responding. Please make sure your wallet is unlocked and ready before connecting.");
    }

    // Request account access
    const accounts = await ethereum.request({ 
      method: "eth_requestAccounts" 
    });

    // Switch to Polygon network after wallet approval.
    // Some mobile wallets reject chain switching before account authorization.
    await switchToPolygonNetwork(ethereum);

    // Check if we got valid accounts
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    // Verify that the provider is on the correct network (Polygon)
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== 137) {
      throw new Error(`Please switch to Polygon Mainnet in your wallet. Current network: ${network.name || chainId}`);
    }

    // Test the provider by making a simple call to ensure it's working
    try {
      await provider.getCode('0x0000000000000000000000000000000000000000');
    } catch (testError) {
      console.warn("Provider test failed, but continuing with connection:", testError);
    }

    // Save provider globally before contract initialization
    setSharedProvider(provider);

    // Initialize the contract with the new provider
    await initializeContract();

    return {
      address: accounts[0],
      provider,
      signer,
      ethereum
    };
  } catch (error) {
    console.error("Wallet connection error:", error);
    
    // More specific error handling
    let errorMessage = error.message || 'Unknown wallet connection error';
    
    if (error.code === 4001) {
      errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
    } else if (error.code === -32002) {
      errorMessage = 'Request already pending. Check your wallet extension and approve or reject the existing request.';
    } else if (error.code === -32603) {
      // Specific handling for the error you're experiencing
      errorMessage = 'Wallet connection failed: No active wallet found. Please make sure your wallet is unlocked and ready. If using MetaMask, please ensure it is unlocked and connected to the Polygon network. Try refreshing the page and make sure your wallet extension is properly installed and enabled.';
    } else if (error.code === -32075) {
      errorMessage = 'Method disabled. This may be due to browser restrictions or wallet configuration.';
    } else if (errorMessage.includes('network')) {
      errorMessage = 'Network switch failed. Please check your wallet settings and ensure Polygon network is added.';
    } else if (errorMessage.includes('user rejected')) {
      errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
    } else if (errorMessage.includes('invalid json rpc')) {
      errorMessage = 'Invalid JSON-RPC response. Make sure your wallet is unlocked and properly configured.';
    } else if (errorMessage.includes('No active wallet found')) {
      errorMessage = 'No active wallet found. Please make sure your wallet is unlocked and ready before connecting. If using MetaMask, check that it is unlocked and connected to the Polygon network.';
    } else if (errorMessage.includes('does not support specified chain')) {
      errorMessage = 'Current wallet does not support the required network. Please switch to a supported network in your wallet settings.';
    } else if (errorMessage.includes('unauthorized')) {
      errorMessage = 'Wallet connection unauthorized. Please check your wallet permissions and try again.';
    } else if (errorMessage.includes('disconnected')) {
      errorMessage = 'Wallet disconnected during connection. Please reconnect and try again.';
    } else if (errorMessage.includes('execution failed')) {
      errorMessage = 'Wallet connection execution failed. Please make sure your wallet is unlocked and properly configured.';
    } else if (error.message?.includes('Failed to fetch dynamically imported module')) {
      errorMessage = 'Wallet connection failed due to a module loading issue. Please refresh the page and try again.';
    }
    
    throw new Error(errorMessage);
  }
};

// Function to disconnect wallet
export const disconnectWallet = async () => {
  // Currently, there's no standard way to disconnect from all wallets
  // We just reset our internal state
  localStorage.removeItem('connectedWallet');
  return true;
};

// Function to check if wallet is connected
export const isWalletConnected = async () => {
  if (typeof window === "undefined" || !window.ethereum) {
    return false;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0;
  } catch (error) {
    console.warn('Error checking wallet connection:', error);
    return false;
  }
};

// Function to get current wallet address
export const getCurrentWalletAddress = async () => {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.warn('Error getting current wallet address:', error);
    return null;
  }
};
