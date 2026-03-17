import { ethers } from 'ethers';
import { initializeContract } from '../../utils/contractManager';
import { setSharedProvider } from './providerStore';

const POLYGON_MAINNET_CONFIG = {
  chainId: '0x89',
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
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

const EIP6963_EVENT_ANNOUNCE = 'eip6963:announceProvider';
const EIP6963_EVENT_REQUEST = 'eip6963:requestProvider';

let walletCache = [];
const eip6963ProviderMap = new Map();
let announcedListenerAttached = false;

async function isProviderUnlocked(ethereum) {
  if (!ethereum) return false;

  try {
    const unlockApi = ethereum?._metamask?.isUnlocked;
    if (typeof unlockApi === 'function') {
      return await unlockApi.call(ethereum._metamask);
    }
  } catch {
    return false;
  }

  return true;
}

function safeReadStorage(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Ignore storage write failures (private mode / strict settings)
  }
}

function attachEip6963Listener() {
  if (typeof window === 'undefined' || announcedListenerAttached) return;

  window.addEventListener(EIP6963_EVENT_ANNOUNCE, (event) => {
    const detail = event?.detail;
    const provider = detail?.provider;
    if (!provider) return;

    const info = detail?.info || {};
    const rdns = info?.rdns || provider?.rdns || provider?.id || info?.name || `wallet-${eip6963ProviderMap.size + 1}`;
    eip6963ProviderMap.set(rdns, { provider, info });
  });

  announcedListenerAttached = true;
}

function waitForEip6963Providers(timeout = 400) {
  if (typeof window === 'undefined') return Promise.resolve();

  attachEip6963Listener();

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    setTimeout(finish, timeout);

    try {
      window.dispatchEvent(new Event(EIP6963_EVENT_REQUEST));
    } catch {
      finish();
    }
  });
}

function getRawProviders() {
  if (typeof window === 'undefined') return [];

  const providers = [];
  const globalEthereum = window.ethereum;

  if (globalEthereum) {
    if (Array.isArray(globalEthereum.providers) && globalEthereum.providers.length > 0) {
      providers.push(...globalEthereum.providers.map((provider) => ({ provider, info: null })));
    } else {
      providers.push({ provider: globalEthereum, info: null });
    }
  }

  eip6963ProviderMap.forEach(({ provider, info }) => {
    providers.push({ provider, info });
  });

  return providers;
}

function buildUnknownWalletKey(provider, info, index) {
  const parts = [
    info?.rdns,
    info?.name,
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

function detectWalletMetadata(provider, info, index) {
  const knownWallet = WALLET_DEFINITIONS.find((wallet) => wallet.matcher(provider));
  if (knownWallet) {
    return knownWallet;
  }

  return {
    key: buildUnknownWalletKey(provider, info, index),
    name: info?.name || provider?.name || provider?.providerName || 'Injected Wallet',
    icon: '👛'
  };
}

function getAvailableWalletEntries() {
  const providers = getRawProviders();
  const entries = [];
  const seenProvider = new Set();
  const keyCount = new Map();

  providers.forEach(({ provider, info }, index) => {
    if (!provider || seenProvider.has(provider)) return;
    seenProvider.add(provider);

    const walletMeta = detectWalletMetadata(provider, info, index);
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

async function waitForWalletInitialization(timeout = 1500) {
  if (typeof window === 'undefined') return;

  attachEip6963Listener();
  await waitForEip6963Providers(450);

  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkProvider = () => {
      if (window.ethereum || eip6963ProviderMap.size > 0) {
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
  if (typeof window === 'undefined') {
    return [];
  }

  await waitForWalletInitialization(1500);
  return getAvailableWalletEntries().map(({ key, walletType, name, icon }) => ({ key, walletType, name, icon }));
}

async function getPreferredProvider(selectedWalletType) {
  if (typeof window === 'undefined') {
    return null;
  }

  await waitForWalletInitialization(1500);

  const explicitSelection = selectedWalletType || safeReadStorage('selectedWalletType');
  if (explicitSelection && walletCache.length > 0) {
    const selectedFromCache = walletCache.find((entry) => entry.key === explicitSelection || entry.walletType === explicitSelection);
    if (selectedFromCache) {
      return selectedFromCache.provider;
    }
  }

  const entries = getAvailableWalletEntries();
  if (entries.length === 0) return null;

  if (explicitSelection) {
    const selected = entries.find((entry) => entry.key === explicitSelection || entry.walletType === explicitSelection);
    if (selected) return selected.provider;
  }

  return entries[0].provider;
}

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
        throw addError;
      }
    } else if (switchError.code === -32002) {
      throw new Error('Network switch request already pending. Please check your wallet and approve/reject the existing request.');
    } else {
      throw switchError;
    }
  }
};

export const connectWallet = async (selectedWalletType = null) => {
  if (typeof window === 'undefined') {
    throw new Error('Window object not available');
  }

  const ethereum = await getPreferredProvider(selectedWalletType);

  if (!ethereum) {
    throw new Error('No crypto wallet found. Please install a wallet app/extension and try again.');
  }

  try {
    await ethereum.request({ method: 'eth_chainId' });

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

    setSharedProvider(provider);
    await initializeContract();

    if (selectedWalletType) {
      safeWriteStorage('selectedWalletType', selectedWalletType);
    }

    safeWriteStorage('connectedWallet', accounts[0]);

    return {
      address: accounts[0],
      provider,
      signer,
      ethereum
    };
  } catch (error) {
    let errorMessage = error.message || 'Unknown wallet connection error';

    if (error.code === 4001) {
      errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
    } else if (error.code === -32002) {
      errorMessage = 'Request already pending. Check your wallet extension/app and approve or reject the existing request.';
    } else if (error.code === -32603) {
      errorMessage = 'Wallet connection failed. Please make sure your wallet is unlocked and accessible.';
    } else if (errorMessage.includes('network')) {
      errorMessage = 'Network switch failed. Please check your wallet settings and ensure Polygon network is added.';
    } else if (errorMessage.includes('user rejected')) {
      errorMessage = 'Connection was cancelled by the user. Please try again and approve the connection in your wallet.';
    }

    throw new Error(errorMessage);
  }
};


export const restoreWalletSession = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const ethereum = await getPreferredProvider();
    if (!ethereum) return null;

    const unlocked = await isProviderUnlocked(ethereum);
    if (!unlocked) return null;

    const accounts = await ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      return null;
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 137) {
      return null;
    }

    setSharedProvider(provider);
    await initializeContract();

    return {
      address: accounts[0],
      provider,
      signer,
      ethereum
    };
  } catch {
    return null;
  }
};

export const disconnectWallet = async () => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem('connectedWallet');
      window.localStorage.removeItem('selectedWalletType');
    } catch {
      // Ignore storage failures
    }
  }
  return true;
};

export const isWalletConnected = async () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const ethereum = await getPreferredProvider();
    if (!ethereum) return false;

    const unlocked = await isProviderUnlocked(ethereum);
    if (!unlocked) return false;

    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0;
  } catch {
    return false;
  }
};

export const getCurrentWalletAddress = async () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const ethereum = await getPreferredProvider();
    if (!ethereum) return null;

    const unlocked = await isProviderUnlocked(ethereum);
    if (!unlocked) return null;

    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts && accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
};
