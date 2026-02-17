import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';
import { ethers } from 'ethers';
import { getContractAsync, reconnectProvider } from '../../utils/contractManager';

// Configuration constants
const DEFAULT_RPC = 'https://polygon-rpc.com';
const RPC_RETRY_ATTEMPTS = 3;
const RPC_RETRY_DELAY = 2000; // ms
const EVENT_LISTENER_RETRY_DELAY = 5000; // 5 seconds
const PROVIDER_HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

// Internal state
let provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
let contract = null; // Will be initialized via contractManager
let activeSubscriptions = new Set(); // Track active subscriptions for cleanup

// Function to update provider when user connects their wallet
export async function updateProvider(newProvider) {
  if (!newProvider) {
    console.warn("updateProvider called with null/undefined provider");
    return;
  }
  
  try {
    // Test the new provider before switching
    await Promise.race([
      newProvider.getBlockNumber(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Provider health check timeout')), PROVIDER_HEALTH_CHECK_TIMEOUT)
      )
    ]);
    
    provider = newProvider;
    
    // Reconnect through contract manager to update both provider and contract
    await reconnectProvider(newProvider);
    
    console.log('Provider updated successfully');
  } catch (error) {
    console.error('Failed to update provider, keeping original:', error);
    // Keep the original provider if the new one fails
  }
}

// Function to get contract instance with fallback
export async function getContractInstance(customProvider = null) {
  if (customProvider) {
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, customProvider);
  }
  
  // Use the contract manager to get the properly initialized contract
  return await getContractAsync();
}

// Function to update contract instance when provider changes
export async function updateContractInstance(newProvider) {
  if (!newProvider) {
    console.warn("updateContractInstance called with null/undefined provider");
    return;
  }
  
  // Update provider and reconnect through contract manager
  await updateProvider(newProvider);
}

// Function to get the current provider
export function getCurrentProvider() {
  return provider;
}

// Function to get the current contract
export async function getCurrentContract() {
  return await getContractAsync();
}

// Helper function to retry RPC calls
async function retryRPCOperation(operation, operationName, maxRetries = RPC_RETRY_ATTEMPTS) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting ${operationName}, attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      console.log(`${operationName} succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.error(`${operationName} failed on attempt ${attempt}:`, error.message);
      lastError = error;
      
      // Don't delay on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RPC_RETRY_DELAY));
      }
    }
  }
  
  console.error(`${operationName} failed after ${maxRetries} attempts`);
  throw lastError;
}

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  return retryRPCOperation(async () => {
    const currentContract = await getContractInstance();
    if (!currentContract) {
      throw new Error('Contract not initialized');
    }
    
    // Try using callStatic instead of direct contract call to avoid filter issues
    const raw = await currentContract.callStatic.prizePool();
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  }, 'readPrizePool');
}

// subscribe to TicketBought events -> calls callback with readable message
export async function watchTicketEvents(onEvent) {
  // Generate a unique ID for this subscription
  const subscriptionId = `ticket_${Date.now()}_${Math.random()}`;
  
  let currentContract = await getContractInstance();
  if (!currentContract) {
    console.error('Contract not initialized for watchTicketEvents');
    return () => {}; // Return empty unsubscriber
  }
  
  const handler = (buyer, round) => {
    try {
      const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
      onEvent(msg);
    } catch (err) {
      console.error('Error in ticket event handler:', err);
    }
  };

  // Retry mechanism for setting up event listener
  const setupListener = async () => {
    try {
      // Remove previous listener if it exists
      currentContract.off('TicketBought', handler);
      
      // Get fresh contract instance
      currentContract = await getContractInstance();
      if (!currentContract) {
        throw new Error('Contract not initialized for watchTicketEvents');
      }
      
      // Listen on the contract for TicketBought events
      currentContract.on('TicketBought', handler);
      console.log('TicketBought event listener set up successfully');
    } catch (e) {
      console.error('Error setting up TicketBought event listener:', e);
      // Retry after delay
      setTimeout(setupListener, EVENT_LISTENER_RETRY_DELAY);
    }
  };

  // Initial setup
  await setupListener();

  // Add to active subscriptions tracking
  activeSubscriptions.add(subscriptionId);

  // return unsubscribe
  return () => {
    try {
      if (currentContract) {
        currentContract.off('TicketBought', handler);
      }
      // Remove from active subscriptions tracking
      activeSubscriptions.delete(subscriptionId);
    } catch (e) {
      console.error('Error removing TicketBought event listener:', e);
    }
  };
}

// Subscribe to WinnerSelected events to keep track of winners
export async function watchWinnerEvents(onWinner) {
  // Generate a unique ID for this subscription
  const subscriptionId = `winner_${Date.now()}_${Math.random()}`;
  
  let currentContract = await getContractInstance();
  if (!currentContract) {
    console.error('Contract not initialized for watchWinnerEvents');
    return () => {}; // Return empty unsubscriber
  }
  
  const handler = (winner, round) => {
    try {
      const winnerData = {
        address: winner,
        round: parseInt(round?.toString?.() ?? '0')
      };
      onWinner(winnerData);
    } catch (err) {
      console.error('Error in winner event handler:', err);
    }
  };

  // Retry mechanism for setting up winner event listener
  const setupWinnerListener = async () => {
    try {
      // Remove previous listener if it exists
      currentContract.off('WinnerSelected', handler);
      
      // Get fresh contract instance
      currentContract = await getContractInstance();
      if (!currentContract) {
        throw new Error('Contract not initialized for watchWinnerEvents');
      }
      
      // Listen on the contract for WinnerSelected events
      currentContract.on('WinnerSelected', handler);
      console.log('WinnerSelected event listener set up successfully');
    } catch (e) {
      console.error('Error setting up WinnerSelected event listener:', e);
      // Retry after delay
      setTimeout(setupWinnerListener, EVENT_LISTENER_RETRY_DELAY);
    }
  };

  // Initial setup
  await setupWinnerListener();

  // Add to active subscriptions tracking
  activeSubscriptions.add(subscriptionId);

  // return unsubscribe
  return () => {
    try {
      if (currentContract) {
        currentContract.off('WinnerSelected', handler);
      }
      // Remove from active subscriptions tracking
      activeSubscriptions.delete(subscriptionId);
    } catch (e) {
      console.error('Error removing WinnerSelected event listener:', e);
    }
  };
}

// Subscribe to PrizePool updates to keep track of the pool amount
export async function watchPrizePoolUpdates(onUpdate) {
  // Generate a unique ID for this subscription
  const subscriptionId = `pool_${Date.now()}_${Math.random()}`;
  
  let currentContract = await getContractInstance();
  if (!currentContract) {
    console.error('Contract not initialized for watchPrizePoolUpdates');
    return () => {}; // Return empty unsubscriber
  }
  
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
      console.error('Error in prize pool update handler:', err);
    }
  };

  // Retry mechanism for setting up prize pool update listener
  const setupPoolListener = async () => {
    try {
      // Remove previous listener if it exists
      currentContract.off('TicketBought', handler);
      
      // Get fresh contract instance
      currentContract = await getContractInstance();
      if (!currentContract) {
        throw new Error('Contract not initialized for watchPrizePoolUpdates');
      }
      
      // Listen on the contract for TicketBought events (which trigger pool updates)
      currentContract.on('TicketBought', handler);
      console.log('PrizePool update listener set up successfully');
    } catch (e) {
      console.error('Error setting up prize pool update listener:', e);
      // Retry after delay
      setTimeout(setupPoolListener, EVENT_LISTENER_RETRY_DELAY);
    }
  };

  // Initial setup
  await setupPoolListener();

  // Add to active subscriptions tracking
  activeSubscriptions.add(subscriptionId);

  // return unsubscribe
  return () => {
    try {
      if (currentContract) {
        currentContract.off('TicketBought', handler);
      }
      // Remove from active subscriptions tracking
      activeSubscriptions.delete(subscriptionId);
    } catch (e) {
      console.error('Error removing prize pool update listener:', e);
    }
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
  // Since the contract doesn't have a function to get user tickets, return 0
  return 0;
}

// Cache for winner events with timestamp
const winnerEventsCache = {
  data: null,
  timestamp: 0,
  promise: null
};

// Function to get recent winners by querying the blockchain for WinnerSelected events
export async function getRecentWinners(forceRefresh = false) {
  return retryRPCOperation(async () => {
    // Use cache (valid for 30 seconds)
    const now = Date.now();
    if (!forceRefresh && 
        winnerEventsCache.data && 
        now - winnerEventsCache.timestamp < 30000) {
      return winnerEventsCache.data;
    }
    
    // If request is already in progress, return the existing promise
    if (winnerEventsCache.promise) {
      return winnerEventsCache.promise;
    }
    
    winnerEventsCache.promise = new Promise(async (resolve) => {
      try {
        const currentContract = await getContractInstance();
        if (!currentContract) {
          console.error('Contract not initialized');
          resolve([]);
          return;
        }
        
        // Get the last blocks to find recent winner events
        const latestBlock = await provider.getBlockNumber();
        // Reduce the block range to avoid "Block range is too large" error and rate limits
        const fromBlock = Math.max(latestBlock - 5000, 0); // Look back at most 5k blocks instead of 10k
        
        // Query for WinnerSelected events
        const filter = currentContract.filters.WinnerSelected;
        const events = await currentContract.queryFilter(filter, fromBlock);
        
        // Process the events to extract winner information
        const winners = events.map(event => {
          if (event.args) {
            return {
              address: event.args[0] || event.args.winner,
              round: parseInt(event.args[1] || event.args.round || 0),
              timestamp: event.blockNumber, // Using block number as proxy; could fetch actual timestamp if needed
              transactionHash: event.transactionHash
            };
          }
          return null;
        }).filter(Boolean).reverse(); // Reverse to show most recent first
        
        // Update cache
        winnerEventsCache.data = winners;
        winnerEventsCache.timestamp = now;
        
        // If no WinnerSelected events found, return empty array
        resolve(winners);
      } catch (error) {
        console.error('getRecentWinners error:', error);
        
        // On rate limit error, return cached data if available
        if (error.message?.includes('rate limit') && winnerEventsCache.data) {
          console.warn('Rate limit hit, returning cached data');
          resolve(winnerEventsCache.data);
        } else {
          // Return empty array as fallback if there's an error
          resolve([]);
        }
      } finally {
        winnerEventsCache.promise = null;
      }
    });
    
    return winnerEventsCache.promise;
  }, 'getRecentWinners');
}
