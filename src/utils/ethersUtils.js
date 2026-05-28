import { ethers } from 'ethers';
import { getContractAsync, initializeContract, getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = false;
export const SUPPORTS_HISTORICAL_WINNERS = false;
const TICKET_BOUGHT_TOPIC = ethers.id('TicketBought(address,uint256)');
const POLYGON_CHAIN_ID = 137;
let deploymentBlockCache = null;


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
  try {
    const currentContract = await getReadContract();
    if (!currentContract) throw new Error('Contract unavailable');
    const raw = await currentContract.prizePool();
    return Number(ethers.formatEther(raw || 0n));
  } catch {
    return null;
  }
}

export async function getRecentTicketEvents(limit = 15) {
  const provider = await getReadProvider();
  if (!provider) {
    throw new Error('Read provider unavailable. Unable to load ticket purchase history.');
  }

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 15, 50));
  const latestBlockNumber = await provider.getBlockNumber();
  const deploymentBlock = await resolveDeploymentBlock(provider);
  const events = await fetchTicketEventsFromProvider(provider, normalizedLimit, deploymentBlock, latestBlockNumber);

  if (events.length === 0) {
    throw new Error('No TicketBought events found in contract history.');
  }

  return events.slice(0, normalizedLimit);
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

  try {
    const currentContract = await getReadContract();
    if (!currentContract) throw new Error('Contract unavailable');
    const ticketCount = await currentContract.ticketsOf(walletAddress);
    const directValue = Number(ticketCount || 0n);
    return Number.isFinite(directValue) && directValue >= 0 ? directValue : 0;
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
    return Number.isFinite(directValue) && directValue >= 0 ? directValue : null;
  } catch {
    return null;
  }
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
