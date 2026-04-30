import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import styles from "../styles/Home.module.css";
import { useTranslation } from "react-i18next";
import { updateProvider, updateContractInstance } from '../utils/ethersUtils';
import { connectWallet, isWalletConnected, getCurrentWalletAddress, getAvailableWallets, restoreWalletSession } from '../utils/walletConnector';

const MOBILE_WALLET_LINKS = [
  { key: 'metamask-mobile', icon: '🦊', name: 'MetaMask', getUrl: (dappUrl) => `https://metamask.app.link/dapp/${dappUrl.replace(/^https?:\/\//, '')}` },
  { key: 'trust-mobile', icon: '🛡️', name: 'Trust Wallet', getUrl: (dappUrl) => `https://link.trustwallet.com/open_url?coin_id=966&url=${encodeURIComponent(dappUrl)}` },
  { key: 'coinbase-mobile', icon: '🟦', name: 'Coinbase Wallet', getUrl: (dappUrl) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(dappUrl)}` },
  { key: 'okx-mobile', icon: '⭕', name: 'OKX Wallet', getUrl: (dappUrl) => `https://www.okx.com/web3/dapp/details?dappUrl=${encodeURIComponent(dappUrl)}` }
];

export default function WalletConnect({ onConnect }) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);


  useEffect(() => {
    if (!showWalletModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showWalletModal]);

  const dappUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, []);

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
        if (!isConnected) {
          setConnected(false);
          setAddress(null);
          return;
        }

        const restoredSession = await restoreWalletSession();
        if (restoredSession?.address) {
          setAddress(restoredSession.address);
          setConnected(true);
          onConnect && onConnect(restoredSession.address, restoredSession.provider, restoredSession.signer);
          return;
        }

        const currentAddress = await getCurrentWalletAddress();
        if (currentAddress) {
          const restoredSession = await restoreWalletSession();
          if (restoredSession?.address) {
            setAddress(restoredSession.address);
            setConnected(true);
            updateProvider(restoredSession.provider);
            updateContractInstance(restoredSession.provider);
            onConnect && onConnect(restoredSession.address, restoredSession.provider, restoredSession.signer);
            return;
          }
        }

        setConnected(false);
        setAddress(null);
      } catch {
        setConnected(false);
        setAddress(null);
      }
    };

    checkExistingConnection();

    if (!window.ethereum) return undefined;

    const onAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setConnected(false);
        setAddress(null);
        return;
      }

      try {
        const restoredSession = await restoreWalletSession();
        if (restoredSession?.provider && restoredSession?.signer && restoredSession?.address) {
          setConnected(true);
          setAddress(restoredSession.address);
          updateProvider(restoredSession.provider);
          updateContractInstance(restoredSession.provider);
          onConnect && onConnect(restoredSession.address, restoredSession.provider, restoredSession.signer);
          return;
        }
      } catch {
        // fall through to disconnected state
      }

      setConnected(false);
      setAddress(null);
    };

    const onChainChanged = () => {
      window.location.reload();
    };

    const onVisibilityOrFocus = () => {
      checkExistingConnection();
    };

    window.ethereum.on?.('accountsChanged', onAccountsChanged);
    window.ethereum.on?.('chainChanged', onChainChanged);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', onAccountsChanged);
      window.ethereum?.removeListener?.('chainChanged', onChainChanged);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [onConnect]);

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
      const userMessage = error.message.includes('No active wallet found')
        ? "Wallet connection failed. Please make sure your wallet is unlocked and connected to the Polygon network."
        : error.message;
      alert(`Wallet connection failed: ${userMessage}`);
    } finally {
      setCheckingWallet(false);
    }
  };

  const openWalletSelector = async () => {
    const availableWallets = await getAvailableWallets();
    setWallets(availableWallets);
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

      {showWalletModal && typeof document !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={() => !checkingWallet && setShowWalletModal(false)}>
          <div className={styles.walletModal} onClick={(event) => event.stopPropagation()}>
            <h3>{t("selectWallet", "Select wallet")}</h3>

            <div className={styles.walletSectionTitle}>{t('walletBrowserOptions', 'Available in this browser')}</div>
            {wallets.length > 0 ? (
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
                    <span className={styles.walletMeta}>{t('walletDetected', 'Detected')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.walletHint}>
                {t('walletNotDetected', 'No injected wallet detected in this browser.')}
              </div>
            )}

            <div className={styles.walletSectionTitle}>{t('walletMobileOptions', 'Open dApp in wallet app (mobile/tablet)')}</div>
            <div className={styles.walletList}>
              {MOBILE_WALLET_LINKS.map((wallet) => (
                <a
                  key={wallet.key}
                  className={styles.walletOption}
                  href={wallet.getUrl(dappUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className={styles.walletIcon}>{wallet.icon}</span>
                  <span className={styles.walletName}>{wallet.name}</span>
                  <span className={styles.walletMeta}>{t('walletOpen', 'Open')}</span>
                </a>
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
        </div>,
        document.body
      )}
    </>
  );
}
