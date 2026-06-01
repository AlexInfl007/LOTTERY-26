import { ethers } from 'ethers';
import { getContractAsync, initializeContract, getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = true;
export const SUPPORTS_HISTORICAL_WINNERS = false;
const TICKET_BOUGHT_TOPIC = ethers.id('TicketBought(address,uint256)');
const POLYGON_CHAIN_ID = 137;
const MIN_LOG_FALLBACK_RANGE = 500;
const LOG_QUERY_BATCH_SIZE = 10000;
const MAX_HISTORY_BLOCKS = 6000000;
const CONTRACT_DEPLOYMENT_FLOOR_BLOCK = 74000000;
const LOTTERY_INTERFACE = new ethers.Interface(CONTRACT_ABI);


async function ensureSharedProvider() {
  let provider = getSharedProvider();
  if (provider) return provider;

  if (typeof window !== 'undefined' && window.ethereum) {
    provider = new ethers.BrowserProvider(window.ethereum);
    setSharedProvider(provider);
    return provider;
  }

  return null;
}
export function updateProvider(newProvider) {
  setSharedProvider(newProvider);
}

export function updateContractInstance(newProvider) {
  setSharedProvider(newProvider);
}

export async function getCurrentProvider() {
  const provider = await ensureSharedProvider();
  if (!provider) return null;

  try {
    let chainId = null;

    try {
      const network = await provider.getNetwork();
      chainId = Number(network.chainId);
    } catch {
      // fallback below
    }

    if (!Number.isFinite(chainId)) {
      const chainIdHex = await provider.send('eth_chainId', []);
      chainId = Number.parseInt(chainIdHex, 16);
    }

    if (chainId !== POLYGON_CHAIN_ID) return null;
    await provider.getBlockNumber();
    return provider;
  } catch {
    return null;
  }
}


export async function getLiveFeedDiagnostics() {
  const provider = await ensureSharedProvider();
  if (!provider) {
    return { ok: false, reason: 'Wallet provider is not initialized. Connect wallet first.' };
  }

  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 137) {
      return { ok: false, reason: `Wrong network: ${network.name || network.chainId}. Switch to Polygon Mainnet (${POLYGON_CHAIN_ID}).` };
    }

    const blockNumber = await provider.getBlockNumber();
    return { ok: true, reason: `Provider OK. Current block: ${blockNumber}.` };
  } catch (error) {
    return { ok: false, reason: `Provider error: ${error?.message || 'unknown error'}` };
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
  const raw = await readContractValue('prizePool');
  if (raw === null) return null;

  const formatted = Number(ethers.formatEther(raw || 0n));
  return Number.isFinite(formatted) ? formatted : null;
}

export async function getRecentTicketEvents(limit = 15) {
  const provider = await getReadProvider();
  if (!provider) {
    throw new Error('Read provider unavailable. Unable to load ticket purchase history.');
  }

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 15, 50));
  const latestBlockNumber = await provider.getBlockNumber();
  const fromBlock = getHistoryStartBlock(latestBlockNumber);
  const events = await fetchTicketEventsFromProvider(provider, normalizedLimit, fromBlock, latestBlockNumber);

  if (events.length === 0) {
    throw new Error('No TicketBought events found in contract history.');
  }

  return events.slice(0, normalizedLimit);
}

async function fetchTicketEventsFromProvider(provider, limit = 50, fromBlock = null, toBlock = null) {
  const latestBlock = Number.isFinite(toBlock) ? toBlock : await provider.getBlockNumber();
  const batchSize = LOG_QUERY_BATCH_SIZE;
  const minBlock = Number.isFinite(fromBlock) ? Math.max(0, fromBlock) : Math.max(0, latestBlock - 250000);
  const blockTimestamps = new Map();
  const events = [];

  for (let end = latestBlock; end >= minBlock && events.length < limit; end -= batchSize) {
    const start = Math.max(minBlock, end - batchSize + 1);
    const logs = await getTicketLogsWithRangeFallback(provider, start, end);

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

async function getTicketLogsWithRangeFallback(provider, fromBlock, toBlock) {
  try {
    return await provider.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [TICKET_BOUGHT_TOPIC],
      fromBlock,
      toBlock
    });
  } catch {
    if (toBlock <= fromBlock || toBlock - fromBlock < MIN_LOG_FALLBACK_RANGE) return [];

    const midBlock = Math.floor((fromBlock + toBlock) / 2);
    const olderLogs = await getTicketLogsWithRangeFallback(provider, fromBlock, midBlock);
    const newerLogs = await getTicketLogsWithRangeFallback(provider, midBlock + 1, toBlock);

    return [...olderLogs, ...newerLogs];
  }
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

function getHistoryStartBlock(latestBlock) {
  if (!Number.isFinite(latestBlock)) return CONTRACT_DEPLOYMENT_FLOOR_BLOCK;

  return Math.max(CONTRACT_DEPLOYMENT_FLOOR_BLOCK, latestBlock - MAX_HISTORY_BLOCKS);
}

async function readContractValue(functionName, args = []) {
  const currentContract = await getReadContract();
  if (!currentContract) return null;

  try {
    if (typeof currentContract[functionName] === 'function') {
      return await currentContract[functionName](...args);
    }
  } catch {
    // Try a raw eth_call below. Some injected wallet providers are stricter
    // around Contract method proxies than around plain RPC calls.
  }

  try {
    const provider = await getReadProvider();
    if (!provider) return null;

    const data = LOTTERY_INTERFACE.encodeFunctionData(functionName, args);
    const result = await provider.call({ to: CONTRACT_ADDRESS, data });
    const [decoded] = LOTTERY_INTERFACE.decodeFunctionResult(functionName, result);
    return decoded;
  } catch {
    return null;
  }
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
  // В контракте нет отдельного события изменения пула. Данные обновляются при загрузке страницы и после покупки билета.
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
  if (!walletAddress) return 0;

  const ticketCount = await readContractValue('ticketsOf', [walletAddress]);
  const directValue = Number(ticketCount || 0n);
  return Number.isFinite(directValue) && directValue >= 0 ? directValue : 0;
}


export async function getCurrentRound() {
  const raw = await readContractValue('round');
  const round = Number(raw || 0n);
  return Number.isFinite(round) && round > 0 ? round : null;
}

export async function getTicketsCount() {
  const raw = await readContractValue('ticketsCount');
  const directValue = Number(raw || 0n);
  if (Number.isFinite(directValue) && directValue >= 0) return directValue;

  const pool = await readContractValue('prizePool');
  const price = await readContractValue('ticketPrice');
  if (pool !== null && price !== null && price > 0n) {
    const derivedValue = Number(pool / price);
    return Number.isFinite(derivedValue) && derivedValue >= 0 ? derivedValue : null;
  }

  return null;
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
