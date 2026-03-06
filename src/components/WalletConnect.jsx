import React, { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { updateProvider, updateContractInstance } from '../utils/ethersUtils';
import { connectWallet, isWalletConnected, getCurrentWalletAddress, getAvailableWallets } from '../utils/walletConnector';

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    const loadWallets = async () => {
      const availableWallets = await getAvailableWallets();
      setWallets(availableWallets);
    };

    loadWallets();

    const handleFocus = () => loadWallets();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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

  const connect = async (walletType = null) => {
    if (typeof window === "undefined") return;

    setCheckingWallet(true);

    try {
      const connectionResult = await connectWallet(walletType);

      setAddress(connectionResult.address);
      setConnected(true);
      setShowWalletModal(false);

      updateProvider(connectionResult.provider);
      updateContractInstance(connectionResult.provider);

      onConnect && onConnect(connectionResult.address, connectionResult.provider, connectionResult.signer);
    } catch (error) {
      console.error("Wallet connection error:", error);
      const userMessage = error.message.includes('No active wallet found')
        ? "Wallet connection failed. Please make sure your wallet is unlocked and connected to the Polygon network. If using MetaMask, check that it's properly installed and enabled."
        : error.message;
      alert(`Wallet connection failed: ${userMessage}`);
    } finally {
      setCheckingWallet(false);
    }
  };

  const openWalletSelector = async () => {
    const availableWallets = await getAvailableWallets();
    setWallets(availableWallets);

    if (availableWallets.length <= 1) {
      await connect(availableWallets[0]?.walletType ?? null);
      return;
    }

    setShowWalletModal(true);
  };

  return (
    <>
      <button
        onClick={openWalletSelector}
        className={styles.connectButton}
        disabled={checkingWallet}
      >
        <span>🔒</span>
        {checkingWallet
          ? t("processing", "Processing...")
          : connected
            ? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : t("connected", "Connected"))
            : t("connectWallet", "Connect Wallet")}
      </button>

      {showWalletModal && (
        <div className={styles.modalOverlay} onClick={() => !checkingWallet && setShowWalletModal(false)}>
          <div className={styles.walletModal} onClick={(event) => event.stopPropagation()}>
            <h3>{t("selectWallet", "Select wallet")}</h3>
            <div className={styles.walletList}>
              {wallets.map((wallet) => (
                <button
                  type="button"
                  key={wallet.key}
                  className={styles.walletOption}
                  onClick={() => connect(wallet.key)}
                  disabled={checkingWallet}
                >
                  <span className={styles.walletIcon}>{wallet.icon}</span>
                  <span className={styles.walletName}>{wallet.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => setShowWalletModal(false)}
              disabled={checkingWallet}
            >
              {t("cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
