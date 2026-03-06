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

const PROVIDER_PRIORITY = [
  'isMetaMask',
  'isCoinbaseWallet',
  'isTrustWallet',
  'isBraveWallet',
  'isRabby',
  'isOkxWallet',
  'isBinance',
  'isTokenPocket',
  'isPhantom',
  'isAvalanche',
  'isBitKeep',
  'isTokenary'
];

function getProviderScore(provider) {
  if (!provider) return -1;

  // Prefer providers that already expose an active account
  if (provider.selectedAddress) return 100;

  for (let i = 0; i < PROVIDER_PRIORITY.length; i += 1) {
    if (provider[PROVIDER_PRIORITY[i]]) {
      return 90 - i;
    }
  }

  return 10;
}

function listProviderCandidates() {
  if (typeof window === 'undefined' || !window.ethereum) {
    return [];
  }

  const providers = Array.isArray(window.ethereum.providers)
    ? window.ethereum.providers
    : [window.ethereum];

  const uniqueProviders = [];
  const seen = new Set();

  for (const provider of providers) {
    if (!provider || typeof provider.request !== 'function') continue;
    if (seen.has(provider)) continue;
    seen.add(provider);
    uniqueProviders.push(provider);
  }

  uniqueProviders.sort((a, b) => getProviderScore(b) - getProviderScore(a));
  return uniqueProviders;
}

// Function to wait for wallet extensions to initialize
async function waitForWalletInitialization(timeout = 1500) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    // Using a recursive setTimeout pattern instead of setInterval to avoid CSP issues
    const checkProvider = () => {
      if (window.ethereum && (window.ethereum.providers || window.ethereum.request)) {
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

async function connectWithProvider(ethereum) {
  // Request account access first: some wallets reject other methods before authorization
  const accounts = await ethereum.request({
    method: 'eth_requestAccounts'
  });

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts returned from wallet');
  }

  await switchToPolygonNetwork(ethereum);

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  // Verify that the provider is on the correct network (Polygon)
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 137) {
    throw new Error(`Please switch to Polygon Mainnet in your wallet. Current network: ${network.name || chainId}`);
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
}

// Main wallet connection function
export const connectWallet = async () => {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available');
  }

  await waitForWalletInitialization(1500);
  const candidates = listProviderCandidates();

  if (candidates.length === 0) {
    throw new Error('No crypto wallet found. Please install a wallet like MetaMask, Trust Wallet, or Coinbase Wallet.');
  }

  let lastError = null;

  for (const ethereum of candidates) {
    try {
      return await connectWithProvider(ethereum);
    } catch (error) {
      lastError = error;

      // If user rejected or has pending approval, do not auto-jump to another wallet
      if (error?.code === 4001 || error?.code === -32002) {
        throw error;
      }

      console.warn('Wallet candidate failed, trying next provider:', {
        code: error?.code,
        message: error?.message
      });
    }
  }

  const error = lastError || new Error('Unknown wallet connection error');
  console.error('Wallet connection error:', error);

  // More specific error handling
  let errorMessage = error.message || 'Unknown wallet connection error';

  if (error.code === 4001) {
    errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
  } else if (error.code === -32002) {
    errorMessage = 'Request already pending. Check your wallet extension and approve or reject the existing request.';
  } else if (error.code === -32603) {
    errorMessage = 'Wallet provider returned an internal error (No active wallet found). Open your wallet extension/app, unlock it, select an active account, then retry.';
  } else if (error.code === -32075) {
    errorMessage = 'Method disabled. This may be due to browser restrictions or wallet configuration.';
  } else if (errorMessage.includes('network')) {
    errorMessage = 'Network switch failed. Please check your wallet settings and ensure Polygon network is added.';
  } else if (errorMessage.includes('user rejected')) {
    errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
  } else if (errorMessage.includes('invalid json rpc')) {
    errorMessage = 'Invalid JSON-RPC response. Make sure your wallet is unlocked and properly configured.';
  } else if (errorMessage.includes('No active wallet found')) {
    errorMessage = 'No active wallet found. Open your wallet and choose an active account before connecting.';
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
  if (typeof window === 'undefined' || !window.ethereum) {
    return false;
  }

  try {
    const providers = listProviderCandidates();

    for (const provider of providers) {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          return true;
        }
      } catch {
        // ignore and try next provider
      }
    }

    return false;
  } catch (error) {
    console.warn('Error checking wallet connection:', error);
    return false;
  }
};

// Function to get current wallet address
export const getCurrentWalletAddress = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  try {
    const providers = listProviderCandidates();

    for (const provider of providers) {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          return accounts[0];
        }
      } catch {
        // ignore and try next provider
      }
    }

    return null;
  } catch (error) {
    console.warn('Error getting current wallet address:', error);
    return null;
  }
};
