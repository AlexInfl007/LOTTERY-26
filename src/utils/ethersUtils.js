import { ethers } from 'ethers';
import { getContractAsync, initializeContract, getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = false;
export const SUPPORTS_HISTORICAL_WINNERS = false;
const PURCHASE_METHOD_SELECTORS = [
  '0x' + ethers.id('enterRaffle()').slice(2, 10),
  '0x' + ethers.id('buyTicket()').slice(2, 10)
];
const POLYGONSCAN_TXLIST_ENDPOINT = 'https://api.polygonscan.com/api';
const TICKET_PRICE_WEI = ethers.parseEther('30');

export function updateProvider(newProvider) {
  setSharedProvider(newProvider);
}

export function updateContractInstance(newProvider) {
  setSharedProvider(newProvider);
}

export async function getCurrentProvider() {
  const provider = getSharedProvider();
  if (!provider) return null;

  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 137) return null;
    await provider.getBlockNumber();
    return provider;
  } catch {
    return null;
  }
}

export async function getCurrentContract() {
  const provider = await getCurrentProvider();
  if (!provider) return null;

  try {
    await initializeContract();
    return await getContractAsync();
  } catch {
    return null;
  }
}

export async function readPrizePool() {
  const currentContract = await getCurrentContract();
  if (!currentContract) return null;

  try {
    const raw = await currentContract.prizePool();
    return Number(ethers.formatEther(raw || 0n));
  } catch {
    return 0;
  }
}

export async function watchTicketEvents(onTicketEvent) {
  if (typeof onTicketEvent !== 'function') {
    return () => {};
  }

  const currentContract = await getCurrentContract();
  if (!currentContract) return () => {};
  const provider = await getCurrentProvider();
  const seenTx = new Set();

  const handler = async (buyer) => {
    try {
      const latestCount = await getTicketsCount();
      const timestamp = new Date().toLocaleTimeString();
      const shortAddress = buyer ? `${buyer.slice(0, 6)}...${buyer.slice(-4)}` : 'Unknown';

      onTicketEvent({
        message: `New ticket purchased • ${shortAddress} • ${timestamp}`,
        ticketsCount: typeof latestCount === 'number' ? latestCount : null
      });
    } catch {
      // Ignore event handling errors to keep subscription alive.
    }
  };

  currentContract.on('TicketBought', handler);

  const fallbackBlockHandler = async (blockNumber) => {
    if (!provider) return;

    try {
      const block = await getBlockWithTransactions(provider, blockNumber);
      if (!block?.transactions?.length) return;

      for (const tx of block.transactions) {
        const txData = tx?.data || tx?.input || '';
        const isTargetContract = tx?.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
        const isTicketLikeCall = typeof txData === 'string' && PURCHASE_METHOD_SELECTORS.some((selector) => txData.startsWith(selector));
        const valueWei = normalizeWeiValue(tx?.value);
        const isTicketLikeValue = valueWei !== null && valueWei === TICKET_PRICE_WEI;
        if (!isTargetContract || (!isTicketLikeCall && !isTicketLikeValue)) continue;
        if (seenTx.has(tx.hash)) continue;

        seenTx.add(tx.hash);
        const shortAddress = tx?.from ? `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}` : 'Unknown';
        onTicketEvent({
          message: `New ticket purchased • ${shortAddress} • ${new Date().toLocaleTimeString()}`,
          ticketsCount: null
        });
      }
    } catch {
      // Ignore fallback scanning errors.
    }
  };

  if (provider) {
    provider.on('block', fallbackBlockHandler);
  }

  return () => {
    currentContract.off('TicketBought', handler);
    if (provider) {
      provider.off('block', fallbackBlockHandler);
    }
  };
}

export async function getRecentTicketPurchases(limit = 15, blocksToScan = 120000, totalTickets = null) {
  const provider = await getCurrentProvider();
  if (!provider) return [];

  try {
    const currentContract = await getCurrentContract();
    if (currentContract) {
      const byEvents = await scanPurchasesFromTicketEvents(currentContract, provider, limit, blocksToScan, totalTickets);
      if (byEvents.length > 0) return byEvents.slice(0, limit);
    }
  } catch {
    // Fallbacks below.
  }

  const fromExplorer = await fetchPurchasesFromPolygonscan(limit);
  if (fromExplorer.length > 0) return fromExplorer.slice(0, limit);

  try {
    const byBlockScan = await scanPurchasesFromBlocks(provider, limit, blocksToScan, totalTickets);
    if (byBlockScan.length > 0) return byBlockScan.slice(0, limit);
  } catch (error) {
    console.warn('Failed to scan recent ticket purchases via RPC:', error);
  }

  return [];
}

async function scanPurchasesFromTicketEvents(contract, provider, limit, blocksToScan, totalTickets) {
  const latestBlockNumber = await provider.getBlockNumber();
  const adaptiveBlocksToScan = resolveBlocksToScan(blocksToScan, totalTickets);
  const fromBlock = Math.max(latestBlockNumber - adaptiveBlocksToScan, 0);
  const EVENT_BATCH = 3000;
  const purchases = [];

  for (let endBlock = latestBlockNumber; endBlock >= fromBlock; endBlock -= EVENT_BATCH) {
    if (purchases.length >= limit) break;
    const startBlock = Math.max(fromBlock, endBlock - EVENT_BATCH + 1);

    let events = [];
    try {
      events = await contract.queryFilter('TicketBought', startBlock, endBlock);
    } catch {
      continue;
    }

    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (purchases.length >= limit) break;
      const ev = events[i];
      const txHash = ev?.transactionHash;
      const buyer = ev?.args?.buyer;
      const blockNumber = ev?.blockNumber;

      if (!txHash || !buyer || typeof blockNumber !== 'number') continue;

      let timestamp = Date.now();
      try {
        const block = await provider.getBlock(blockNumber);
        if (block?.timestamp) {
          timestamp = Number(block.timestamp) * 1000;
        }
      } catch {
        // Keep fallback timestamp.
      }

      purchases.push({
        hash: txHash,
        from: buyer,
        blockNumber,
        timestamp
      });
    }
  }

  return purchases;
}

async function scanPurchasesFromBlocks(provider, limit, blocksToScan, totalTickets) {
  const latestBlockNumber = await provider.getBlockNumber();
  const adaptiveBlocksToScan = resolveBlocksToScan(blocksToScan, totalTickets);
  const fromBlock = Math.max(latestBlockNumber - adaptiveBlocksToScan, 0);
  const purchases = [];

  for (let blockNumber = latestBlockNumber; blockNumber >= fromBlock; blockNumber -= 1) {
    if (purchases.length >= limit) break;

    let block = null;
    try {
      block = await getBlockWithTransactions(provider, blockNumber);
    } catch {
      continue;
    }
    if (!block || !block.transactions?.length) continue;

    for (const tx of block.transactions) {
      if (purchases.length >= limit) break;
      if (!tx) continue;

      const txData = tx.data || tx.input || '';
      const isTargetContract = tx.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
      const isTicketPurchaseCall = typeof txData === 'string' && PURCHASE_METHOD_SELECTORS.some((selector) => txData.startsWith(selector));
      const valueWei = normalizeWeiValue(tx.value);
      const isTicketPurchaseByValue = valueWei !== null && valueWei === TICKET_PRICE_WEI;

      if (isTargetContract && (isTicketPurchaseCall || isTicketPurchaseByValue)) {
        purchases.push({
          hash: tx.hash,
          from: tx.from,
          blockNumber: tx.blockNumber ?? blockNumber,
          timestamp: Number(block.timestamp) * 1000
        });
      }
    }
  }

  return purchases;
}

async function fetchPurchasesFromPolygonscan(limit) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return [];

  try {
    const url = new URL(POLYGONSCAN_TXLIST_ENDPOINT);
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'txlist');
    url.searchParams.set('address', CONTRACT_ADDRESS);
    url.searchParams.set('startblock', '0');
    url.searchParams.set('endblock', '99999999');
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', String(Math.max(25, limit * 3)));
    url.searchParams.set('sort', 'desc');

    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) return [];

    const payload = await response.json();
    const rows = Array.isArray(payload?.result) ? payload.result : [];
    if (!rows.length) return [];

    const purchases = [];
    for (const tx of rows) {
      if (purchases.length >= limit) break;
      if (!tx || tx.isError === '1') continue;

      const to = String(tx.to || '').toLowerCase();
      const input = String(tx.input || '').toLowerCase();
      const functionName = String(tx.functionName || '').toLowerCase();
      const valueWei = normalizeWeiValue(tx.value);
      if (to !== CONTRACT_ADDRESS.toLowerCase()) continue;
      const isKnownSelector = PURCHASE_METHOD_SELECTORS.some((selector) => input.startsWith(selector.toLowerCase()));
      const isKnownName = functionName.includes('buyticket') || functionName.includes('enterraffle');
      const isKnownTicketValue = valueWei !== null && valueWei === TICKET_PRICE_WEI;
      if (!isKnownSelector && !isKnownName && !isKnownTicketValue) continue;

      purchases.push({
        hash: tx.hash,
        from: tx.from,
        blockNumber: Number(tx.blockNumber),
        timestamp: Number(tx.timeStamp) * 1000
      });
    }

    return purchases;
  } catch {
    return [];
  }
}

function resolveBlocksToScan(defaultBlocksToScan, totalTickets) {
  const MIN_SCAN_BLOCKS = 25000;
  const MAX_SCAN_BLOCKS = 180000;

  const baseScan = Number.isFinite(defaultBlocksToScan) ? Number(defaultBlocksToScan) : MIN_SCAN_BLOCKS;
  const estimatedByTickets = Number.isFinite(totalTickets) && totalTickets > 0
    ? totalTickets * 1500
    : MIN_SCAN_BLOCKS;

  return Math.min(MAX_SCAN_BLOCKS, Math.max(MIN_SCAN_BLOCKS, baseScan, estimatedByTickets));
}

function normalizeWeiValue(rawValue) {
  if (rawValue === undefined || rawValue === null) return null;

  try {
    if (typeof rawValue === 'bigint') return rawValue;
    if (typeof rawValue === 'number') return BigInt(rawValue);
    if (typeof rawValue === 'string' && rawValue.length > 0) return BigInt(rawValue);
    if (typeof rawValue === 'object' && typeof rawValue.toString === 'function') {
      return BigInt(rawValue.toString());
    }
  } catch {
    return null;
  }

  return null;
}

async function getBlockWithTransactions(provider, blockNumber) {
  try {
    const hexBlockNumber = `0x${blockNumber.toString(16)}`;
    const rawBlock = await provider.send('eth_getBlockByNumber', [hexBlockNumber, true]);

    if (rawBlock && Array.isArray(rawBlock.transactions)) {
      return {
        timestamp: parseBlockTimestamp(rawBlock.timestamp),
        transactions: rawBlock.transactions.map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          data: tx.input,
          value: tx.value ? BigInt(tx.value) : null,
          blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : blockNumber
        }))
      };
    }
  } catch {
    // Fallback below for providers without raw JSON-RPC support.
  }

  const block = await provider.getBlock(blockNumber, true);
  if (!block || !Array.isArray(block.transactions)) return null;

  const transactions = [];
  for (const txOrHash of block.transactions) {
    const tx = typeof txOrHash === 'string'
      ? await provider.getTransaction(txOrHash)
      : txOrHash;

    if (!tx) continue;
    transactions.push(tx);
  }

  return {
    timestamp: Number(block.timestamp),
    transactions
  };
}

function parseBlockTimestamp(timestamp) {
  if (typeof timestamp === 'string') {
    if (timestamp.startsWith('0x')) {
      return parseInt(timestamp, 16);
    }
    return Number(timestamp);
  }
  return Number(timestamp);
}

export async function watchWinnerEvents(onWinner) {
  const currentContract = await getCurrentContract();
  if (!currentContract) return () => {};

  const handler = (winner, amount, round) => {
    onWinner({
      address: winner,
      amount: ethers.formatEther(amount),
      round: Number(round)
    });
  };

  currentContract.on('WinnerPicked', handler);
  return () => currentContract.off('WinnerPicked', handler);
}

export async function watchPrizePoolUpdates() {
  // В контракте нет отдельного события изменения пула. Используем polling из App.
  return () => {};
}

export async function buyTicket(signer) {
  try {
    const contractWithSigner = await getContractWithSigner(signer);
    const userAddress = await signer.getAddress();
    const userBalance = await signer.provider.getBalance(userAddress);
    const ticketPrice = ethers.parseEther('30');

    if (userBalance < ticketPrice) {
      throw new Error(`Insufficient balance. Need 30 POL but only have ${(Number(ethers.formatEther(userBalance))).toFixed(4)} POL`);
    }

    let tx;
    if (typeof contractWithSigner.buyTicket === 'function') {
      tx = await contractWithSigner.buyTicket({
        value: ticketPrice,
        gasLimit: 500000
      });
    } else if (typeof contractWithSigner.enterRaffle === 'function') {
      tx = await contractWithSigner.enterRaffle({
        value: ticketPrice,
        gasLimit: 500000
      });
    } else {
      throw new Error('Contract does not expose buyTicket() or enterRaffle()');
    }

    const receipt = await tx.wait();
    if (receipt?.status !== 1) {
      throw new Error('Transaction failed: Receipt status is 0');
    }

    return { success: true, transaction: tx, receipt };
  } catch (e) {
    return {
      success: false,
      error: e.reason || e.message || 'Transaction failed',
      code: e.code,
      data: e.data,
      rawError: e
    };
  }
}

export async function getUserTickets(walletAddress) {
  const currentContract = await getCurrentContract();
  if (!currentContract) return 0;

  try {
    const ticketCount = await currentContract.ticketsOf(walletAddress);
    return Number(ticketCount || 0n);
  } catch {
    return 0;
  }
}

export async function getTicketsCount() {
  const currentContract = await getCurrentContract();
  if (!currentContract) return null;

  try {
    const raw = await currentContract.ticketsCount();
    return Number(raw || 0n);
  } catch {
    return 0;
  }
}

export async function getRecentWinners() {
  const provider = await getCurrentProvider();
  if (!provider) return null;

  const currentContract = await getCurrentContract();
  if (!currentContract) return [];

  const latestBlockNumber = await provider.getBlockNumber();
  const fromBlock = Math.max(latestBlockNumber - 60000, 0);

  try {
    const logs = await currentContract.queryFilter('WinnerPicked', fromBlock, latestBlockNumber);
    return logs
      .slice(-15)
      .reverse()
      .map((log) => ({
        address: log.args?.winner,
        amount: ethers.formatEther(log.args?.prize || 0n),
        round: Number(log.args?.round || 0)
      }));
  } catch {
    return [];
  }
}
