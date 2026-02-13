import React, { useEffect, useState } from 'react';
import { createWeb3Modal, defaultConfig } from '@web3modal/wagmi/react';

import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism } from 'viem/chains';

// 1. Get projectId at https://cloud.walletconnect.com
const projectId = '77a1df23d7b687756e7e0ad4d5ee3e9a1f08d5f803519275858789641edc00b0'; // Используем тестовый Project ID для WalletConnect

// 2. Configure wagmi client
const metadata = {
  name: 'Seren Lottery',
  description: 'Seren Lottery Platform',
  url: 'https://seren-lottery.com', // URL вашего приложения
  icons: ['https://seren-lottery.com/favicon.ico']
};

const chains = [mainnet, polygon, arbitrum, optimism];

const wagmiConfig = createConfig({
  chains,
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: false
});

// 3. Create modal
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  metadata,
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent-color': '#62688F',
    '--w3m-font-family': 'Inter, sans-serif'
  }
});

export default function Web3Modal({ children }) {
  return children;
}

export function useWeb3Modal() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [chain, setChain] = useState(null);

  useEffect(() => {
    import('@web3modal/wagmi').then(module => {
      const { subscribeConnectors } = module;
      
      const unsubscribe = subscribeConnectors(state => {
        const connected = state?.length > 0 && state.some(connector => connector.connected === true);
        setIsConnected(connected);
        
        if (connected) {
          const activeConnector = state.find(connector => connector.connected === true);
          setAddress(activeConnector.accounts?.[0] || null);
          setChain(activeConnector.chainId ? { id: activeConnector.chainId } : null);
        } else {
          setAddress(null);
          setChain(null);
        }
      });
      
      return () => unsubscribe();
    });
  }, []);

  return { isConnected, address, chain };
}