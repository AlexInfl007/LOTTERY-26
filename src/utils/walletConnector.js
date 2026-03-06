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

const WALLET_DEFINITIONS = [
  { key: 'metamask', name: 'MetaMask', icon: '🦊', matcher: (provider) => provider?.isMetaMask && !provider?.isBraveWallet && !provider?.isCoinbaseWallet && !provider?.isTrustWallet },
  { key: 'coinbase', name: 'Coinbase Wallet', icon: '🟦', matcher: (provider) => provider?.isCoinbaseWallet },
  { key: 'trust', name: 'Trust Wallet', icon: '🛡️', matcher: (provider) => provider?.isTrustWallet },
  { key: 'rabby', name: 'Rabby', icon: '🐰', matcher: (provider) => provider?.isRabby },
  { key: 'okx', name: 'OKX Wallet', icon: '⭕', matcher: (provider) => provider?.isOkxWallet },
  { key: 'binance', name: 'Binance Wallet', icon: '🟨', matcher: (provider) => provider?.isBinance },
  { key: 'tokenpocket', name: 'TokenPocket', icon: '👛', matcher: (provider) => provider?.isTokenPocket },
  { key: 'phantom', name: 'Phantom', icon: '👻', matcher: (provider) => provider?.isPhantom },
  { key: 'brave', name: 'Brave Wallet', icon: '🦁', matcher: (provider) => provider?.isBraveWallet }
];

let walletCache = [];

function getRawProviders() {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') return [];

  if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
    return window.ethereum.providers;
  }

  return [window.ethereum];
}

function buildUnknownWalletKey(provider, index) {
  const parts = [
    provider?.rdns,
    provider?.id,
    provider?.name,
    provider?.providerName,
    provider?.isFrame ? 'frame' : null,
    provider?.isTokenary ? 'tokenary' : null,
    provider?.isAvalanche ? 'avalanche' : null,
    provider?.isBitKeep ? 'bitkeep' : null,
    provider?.isExodus ? 'exodus' : null,
    provider?.isSafePal ? 'safepal' : null
  ].filter(Boolean);

  const normalized = (parts.join('-') || `injected-${index + 1}`)
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `injected-${normalized || index + 1}`;
}

function detectWalletMetadata(provider, index) {
  const knownWallet = WALLET_DEFINITIONS.find((wallet) => wallet.matcher(provider));
  if (knownWallet) {
    return knownWallet;
  }

  return {
    key: buildUnknownWalletKey(provider, index),
    name: provider?.name || provider?.providerName || 'Injected Wallet',
    icon: '👛'
  };
}

function getAvailableWalletEntries() {
  const providers = getRawProviders();
  const entries = [];
  const seenProvider = new Set();
  const keyCount = new Map();

  providers.forEach((provider, index) => {
    if (!provider || seenProvider.has(provider)) return;
    seenProvider.add(provider);

    const walletMeta = detectWalletMetadata(provider, index);
    const baseKey = walletMeta.key;
    const duplicates = keyCount.get(baseKey) || 0;
    keyCount.set(baseKey, duplicates + 1);
    const key = duplicates > 0 ? `${baseKey}-${duplicates + 1}` : baseKey;

    entries.push({
      key,
      walletType: key,
      name: walletMeta.name,
      icon: walletMeta.icon,
      provider
    });
  });

  walletCache = entries;
  return entries;
}

// Function to wait for wallet extensions to initialize
async function waitForWalletInitialization(timeout = 1500) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkProvider = () => {
      if (window.ethereum && (window.ethereum.providers || window.ethereum.isMetaMask || window.ethereum.isCoinbaseWallet || window.ethereum.isTrustWallet || window.ethereum.isBraveWallet || window.ethereum.isPhantom || window.ethereum.isRabby || window.ethereum.isOkxWallet || window.ethereum.isBinance || window.ethereum.isTokenPocket)) {
        resolve();
        return;
      }

      if (Date.now() - startTime >= timeout) {
        resolve();
      } else {
        setTimeout(checkProvider, 50);
      }
    };

    checkProvider();
  });
}

export async function getAvailableWallets() {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
    return [];
  }

  await waitForWalletInitialization(1500);
  return getAvailableWalletEntries().map(({ key, walletType, name, icon }) => ({ key, walletType, name, icon }));
}

// Function to detect and return the preferred provider
async function getPreferredProvider(selectedWalletType) {
  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
    return null;
  }

  await waitForWalletInitialization(1500);

  if (selectedWalletType && walletCache.length > 0) {
    const selectedFromCache = walletCache.find((entry) => entry.key === selectedWalletType || entry.walletType === selectedWalletType);
    if (selectedFromCache) {
      return selectedFromCache.provider;
    }
  }

  const entries = getAvailableWalletEntries();
  if (entries.length === 0) return null;

  if (selectedWalletType) {
    const selected = entries.find((entry) => entry.key === selectedWalletType || entry.walletType === selectedWalletType);
    if (selected) return selected.provider;
  }

  return entries[0].provider;
}

// Function to switch to Polygon network
export const switchToPolygonNetwork = async (ethereumProvider) => {
  try {
    await ethereumProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_MAINNET_CONFIG.chainId }],
    });
    return true;
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
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
      throw new Error('Network switch request already pending. Please check your wallet and approve/reject the existing request.');
    } else {
      console.error('Error switching to Polygon network:', switchError);
      throw switchError;
    }
  }
};

// Main wallet connection function
export const connectWallet = async (selectedWalletType = null) => {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available');
  }

  const ethereum = await getPreferredProvider(selectedWalletType);

  if (!ethereum) {
    throw new Error('No crypto wallet found. Please install a wallet like MetaMask, Trust Wallet, or Coinbase Wallet.');
  }

  try {
    try {
      await ethereum.request({ method: 'eth_chainId' });
    } catch (error) {
      console.error('Wallet provider is not responding:', error);
      throw new Error('Wallet provider is not responding. Please make sure your wallet is unlocked and ready before connecting.');
    }

    // Request account access before chain switch (some wallets require active account first)
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    await switchToPolygonNetwork(ethereum);

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    if (chainId !== 137) {
      throw new Error(`Please switch to Polygon Mainnet in your wallet. Current network: ${network.name || chainId}`);
    }

    try {
      await provider.getCode('0x0000000000000000000000000000000000000000');
    } catch (testError) {
      console.warn('Provider test failed, but continuing with connection:', testError);
    }

    setSharedProvider(provider);
    await initializeContract();

    return {
      address: accounts[0],
      provider,
      signer,
      ethereum
    };
  } catch (error) {
    console.error('Wallet connection error:', error);

    let errorMessage = error.message || 'Unknown wallet connection error';

    if (error.code === 4001) {
      errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
    } else if (error.code === -32002) {
      errorMessage = 'Request already pending. Check your wallet extension and approve or reject the existing request.';
    } else if (error.code === -32603) {
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

export const disconnectWallet = async () => {
  localStorage.removeItem('connectedWallet');
  return true;
};

export const isWalletConnected = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
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

export const getCurrentWalletAddress = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
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
