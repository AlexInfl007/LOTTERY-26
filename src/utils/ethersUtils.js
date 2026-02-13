import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';
import { ethers } from 'ethers';

// public RPC (free)
const DEFAULT_RPC = 'https://polygon-rpc.com'; // бесплатный публичный RPC

// provider можно заменить пользователем при желании
const provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  try {
    const raw = await contract.prizePool();
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
  const handler = (buyer, round) => {
    try {
      const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  contract.on('TicketBought', handler);

  // return unsubscribe
  return () => {
    contract.off('TicketBought', handler);
  };
}

// Function to buy a ticket
export async function buyTicket(signer) {
  try {
    const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // First, check if the user has enough balance
    const userBalance = await signer.provider.getBalance(await signer.getAddress());
    const ticketPrice = ethers.parseEther("30"); // 30 POL
    
    if (userBalance < ticketPrice) {
      throw new Error(`Insufficient balance. Need 30 POL but only have ${(Number(ethers.formatEther(userBalance))).toFixed(4)} POL`);
    }
    
    // Estimate gas first to avoid missing revert data issues
    const gasEstimate = await contractWithSigner.buyTicket.estimateGas({ value: ticketPrice });
    
    // Add some buffer to the gas estimate
    const gasLimit = Math.floor(gasEstimate * 1.3); // 30% buffer to be safe
    
    // Buy ticket with 30 POL payment and explicit gas limit
    const tx = await contractWithSigner.buyTicket({ 
      value: ticketPrice,
      gasLimit: gasLimit
    });
    
    // Wait for transaction receipt
    const receipt = await tx.wait();
    
    if (receipt.status === 1) { // Success
      return { success: true, transaction: tx, receipt };
    } else { // Failed
      throw new Error('Transaction failed: Receipt status is 0');
    }
  } catch (e) {
    console.error('buyTicket error', e);
    // Provide more detailed error information
    return { 
      success: false, 
      error: e.reason || e.message || 'Transaction failed',
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
