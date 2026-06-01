import { ethers } from 'ethers';
import { getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = true;
export const SUPPORTS_HISTORICAL_WINNERS = false;

const POLYGON_CHAIN_ID = 137;
const TICKET_PRICE_POL = 30;

async function ensureSharedProvider() {
  const existingProvider = getSharedProvider();
  if (existingProvider) return existingProvider;

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
    const chainIdHex = await provider.send('eth_chainId', []);
    const chainId = Number.parseInt(chainIdHex, 16);
    if (chainId !== POLYGON_CHAIN_ID) return null;

    return provider;
  } catch {
    return null;
  }
}

export async function getLiveFeedDiagnostics() {
  const provider = await ensureSharedProvider();
  if (!provider) {
    return { ok: false, reason: 'Connect wallet to load TicketBought events.' };
  }

  try {
    const chainIdHex = await provider.send('eth_chainId', []);
    const chainId = Number.parseInt(chainIdHex, 16);
    if (chainId !== POLYGON_CHAIN_ID) {
      return { ok: false, reason: `Wrong network. Switch wallet to Polygon Mainnet (${POLYGON_CHAIN_ID}).` };
    }

    return { ok: true, reason: 'Wallet provider is ready.' };
  } catch (error) {
    return { ok: false, reason: `Wallet provider error: ${error?.message || 'unknown error'}` };
  }
}

async function getReadContract() {
  const provider = await getCurrentProvider();
  if (!provider) return null;

  return addGetPastEvents(new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider));
}


function addGetPastEvents(contract) {
  if (typeof contract.getPastEvents === 'function') return contract;

  contract.getPastEvents = async (eventName, options = {}) => contract.queryFilter(
    contract.filters[eventName](),
    options.fromBlock ?? 0,
    options.toBlock ?? 'latest'
  );

  return contract;
}

function toSafeNumber(value) {
  const numberValue = Number(value || 0n);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
}

function getEventBlockNumber(eventItem) {
  return Number(eventItem?.blockNumber ?? eventItem?.log?.blockNumber ?? 0);
}

function getEventLogIndex(eventItem) {
  return Number(eventItem?.index ?? eventItem?.logIndex ?? eventItem?.log?.index ?? eventItem?.log?.logIndex ?? 0);
}

function getEventTransactionHash(eventItem) {
  return eventItem?.transactionHash ?? eventItem?.log?.transactionHash ?? null;
}

function getEventArgs(eventItem) {
  return eventItem?.args ?? eventItem?.fragment?.args ?? {};
}

function getArg(args, name, index) {
  if (!args) return null;

  if (Array.isArray(args)) {
    return args[index] ?? null;
  }

  return args[name] ?? args[index] ?? null;
}

function normalizeTicketEvent(eventItem, fallbackIndex = 0) {
  const args = getEventArgs(eventItem);
  const buyer = getArg(args, 'buyer', 0);
  const round = getArg(args, 'round', 1);

  if (!buyer) return null;

  const blockNumber = getEventBlockNumber(eventItem);
  const logIndex = getEventLogIndex(eventItem);
  const transactionHash = getEventTransactionHash(eventItem);

  return {
    id: `${transactionHash || 'ticket'}:${logIndex || fallbackIndex}`,
    buyer,
    round: round !== null && round !== undefined ? Number(round) : null,
    blockNumber,
    transactionHash
  };
}

async function getEventTimestamp(provider, blockNumber) {
  if (!Number.isFinite(blockNumber) || blockNumber <= 0) return Date.now();

  try {
    const block = await provider.getBlock(blockNumber);
    return block?.timestamp ? Number(block.timestamp) * 1000 : Date.now();
  } catch {
    return Date.now();
  }
}

export async function readPrizePool() {
  const contract = await getReadContract();
  if (!contract) return null;

  try {
    const raw = await contract.prizePool();
    const formatted = Number(ethers.formatEther(raw || 0n));
    return Number.isFinite(formatted) ? formatted : null;
  } catch {
    return null;
  }
}

export async function getRecentTicketEvents(limit = 15) {
  const provider = await getCurrentProvider();
  const contract = await getReadContract();
  if (!provider || !contract) {
    throw new Error('Connect wallet to load TicketBought events.');
  }

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 15, 50));

  try {
    const events = await contract.getPastEvents('TicketBought', { fromBlock: 0, toBlock: 'latest' });
    const recentEvents = events
      .map(normalizeTicketEvent)
      .filter(Boolean)
      .sort((a, b) => (b.blockNumber - a.blockNumber) || 0)
      .slice(0, normalizedLimit);

    const eventsWithTimestamps = await Promise.all(
      recentEvents.map(async (eventItem) => ({
        ...eventItem,
        timestamp: await getEventTimestamp(provider, eventItem.blockNumber)
      }))
    );

    return eventsWithTimestamps;
  } catch (error) {
    throw new Error(error?.message || 'Unable to load TicketBought events from wallet provider.');
  }
}

export async function getCurrentContract() {
  return await getReadContract();
}

export async function watchWinnerEvents() {
  return () => {};
}

export async function watchPrizePoolUpdates() {
  return () => {};
}

export async function buyTicket(signer) {
  try {
    const contractWithSigner = await getContractWithSigner(signer);
    const userAddress = await signer.getAddress();
    const userBalance = await signer.provider.getBalance(userAddress);
    const ticketPrice = ethers.parseEther(String(TICKET_PRICE_POL));

    if (userBalance < ticketPrice) {
      throw new Error(`Insufficient balance. Need ${TICKET_PRICE_POL} POL but only have ${(Number(ethers.formatEther(userBalance))).toFixed(4)} POL`);
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
  if (!walletAddress) return null;

  const contract = await getReadContract();
  if (!contract) return null;

  try {
    return toSafeNumber(await contract.ticketsOf(walletAddress));
  } catch {
    return null;
  }
}

export async function getCurrentRound() {
  const contract = await getReadContract();
  if (!contract || typeof contract.round !== 'function') return null;

  try {
    const round = toSafeNumber(await contract.round());
    return round && round > 0 ? round : null;
  } catch {
    return null;
  }
}

export async function getTicketsCount() {
  const contract = await getReadContract();
  if (!contract) return null;

  try {
    return toSafeNumber(await contract.ticketsCount());
  } catch {
    return null;
  }
}

export async function getRecentWinners() {
  return [];
}
