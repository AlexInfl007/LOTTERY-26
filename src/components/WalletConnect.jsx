import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { useWeb3Modal } from './Web3Modal';
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { BrowserProvider } from 'ethers';

// Функция для переключения на сеть Polygon
async function switchToPolygonNetwork(provider) {
  const polygonChainParams = {
    chainId: '0x89', // 137 в десятичной системе
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
    // Попробовать переключиться на сеть Polygon
    await provider.send('wallet_switchEthereumChain', [{ chainId: polygonChainParams.chainId }]);
  } catch (switchError) {
    // Этот код ошибки указывает на то, что цепочка не добавлена в MetaMask
    if (switchError.code === 4902) {
      try {
        // Добавить сеть Polygon в кошелек
        await provider.send('wallet_addEthereumChain', [polygonChainParams]);
      } catch (addError) {
        console.error('Ошибка при добавлении сети Polygon:', addError);
        throw addError;
      }
    } else {
      console.error('Ошибка при переключении на сеть Polygon:', switchError);
      throw switchError;
    }
  }
}

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const { address, isConnected, chain } = useWeb3Modal();
  const { connect, connectors, isLoading, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Получаем экземпляр провайдера через wagmi
  const wagmiAccount = useAccount();
  const chainId = useChainId();

  // Обработка подключения
  const handleConnect = async (connector) => {
    try {
      setIsConnecting(true);
      
      // Подключаем выбранный кошелек
      const result = await connect({ connector });
      
      if (result) {
        // Создаем провайдер после успешного подключения
        const provider = new BrowserProvider(wagmiAccount.connector.provider);
        
        // Переключаем на сеть Polygon
        await switchToPolygonNetwork(provider);
        
        // Получаем signer
        const signer = await provider.getSigner();
        
        // Вызываем переданную функцию обратного вызова
        onConnect && onConnect(result.account, provider, signer);
      }
    } catch (err) {
      console.error("Ошибка подключения:", err);
      alert(`Ошибка подключения: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Определение текста кнопки в зависимости от состояния
  const renderContent = () => {
    if (isConnected && address) {
      return (
        <>
          <span>🔒</span>
          {`${address.slice(0,6)}…${address.slice(-4)}`}
        </>
      );
    } else if (isConnecting || isLoading) {
      return (
        <>
          <span>⏳</span>
          {t("connecting","Подключение...")}
        </>
      );
    } else {
      return (
        <>
          <span>🔒</span>
          {t("connectWallet","Подключить кошелек")}
        </>
      );
    }
  };

  // Открытие модального окна Web3Modal при клике, если не подключен
  const handleClick = () => {
    if (!isConnected) {
      // Используем глобальную функцию от Web3Modal для открытия
      import('@web3modal/wagmi').then(module => {
        module.open();
      });
    } else {
      // При клике на уже подключенный кошелек можно предложить отключиться
      if (window.confirm('Вы хотите отключить кошелек?')) {
        disconnect();
        onConnect && onConnect(null, null, null);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={styles.connectButton}
    >
      {renderContent()}
    </button>
  );
}
