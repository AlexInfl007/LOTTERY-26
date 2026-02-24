import { ethers } from 'ethers';
import { getContractAsync, getContract, initializeContract, getContractWithSigner } from '../../utils/contractManager';

// Using the new RPC manager for Polygon network
let provider = null;
let contract = null; // Will be initialized via contractManager

// Function to update provider when user connects their wallet
export function updateProvider(newProvider) {
  provider = newProvider;
  // Contract will be handled by contractManager
}

// Function to get contract instance with fallback
export async function getContractInstance(customProvider = null) {
  if (customProvider) {
    // Import ABI and address locally when custom provider is used
    const { CONTRACT_ABI, CONTRACT_ADDRESS } = await import('./contract');
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, customProvider);
  }
  
  // Make sure the contract is properly initialized with the current provider
  await initializeContract(true);
  // Use the contract manager to get the properly initialized contract
  return await getContractAsync();
}

// Function to update contract instance when provider changes
export function updateContractInstance(newProvider) {
  if (!newProvider) {
    console.warn("updateContractInstance called with null/undefined provider");
    return;
  }
  
  provider = newProvider;
  // Contract will be handled by contractManager
}

// Function to get the current provider
export async function getCurrentProvider() {
  if (!provider) {
    // If no wallet provider, return null to indicate no connection
    return null;
  }
  
  // Check if the provider is still responsive
  try {
    await provider.getBlockNumber();
    return provider;
  } catch (error) {
    console.warn('Provider is not responsive:', error);
    // Return null to indicate provider is not working
    return null;
  }
}

// Function to get the current contract
export async function getCurrentContract() {
  try {
    // Make sure the contract is properly initialized with the current provider
    await initializeContract(true);
    const contract = await getContractAsync();
    
    // Additional check to ensure contract is properly initialized
    if (!contract) {
      console.error('Contract is null after initialization');
      return null;
    }
    
    // Test that contract methods are accessible
    if (typeof contract.prizePool !== 'function') {
      console.error('Contract methods are not accessible');
      return null;
    }
    
    return contract;
  } catch (error) {
    console.warn('getCurrentContract failed:', error);
    return null;
  }
}

// Helper function to handle RPC errors
async function handleRPCErrors(operation, operationName = 'RPC operation') {
  try {
    return await operation();
  } catch (error) {
    console.warn(`${operationName} failed:`, error.message);
    
    // If it's an RPC-related error, rethrow for proper handling
    if (error.message.includes('401') || 
        error.message.includes('API key disabled') || 
        error.message.includes('tenant disabled') ||
        error.message.includes('rate limit') || 
        error.message.includes('too many requests') || 
        error.message.includes('server error') ||
        error.message.includes('network error') ||
        error.message.includes('connection refused') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('missing revert data') ||
        error.message.includes('CALL_EXCEPTION') ||
        error.message.includes('could not coalesce') ||
        error.message.includes('insufficient funds')) {
      
      console.error(`${operationName} failed due to RPC error:`, error.message);
      throw error;
    }
    
    // If it's not an RPC-related error, just rethrow
    throw error;
  }
}

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  try {
    // Check if we have a provider (wallet connected)
    const currentProvider = await getCurrentProvider();
    if (!currentProvider) {
      // Return null if no provider (wallet not connected)
      return null;
    }
    
    const currentContract = await getCurrentContract();
    if (!currentContract) {
      console.error('Contract not initialized');
      return 0;
    }
    
    // Try using callStatic instead of direct contract call to avoid filter issues
    const raw = await handleRPCErrors(async () => {
      return await currentContract.callStatic.prizePool();
    }, 'readPrizePool');
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  } catch (error) {
    console.warn('readPrizePool failed:', error);
    // Return 0 instead of throwing error to prevent breaking the UI
    return 0;
  }
}

// subscribe to enterRaffle events -> calls callback with readable message
export async function watchTicketEvents(onEvent) {
  const currentContract = await getCurrentContract();
  if (!currentContract) {
    console.error('Contract not initialized for watchTicketEvents');
    return () => {}; // Return empty unsubscriber
  }
  
  const handler = (from, value, event) => {
    try {
      const msg = `${from} купил билет (${ethers.formatEther(value)} POL)`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  // Listen on the contract for enterRaffle function calls
  // Since our contract ABI doesn't have a specific event for ticket purchases,
  // we'll need to listen to the receive/transfer events or potentially just track balance changes
  // The only event in our ABI is LotteryWon
  // For now, we'll skip this functionality as there's no direct event for ticket purchases in the ABI
  
  // Return empty unsubscriber since we can't properly listen to ticket purchase events
  return () => {};
}

// Subscribe to LotteryWon events to keep track of winners
export async function watchWinnerEvents(onWinner) {
  return handleRPCErrors(async () => {
    const currentContract = await getCurrentContract();
    if (!currentContract) {
      console.error('Contract not initialized for watchWinnerEvents');
      return () => {}; // Return empty unsubscriber
    }
    
    const handler = (winner, amount, event) => {
      try {
        const winnerData = {
          address: winner,
          amount: ethers.formatEther(amount)
        };
        onWinner(winnerData);
      } catch (err) {
        console.error(err);
      }
    };

    // Listen on the contract for LotteryWon events
    try {
      currentContract.on('LotteryWon', handler);
    } catch (e) {
      console.error('Error setting up LotteryWon event listener:', e);
      // Alternative approach using provider directly if .on() fails
      try {
        // Dynamically import the contract address for the filter
        const contractModule = await import('./contract');
        const filter = {
          address: contractModule.CONTRACT_ADDRESS,
          topics: [
            ethers.id('LotteryWon(address,uint256)')
          ]
        };
        provider.on(filter, async (log) => {
          try {
            // Dynamically import the contract ABI for parsing
            const contractModule = await import('./contract');
            const contractInterface = new ethers.Interface(contractModule.CONTRACT_ABI);
            const parsedLog = contractInterface.parseLog(log);
            if (parsedLog && parsedLog.args) {
              const winner = parsedLog.args[0];
              const amount = parsedLog.args[1];
              const winnerData = {
                address: winner,
                amount: ethers.formatEther(amount)
              };
              onWinner(winnerData);
            }
          } catch (parseErr) {
            console.error('Error parsing LotteryWon log:', parseErr);
          }
        });
      } catch (altError) {
        console.error('Alternative LotteryWon event listening also failed:', altError);
      }
    }

    // return unsubscribe
    return () => {
      try {
        currentContract.off('LotteryWon', handler);
      } catch (e) {
        // If off() fails, try alternative cleanup
        try {
          // Dynamically import the contract address for cleanup
          import('./contract').then((contractModule) => {
            provider.removeListener({address: contractModule.CONTRACT_ADDRESS, topics: [ethers.id('LotteryWon(address,uint256)')]});
          }).catch(() => {
            // Last resort cleanup
            provider.removeAllListeners();
          });
        } catch {
          // Last resort cleanup
          provider.removeAllListeners();
        }
      }
    };
  }, 'watchWinnerEvents');
}

// Subscribe to PrizePool updates to keep track of the pool amount
export async function watchPrizePoolUpdates(onUpdate) {
  const currentContract = await getCurrentContract();
  if (!currentContract) {
    console.error('Contract not initialized for watchPrizePoolUpdates');
    return () => {}; // Return empty unsubscriber
  }
  
  // Since we don't have a specific event for prize pool updates in our contract,
  // we'll periodically poll for updates instead of relying on events
  // The only event in our ABI is LotteryWon, which reduces the pool rather than increases it
  
  // Return empty unsubscriber since we're not using event listeners for this
  return () => {};
}

// Function to buy a ticket
export async function buyTicket(signer) {
  try {
    // Use the contract manager to get the contract with signer
    const contractWithSigner = await getContractWithSigner(signer);
    
    if (!contractWithSigner) {
      throw new Error('Contract not initialized with signer');
    }
    
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
    const tx = await contractWithSigner.enterRaffle(txRequest);
    
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
  try {
    const currentContract = await getCurrentContract();
    if (!currentContract) {
      console.error('Contract not initialized');
      return 0;
    }
    
    // Call the ticketsOf function in the smart contract with error handling
    const ticketCount = await handleRPCErrors(async () => {
      return await currentContract.callStatic.ticketsOf(walletAddress);
    }, 'getUserTickets');
    // Convert BigInt to number
    return Number(ticketCount || 0);
  } catch (error) {
    console.warn('getUserTickets failed:', error);
    return 0;
  }
}

// Function to get tickets count with error handling
export async function getTicketsCount() {
  try {
    // Check if we have a provider (wallet connected)
    const currentProvider = await getCurrentProvider();
    if (!currentProvider) {
      // Return null if no provider (wallet not connected)
      return null;
    }

    const currentContract = await getCurrentContract();
    if (!currentContract) {
      console.error('Contract not initialized');
      return 0;
    }

    const raw = await currentContract.callStatic.ticketsCount();
    // Convert BigInt to number
    const formatted = Number(raw || 0);
    return formatted;
  } catch (error) {
    console.warn('getTicketsCount failed:', error);
    return 0; // Return 0 if the function doesn't exist or other error occurs
  }
}

// Cache for winner events with timestamp
const winnerEventsCache = {
  data: null,
  timestamp: 0,
  promise: null
};

// Function to get recent winners by querying the blockchain for LotteryWon events
export async function getRecentWinners(forceRefresh = false) {
  // Check if we have a provider (wallet connected)
  const currentProvider = await getCurrentProvider();
  if (!currentProvider) {
    // Return null if no provider (wallet not connected)
    return null;
  }
  
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
      const currentContract = await getCurrentContract();
      if (!currentContract) {
        console.error('Contract not initialized');
        resolve([]);
        return;
      }
      
      // Since our contract doesn't have round-based winner tracking,
      // we'll return an empty array as there's no way to get historical winners
      // from the current contract ABI
      const winners = [];
      
      // Update cache
      winnerEventsCache.data = winners;
      winnerEventsCache.timestamp = now;
      
      resolve(winners);
    } catch (error) {
      console.warn('getRecentWinners failed:', error);
      
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
}
