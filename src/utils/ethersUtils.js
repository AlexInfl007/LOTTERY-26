import { ethers } from 'ethers';
import { getContractAsync, getContract, initializeContract } from '../../utils/contractManager';

// List of RPC providers for rotation
const RPC_PROVIDERS = [
  'https://rpc.ankr.com/polygon',
  'https://polygon.llamarpc.com',
  'https://1rpc.io/matic',
  'https://polygon-bor.publicnode.com',
  'https://polygon.drpc.org',
  'https://polygon-rpc.com'
];

let currentProviderIndex = 0;
let provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[currentProviderIndex], undefined, {
  staticNetwork: ethers.Network.from('matic')
});
let contract = null; // Will be initialized via contractManager

// Function to rotate to next RPC provider
function rotateProvider() {
  currentProviderIndex = (currentProviderIndex + 1) % RPC_PROVIDERS.length;
  provider = new ethers.JsonRpcProvider(RPC_PROVIDERS[currentProviderIndex], undefined, {
    staticNetwork: ethers.Network.from('matic')
  });
  console.log(`Switched to RPC provider: ${RPC_PROVIDERS[currentProviderIndex]}`);
  return provider;
}

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
export function getCurrentProvider() {
  return provider;
}

// Function to get the current contract
export async function getCurrentContract() {
  return await getContractAsync();
}

// Helper function to handle RPC errors and rotate providers
async function handleRPCErrors(operation, operationName = 'RPC operation') {
  let lastError;
  
  // Try the current provider first
  try {
    return await operation();
  } catch (error) {
    lastError = error;
    console.warn(`${operationName} failed with current provider:`, error.message);
    
    // Check if this is an RPC error that warrants trying another provider
    if (error.message.includes('401') || 
        error.message.includes('API key disabled') || 
        error.message.includes('tenant disabled') ||
        error.message.includes('rate limit') || 
        error.message.includes('too many requests') || 
        error.message.includes('server error') ||
        error.message.includes('network error') ||
        error.message.includes('connection refused')) {
      
      console.log(`Rotating RPC provider due to error...`);
      rotateProvider();
      
      // Retry the operation with the new provider
      try {
        const result = await operation();
        console.log(`${operationName} succeeded with new provider`);
        return result;
      } catch (retryError) {
        console.warn(`${operationName} failed again with new provider:`, retryError.message);
        lastError = retryError;
      }
    }
    
    // If it's not an RPC-related error, just rethrow
    throw lastError;
  }
}

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  return handleRPCErrors(async () => {
    const currentContract = await getContractInstance();
    if (!currentContract) {
      console.error('Contract not initialized');
      return 0;
    }
    
    // Try using callStatic instead of direct contract call to avoid filter issues
    const raw = await currentContract.callStatic.getBalance();
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  }, 'readPrizePool');
}

// subscribe to enterRaffle events -> calls callback with readable message
export async function watchTicketEvents(onEvent) {
  const currentContract = await getContractInstance();
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
    const currentContract = await getContractInstance();
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
  const currentContract = await getContractInstance();
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
    // Import contract details dynamically to ensure they're available
    const contractModule = await import('./contract');
    const contractWithSigner = new ethers.Contract(contractModule.CONTRACT_ADDRESS, contractModule.CONTRACT_ABI, signer);
    
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
    const currentContract = await getContractInstance();
    if (!currentContract) {
      console.error('Contract not initialized');
      return 0;
    }
    
    // Call the players mapping in the smart contract
    const isPlayer = await currentContract.players(walletAddress);
    return isPlayer ? 1 : 0;
  } catch (error) {
    console.error('getUserTickets error:', error);
    return 0;
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
  return handleRPCErrors(async () => {
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
        
        // Since our contract doesn't have round-based winner tracking,
        // we'll return an empty array as there's no way to get historical winners
        // from the current contract ABI
        const winners = [];
        
        // Update cache
        winnerEventsCache.data = winners;
        winnerEventsCache.timestamp = now;
        
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
