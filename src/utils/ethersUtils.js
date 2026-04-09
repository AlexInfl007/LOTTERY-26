import { ethers } from 'ethers';
import { getContractAsync, initializeContract, getContractWithSigner } from '../../utils/contractManager';
import { getSharedProvider, setSharedProvider } from './providerStore';
import { CONTRACT_ADDRESS } from './contract';

export const SUPPORTS_TICKET_EVENTS = false;
export const SUPPORTS_HISTORICAL_WINNERS = false;
const ENTER_RAFFLE_SELECTOR = '0x' + ethers.id('enterRaffle()').slice(2, 10);

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

export async function watchTicketEvents() {
  // ABI не содержит события покупки билета.
  return () => {};
}

export async function getRecentTicketPurchases(limit = 15, blocksToScan = 800) {
  try {
    const provider = await getCurrentProvider();
    if (!provider) return [];

    const latestBlockNumber = await provider.getBlockNumber();
    const fromBlock = Math.max(latestBlockNumber - blocksToScan, 0);
    const purchases = [];

    for (let blockNumber = latestBlockNumber; blockNumber >= fromBlock; blockNumber -= 1) {
      if (purchases.length >= limit) break;

      const block = await getBlockWithTransactions(provider, blockNumber);
      if (!block || !block.transactions?.length) continue;

      for (const tx of block.transactions) {
        if (purchases.length >= limit) break;
        if (!tx) continue;

        const txData = tx.data || tx.input || '';
        const isTargetContract = tx.to && tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();
        const isTicketPurchaseCall = typeof txData === 'string' && txData.startsWith(ENTER_RAFFLE_SELECTOR);

        if (isTargetContract && isTicketPurchaseCall) {
          purchases.push({
            hash: tx.hash,
            from: tx.from,
            blockNumber: tx.blockNumber ?? blockNumber,
            timestamp: Number(block.timestamp) * 1000
          });
        }
      }
    }

    return purchases.slice(0, limit);
  } catch (error) {
    console.warn('Failed to scan recent ticket purchases:', error);
    return [];
  }
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

  const handler = (winner, amount) => {
    onWinner({
      address: winner,
      amount: ethers.formatEther(amount)
    });
  };

  currentContract.on('LotteryWon', handler);
  return () => currentContract.off('LotteryWon', handler);
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

    const tx = await contractWithSigner.enterRaffle({
      value: ticketPrice,
      gasLimit: 500000
    });

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

  // Контракт не предоставляет историю победителей (кроме live-события LotteryWon).
  return [];
}
