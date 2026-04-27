import { ethers } from 'ethers';
import { getContractAsync, initializeContract, getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = false;
export const SUPPORTS_HISTORICAL_WINNERS = false;
const PURCHASE_METHOD_SELECTORS = [
  '0x' + ethers.id('enterRaffle()').slice(2, 10),
  '0x' + ethers.id('buyTicket()').slice(2, 10)
];
const POLYGONSCAN_TXLIST_ENDPOINT = 'https://api.polygonscan.com/api';
const TICKET_BOUGHT_TOPIC = ethers.id('TicketBought(address,uint256)');
const TICKET_PRICE_WEI = ethers.parseEther('30');
const POLYGONSCAN_PAGE_SIZE = 1000;
const POLYGONSCAN_MAX_PAGES = 30;
let injectedProvider = null;
let deploymentBlockCache = null;
let ticketHistoryCache = {
  updatedAt: 0,
  total: null,
  perUser: new Map()
};

function buildExplorerUrl(params = {}) {
  const isBrowser = typeof window !== 'undefined' && window.location?.origin;
  const base = isBrowser
    ? new URL('/api/polygonscan', window.location.origin)
    : new URL(POLYGONSCAN_TXLIST_ENDPOINT);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      base.searchParams.set(key, String(value));
    }
  });

  return base.toString();
}

function buildTicketStatsUrl(params = {}) {
  const isBrowser = typeof window !== 'undefined' && window.location?.origin;
  const base = isBrowser
    ? new URL('/api/ticket-stats', window.location.origin)
    : null;

  if (!base) return null;

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      base.searchParams.set(key, String(value));
    }
  });

  return base.toString();
}

export function updateProvider(newProvider) {
  setSharedProvider(newProvider);
  injectedProvider = null;
}

export function updateContractInstance(newProvider) {
  setSharedProvider(newProvider);
}

export async function fetchTicketStatsSnapshot(address = null, limit = 50) {
  const provider = await getCurrentProvider();
  if (!provider) return null;

  try {
    const totalTickets = await getTicketsCount();
    const myTickets = address ? await getUserTickets(address) : null;
    const recentEvents = await getRecentTicketEvents(limit);
    return { totalTickets, myTickets, recentEvents, source: 'wallet-provider' };
  } catch {
    return null;
  }
}

export async function getCurrentProvider() {
  const provider = getSharedProvider() || await getInjectedProvider();
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

async function getInjectedProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  if (injectedProvider) return injectedProvider;

  try {
    injectedProvider = new ethers.BrowserProvider(window.ethereum);
    return injectedProvider;
  } catch {
    return null;
  }
}

async function getReadProvider() {
  return await getCurrentProvider();
}

async function getReadContract() {
  const provider = await getReadProvider();
  if (!provider) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
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
  try {
    const currentContract = await getReadContract();
    if (!currentContract) throw new Error('Contract unavailable');
    const raw = await currentContract.prizePool();
    return Number(ethers.formatEther(raw || 0n));
  } catch {
    try {
      const [raw] = await callViaPolygonscan('prizePool', []);
      return Number(ethers.formatEther(raw || 0n));
    } catch {
      return 0;
    }
  }
}

export async function watchTicketEvents(onTicketEvent) {
  if (typeof onTicketEvent !== 'function') {
    return () => {};
  }

  const currentContract = await getReadContract();
  const provider = await getReadProvider();
  const seenTx = new Set();
  const seenLogIds = new Set();
  let lastObservedBlock = null;

  const handler = async (buyer, round) => {
    const timestamp = Date.now();
    let latestCount = null;

    try {
      latestCount = await getTicketsCount();
    } catch {
      latestCount = null;
    }

    onTicketEvent({
      buyer,
      round: Number(round ?? 0),
      timestamp,
      ticketsCount: typeof latestCount === 'number' ? latestCount : null
    });
  };

  if (currentContract) {
    currentContract.on('TicketBought', handler);
  }

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
        onTicketEvent({
          buyer: tx?.from || null,
          round: null,
          timestamp: Date.now(),
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

  if (provider) {
    try {
      lastObservedBlock = await provider.getBlockNumber();
    } catch {
      lastObservedBlock = null;
    }
  }

  const pollInterval = setInterval(async () => {
    try {
      let combinedEvents = [];
      if (provider && Number.isFinite(lastObservedBlock)) {
        const latest = await provider.getBlockNumber();
        if (latest > lastObservedBlock) {
          const fromBlock = Math.max(0, lastObservedBlock - 2);
          combinedEvents = await fetchTicketEventsFromProvider(provider, 100, fromBlock, latest);
          lastObservedBlock = latest;
        }
      } else {
        const recentEvents = await fetchTicketEventsFromPolygonscan(25);
        const fallbackTransfers = recentEvents.length === 0
          ? mapPurchasesToFeedEvents(await fetchPurchasesFromPolygonscan(25))
          : [];
        combinedEvents = [...recentEvents, ...fallbackTransfers];
      }

      for (const eventItem of combinedEvents.reverse()) {
        if (!eventItem?.id || seenLogIds.has(eventItem.id)) continue;
        seenLogIds.add(eventItem.id);
        onTicketEvent({
          buyer: eventItem.buyer,
          round: eventItem.round,
          timestamp: eventItem.timestamp,
          ticketsCount: null
        });
      }
    } catch {
      // Ignore explorer polling errors.
    }
  }, 12000);

  return () => {
    if (currentContract) {
      currentContract.off('TicketBought', handler);
    }
    if (provider) {
      provider.off('block', fallbackBlockHandler);
    }
    clearInterval(pollInterval);
  };
}

export async function getRecentTicketEvents(limit = 50) {
  const provider = await getReadProvider();
  if (provider) {
    try {
      const providerEvents = await fetchTicketEventsFromProvider(provider, limit);
      if (providerEvents.length > 0) {
        return providerEvents;
      }
    } catch {
      // Continue to explorer fallbacks.
    }
  }

  try {
    const explorerEvents = await fetchTicketEventsFromPolygonscan(limit);
    if (explorerEvents.length > 0) {
      return explorerEvents;
    }

    const transferEvents = mapPurchasesToFeedEvents(await fetchPurchasesFromPolygonscan(limit));
    if (transferEvents.length > 0) {
      return transferEvents;
    }
  } catch {
    // Continue with RPC fallback.
  }

  const currentContract = await getReadContract();
  if (!provider || !currentContract) {
    return mapPurchasesToFeedEvents(await getRecentTicketPurchases(limit, 120000, null)).slice(0, limit);
  }

  const latestBlockNumber = await provider.getBlockNumber();
  const EVENT_BATCH = 3000;
  const MAX_SCAN_BLOCKS = 250000;
  const MIN_BLOCK = Math.max(0, latestBlockNumber - MAX_SCAN_BLOCKS);
  let consecutiveFailures = 0;
  const events = [];

  for (let endBlock = latestBlockNumber; endBlock >= MIN_BLOCK; endBlock -= EVENT_BATCH) {
    if (events.length >= limit) break;
    const startBlock = Math.max(MIN_BLOCK, endBlock - EVENT_BATCH + 1);

    let batch = [];
    try {
      batch = await currentContract.queryFilter('TicketBought', startBlock, endBlock);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 5) {
        break;
      }
      continue;
    }

    for (let i = batch.length - 1; i >= 0; i -= 1) {
      if (events.length >= limit) break;
      const ev = batch[i];
      const buyer = ev?.args?.buyer || null;
      const round = ev?.args?.round !== undefined ? Number(ev.args.round) : null;
      const blockNumber = ev?.blockNumber;

      let timestamp = Date.now();
      if (typeof blockNumber === 'number') {
        try {
          const block = await provider.getBlock(blockNumber);
          if (block?.timestamp) timestamp = Number(block.timestamp) * 1000;
        } catch {
          // keep fallback timestamp
        }
      }

      events.push({
        id: `${ev?.transactionHash || 'tx'}:${ev?.index ?? i}`,
        buyer,
        round,
        timestamp
      });
    }
  }

  if (events.length > 0) return events;

  return mapPurchasesToFeedEvents(await getRecentTicketPurchases(limit, 120000, null)).slice(0, limit);
}

async function fetchTicketEventsFromProvider(provider, limit = 50, fromBlock = null, toBlock = null) {
  const latestBlock = Number.isFinite(toBlock) ? toBlock : await provider.getBlockNumber();
  const batchSize = 5000;
  const minBlock = Number.isFinite(fromBlock) ? Math.max(0, fromBlock) : Math.max(0, latestBlock - 250000);
  const blockTimestamps = new Map();
  const events = [];

  for (let end = latestBlock; end >= minBlock && events.length < limit; end -= batchSize) {
    const start = Math.max(minBlock, end - batchSize + 1);
    let logs = [];
    try {
      logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        topics: [TICKET_BOUGHT_TOPIC],
        fromBlock: start,
        toBlock: end
      });
    } catch {
      continue;
    }

    for (let i = logs.length - 1; i >= 0 && events.length < limit; i -= 1) {
      const parsed = parseTicketBoughtLog(logs[i], i);
      if (!parsed) continue;

      const blockNumber = Number(logs[i]?.blockNumber);
      if (!blockTimestamps.has(blockNumber)) {
        try {
          const block = await provider.getBlock(blockNumber);
          blockTimestamps.set(blockNumber, block?.timestamp ? Number(block.timestamp) * 1000 : Date.now());
        } catch {
          blockTimestamps.set(blockNumber, Date.now());
        }
      }

      events.push({
        ...parsed,
        timestamp: blockTimestamps.get(blockNumber)
      });
    }
  }

  return events;
}

function parseTicketBoughtLog(log, index = 0) {
  const buyerTopic = Array.isArray(log?.topics) ? log.topics[1] : null;
  const roundTopic = Array.isArray(log?.topics) ? log.topics[2] : null;
  if (!buyerTopic) return null;

  try {
    const buyer = ethers.getAddress(`0x${buyerTopic.slice(-40)}`);
    const round = roundTopic ? Number(BigInt(roundTopic)) : null;
    return {
      id: `${log?.transactionHash || 'tx'}:${log?.index ?? log?.logIndex ?? index}`,
      buyer,
      round
    };
  } catch {
    return null;
  }
}

function mapPurchasesToFeedEvents(purchases = []) {
  return purchases.map((purchase) => ({
    id: purchase?.hash ? `${purchase.hash}:tx` : `purchase:${purchase?.blockNumber || Date.now()}`,
    buyer: purchase?.from || null,
    round: null,
    timestamp: purchase?.timestamp || Date.now()
  }));
}

export async function getRecentTicketPurchases(limit = 15, blocksToScan = 120000, totalTickets = null) {
  const provider = await getReadProvider();
  if (!provider) return [];

  try {
    const currentContract = await getReadContract();
    if (currentContract) {
      const quickEvents = await scanRecentTicketEventsQuick(currentContract, provider, limit);
      if (quickEvents.length > 0) return quickEvents.slice(0, limit);

      const byEvents = await scanPurchasesFromTicketEvents(currentContract, provider, limit, blocksToScan, totalTickets);
      if (byEvents.length > 0) return byEvents.slice(0, limit);
    }
  } catch {
    // Fallbacks below.
  }

  const fromExplorer = await fetchPurchasesFromPolygonscan(limit);
  if (fromExplorer.length > 0) return fromExplorer.slice(0, limit);

  try {
    const byBlockScan = await scanPurchasesFromBlocks(provider, limit, Math.min(blocksToScan, 5000), totalTickets);
    if (byBlockScan.length > 0) return byBlockScan.slice(0, limit);
  } catch (error) {
    console.warn('Failed to scan recent ticket purchases via RPC:', error);
  }

  return [];
}

async function scanRecentTicketEventsQuick(contract, provider, limit) {
  const latestBlockNumber = await provider.getBlockNumber();
  const QUICK_SCAN_BLOCKS = 5000;
  const fromBlock = Math.max(latestBlockNumber - QUICK_SCAN_BLOCKS, 0);
  let events = [];

  try {
    events = await contract.queryFilter('TicketBought', fromBlock, latestBlockNumber);
  } catch {
    return [];
  }

  const purchases = [];
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

  return purchases;
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
    const response = await fetch(buildExplorerUrl({
      module: 'account',
      action: 'txlist',
      address: CONTRACT_ADDRESS,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: Math.max(25, limit * 3),
      sort: 'desc'
    }), { method: 'GET' });
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

async function fetchAllTicketPurchasesFromPolygonscan() {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return [];

  const purchases = [];
  const seenHashes = new Set();

  for (let page = 1; page <= POLYGONSCAN_MAX_PAGES; page += 1) {
    try {
      const response = await fetch(buildExplorerUrl({
        module: 'account',
        action: 'txlist',
        address: CONTRACT_ADDRESS,
        startblock: 0,
        endblock: 99999999,
        page,
        offset: POLYGONSCAN_PAGE_SIZE,
        sort: 'asc'
      }), { method: 'GET' });

      if (!response.ok) break;
      const payload = await response.json();
      const rows = Array.isArray(payload?.result) ? payload.result : [];
      if (!rows.length) break;

      for (const tx of rows) {
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

        const hash = tx.hash ? String(tx.hash) : null;
        if (!hash || seenHashes.has(hash)) continue;
        seenHashes.add(hash);

        purchases.push({
          hash,
          from: tx.from ? ethers.getAddress(tx.from) : null,
          blockNumber: Number(tx.blockNumber),
          timestamp: Number(tx.timeStamp) * 1000
        });
      }

      if (rows.length < POLYGONSCAN_PAGE_SIZE) break;
    } catch {
      break;
    }
  }

  return purchases;
}

async function fetchTicketEventsFromPolygonscan(limit = 50) {
  if (typeof fetch !== 'function') return [];

  try {
    const response = await fetch(buildExplorerUrl({
      module: 'logs',
      action: 'getLogs',
      fromBlock: 0,
      toBlock: 'latest',
      address: CONTRACT_ADDRESS,
      topic0: TICKET_BOUGHT_TOPIC,
      page: 1,
      offset: Math.max(20, limit)
    }), { method: 'GET' });
    if (!response.ok) return [];

    const payload = await response.json();
    const logs = Array.isArray(payload?.result) ? payload.result : [];
    if (!logs.length) return [];

    return logs
      .slice(-limit)
      .reverse()
      .map((log, index) => {
        const buyerTopic = Array.isArray(log?.topics) ? log.topics[1] : null;
        const roundTopic = Array.isArray(log?.topics) ? log.topics[2] : null;
        const buyer = buyerTopic ? ethers.getAddress(`0x${buyerTopic.slice(-40)}`) : null;
        const round = roundTopic ? Number(BigInt(roundTopic)) : null;
        const rawTs = log?.timeStamp;
        const ts = typeof rawTs === 'string'
          ? (rawTs.startsWith('0x') ? parseInt(rawTs, 16) : Number(rawTs))
          : NaN;

        return {
          id: `${log?.transactionHash || 'tx'}:${log?.logIndex ?? index}`,
          buyer,
          round,
          timestamp: Number.isFinite(ts) ? ts * 1000 : Date.now()
        };
      });
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

async function resolveDeploymentBlock(provider) {
  if (Number.isFinite(deploymentBlockCache)) {
    return deploymentBlockCache;
  }

  try {
    const latest = await provider.getBlockNumber();
    const latestCode = await provider.getCode(CONTRACT_ADDRESS, latest);
    if (!latestCode || latestCode === '0x') {
      return Math.max(0, latest - 2000000);
    }

    let lo = 0;
    let hi = latest;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const code = await provider.getCode(CONTRACT_ADDRESS, mid);
      if (code && code !== '0x') {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    deploymentBlockCache = lo;
    return lo;
  } catch {
    const latest = await provider.getBlockNumber();
    return Math.max(0, latest - 2000000);
  }
}

async function rebuildTicketHistoryFromLogs() {
  const provider = await getReadProvider();
  if (!provider) {
    return { total: null, perUser: new Map() };
  }

  const latest = await provider.getBlockNumber();
  const fromBlock = await resolveDeploymentBlock(provider);
  const batchSize = 50000;
  let total = 0;
  const perUser = new Map();

  for (let start = fromBlock; start <= latest; start += batchSize) {
    const end = Math.min(latest, start + batchSize - 1);
    let logs = [];

    try {
      logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: start,
        toBlock: end,
        topics: [TICKET_BOUGHT_TOPIC]
      });
    } catch {
      continue;
    }

    total += logs.length;

    for (const log of logs) {
      const buyerTopic = Array.isArray(log?.topics) ? log.topics[1] : null;
      if (!buyerTopic) continue;

      try {
        const buyer = ethers.getAddress(`0x${buyerTopic.slice(-40)}`).toLowerCase();
        perUser.set(buyer, (perUser.get(buyer) || 0) + 1);
      } catch {
        // Ignore malformed logs.
      }
    }
  }

  ticketHistoryCache = {
    updatedAt: Date.now(),
    total,
    perUser
  };

  return ticketHistoryCache;
}

async function getTicketHistoryFromLogs(maxAgeMs = 180000) {
  const isFresh = ticketHistoryCache.total !== null && (Date.now() - ticketHistoryCache.updatedAt) < maxAgeMs;
  if (isFresh) return ticketHistoryCache;
  return rebuildTicketHistoryFromLogs();
}

export async function watchWinnerEvents(onWinner) {
  const currentContract = await getReadContract();
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
  const normalizedAddress = walletAddress ? walletAddress.toLowerCase() : null;

  try {
    const currentContract = await getReadContract();
    if (!currentContract) throw new Error('Contract unavailable');
    const ticketCount = await currentContract.ticketsOf(walletAddress);
    const directValue = Number(ticketCount || 0n);
    if (Number.isFinite(directValue) && directValue >= 0) {
      return directValue;
    }
  } catch {
    // Continue to other fallbacks below.
  }

  try {
    const [ticketCount] = await callViaPolygonscan('ticketsOf', [walletAddress]);
    const directValue = Number(ticketCount || 0n);
    if (Number.isFinite(directValue) && directValue >= 0) {
      return directValue;
    }
  } catch {
    // Continue to next fallback.
  }

  if (!normalizedAddress) return 0;

  try {
    const history = await getTicketHistoryFromLogs();
    const fromLogs = history?.perUser?.get?.(normalizedAddress);
    if (Number.isFinite(fromLogs)) {
      return fromLogs;
    }
  } catch {
    // Continue to explorer fallback.
  }

  try {
    const purchases = await fetchAllTicketPurchasesFromPolygonscan();
    return purchases.reduce((count, purchase) => (
      purchase?.from && purchase.from.toLowerCase() === normalizedAddress ? count + 1 : count
    ), 0);
  } catch {
    return 0;
  }
}

export async function getTicketsCount() {
  try {
    const currentContract = await getReadContract();
    if (!currentContract) throw new Error('Contract unavailable');
    const raw = await currentContract.ticketsCount();
    const directValue = Number(raw || 0n);
    if (Number.isFinite(directValue) && directValue >= 0) {
      return directValue;
    }
  } catch {
    // Continue to other fallbacks below.
  }

  try {
    const [raw] = await callViaPolygonscan('ticketsCount', []);
    const directValue = Number(raw || 0n);
    if (Number.isFinite(directValue) && directValue >= 0) {
      return directValue;
    }
  } catch {
    // Continue to next fallback.
  }

  try {
    const history = await getTicketHistoryFromLogs();
    if (Number.isFinite(history?.total)) {
      return history.total;
    }
  } catch {
    // Continue to explorer fallback.
  }

  try {
    const purchases = await fetchAllTicketPurchasesFromPolygonscan();
    return purchases.length;
  } catch {
    return 0;
  }
}

async function callViaPolygonscan(functionName, args) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch unavailable');
  }

  const iface = new ethers.Interface(CONTRACT_ABI);
  const data = iface.encodeFunctionData(functionName, args);
  const response = await fetch(buildExplorerUrl({
    module: 'proxy',
    action: 'eth_call',
    to: CONTRACT_ADDRESS,
    data,
    tag: 'latest'
  }), { method: 'GET' });
  if (!response.ok) throw new Error('Polygonscan eth_call failed');
  const payload = await response.json();
  const resultHex = payload?.result;
  if (typeof resultHex !== 'string' || !resultHex.startsWith('0x')) {
    throw new Error('Invalid Polygonscan eth_call response');
  }

  return iface.decodeFunctionResult(functionName, resultHex);
}

export async function getRecentWinners() {
  const provider = await getReadProvider();
  if (!provider) return null;

  const currentContract = await getReadContract();
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
