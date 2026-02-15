import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';
import { ethers } from 'ethers';

// public RPC (free)
const DEFAULT_RPC = 'https://polygon-rpc.com'; // бесплатный публичный RPC

// provider можно заменить пользователем при желании
let provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// Function to update provider when user connects their wallet
export function updateProvider(newProvider) {
  provider = newProvider;
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// Function to get the current provider
export function getCurrentProvider() {
  return provider;
}

// Function to get the current contract
export function getCurrentContract() {
  return contract;
}

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  try {
    const currentContract = getCurrentContract();
    const raw = await currentContract.prizePool();
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  } catch (e) {
    console.error('readPrizePool error', e);
    return 0;
  }
}

// subscribe to TicketBought events -> calls callback with readable message
export function watchTicketEvents(onEvent) {
  const currentContract = getCurrentContract();
  const handler = (buyer, round) => {
    try {
      const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  // Listen on the contract for TicketBought events
  currentContract.on('TicketBought', handler);

  // return unsubscribe
  return () => {
    currentContract.off('TicketBought', handler);
  };
}

// Subscribe to PrizePool updates to keep track of the pool amount
export function watchPrizePoolUpdates(onUpdate) {
  const currentContract = getCurrentContract();
  // Since we don't have a specific event for prize pool updates, we'll monitor
  // the TicketBought event which affects the pool, and also provide a way to manually refresh
  const handler = (buyer, round) => {
    try {
      // When a ticket is bought, the prize pool increases
      readPrizePool().then(poolAmount => {
        onUpdate(poolAmount);
      }).catch(err => {
        console.error('Error reading prize pool after ticket purchase:', err);
      });
    } catch (err) {
      console.error(err);
    }
  };

  currentContract.on('TicketBought', handler);

  // return unsubscribe
  return () => {
    currentContract.off('TicketBought', handler);
  };
}

// Function to buy a ticket
export async function buyTicket(signer) {
  try {
    const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // First, check if the user has enough balance
    const userAddress = await signer.getAddress();
    const userBalance = await signer.provider.getBalance(userAddress);
    const ticketPrice = ethers.parseEther("30"); // 30 POL
    
    if (userBalance < ticketPrice) {
      throw new Error(`Insufficient balance. Need 30 POL but only have ${(Number(ethers.formatEther(userBalance))).toFixed(4)} POL`);
    }
    
    // Prepare transaction object with a higher gas limit to be safe
    const txRequest = {
      value: ticketPrice,
      gasLimit: 500000 // Set a reasonable gas limit upfront to avoid estimation issues
    };
    
    // Buy ticket with 30 POL payment
    const tx = await contractWithSigner.buyTicket(txRequest);
    
    // Wait for transaction receipt
    const receipt = await tx.wait();
    
    if (receipt && receipt.status === 1) { // Success
      return { success: true, transaction: tx, receipt };
    } else { // Failed
      throw new Error('Transaction failed: Receipt status is 0');
    }
  } catch (e) {
    console.error('buyTicket error', e);
    // Provide more detailed error information
    return { 
      success: false, 
      error: e.reason || e.message || e.toString() || 'Transaction failed',
      code: e.code,
      data: e.data,
      rawError: e
    };
  }
}

// Function to get connected wallet's tickets
export async function getUserTickets(walletAddress) {
  // This would need to be implemented based on the actual contract structure
  // For now, returning a mock implementation
  return 0;
}
