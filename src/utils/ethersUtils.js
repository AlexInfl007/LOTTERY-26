import { ethers } from 'ethers';
import { getContractAsync, getContract, initializeContract } from '../../utils/contractManager';

// public RPC (free)
const DEFAULT_RPC = 'https://polygon-rpc.com'; // бесплатный публичный RPC

// provider можно заменить пользователем при желании
let provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
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

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  try {
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
  } catch (e) {
    console.error('readPrizePool error', e);
    
    // Additional fallback to handle missing methods
    try {
      const currentContract = await getContractInstance();
      if (!currentContract) {
        console.error('Contract not initialized for fallback');
        return 0;
      }
      
      // Check if getPoolBalance exists as an alternative
      if (typeof currentContract.getPoolBalance !== 'undefined') {
        const raw = await currentContract.callStatic.getPoolBalance();
        const formatted = Number(ethers.formatEther(raw || 0));
        return formatted;
      }
    } catch (altError) {
      console.error('getPoolBalance also failed', altError);
    }
    
    // Try fallback approach using provider directly
    try {
      // Dynamically import the contract ABI and address for fallback
      const contractModule = await import('./contract');
      const contractInterface = new ethers.Interface(contractModule.CONTRACT_ABI);
      const data = contractInterface.encodeFunctionData("getBalance");
      
      const result = await provider.call({
        to: contractModule.CONTRACT_ADDRESS,
        data: data
      });
      
      if (result === '0x') {
        console.warn('Received empty result from contract call');
        return 0;
      }
      
      const decoded = contractInterface.decodeFunctionResult("getBalance", result);
      const formatted = Number(ethers.formatEther(decoded[0] || 0));
      return formatted;
    } catch (fallbackError) {
      console.error('readPrizePool fallback error', fallbackError);
      return 0;
    }
  }
}

// subscribe to TicketBought events -> calls callback with readable message
export async function watchTicketEvents(onEvent) {
  const currentContract = await getContractInstance();
  if (!currentContract) {
    console.error('Contract not initialized for watchTicketEvents');
    return () => {}; // Return empty unsubscriber
  }
  
  const handler = (buyer, round) => {
    try {
      const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  // Listen on the contract for TicketBought events
  try {
    currentContract.on('TicketBought', handler);
  } catch (e) {
    console.error('Error setting up event listener:', e);
    // Alternative approach using provider directly if .on() fails
    try {
      // Dynamically import the contract address for the filter
      const contractModule = await import('./contract');
      const filter = {
        address: contractModule.CONTRACT_ADDRESS,
        topics: [
          ethers.id('TicketBought(address,uint256)')
        ]
      };
      provider.on(filter, async (log) => {
        try {
          // Dynamically import the contract ABI for parsing
          const contractModule = await import('./contract');
          const contractInterface = new ethers.Interface(contractModule.CONTRACT_ABI);
          const parsedLog = contractInterface.parseLog(log);
          if (parsedLog && parsedLog.args) {
            const buyer = parsedLog.args[0];
            const round = parsedLog.args[1];
            const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
            onEvent(msg);
          }
        } catch (parseErr) {
          console.error('Error parsing log:', parseErr);
        }
      });
    } catch (altError) {
      console.error('Alternative event listening also failed:', altError);
    }
  }

  // return unsubscribe
  return () => {
    try {
      currentContract.off('TicketBought', handler);
    } catch (e) {
      // If off() fails, try alternative cleanup
      try {
        // Dynamically import the contract address for cleanup
        import('./contract').then((contractModule) => {
          provider.removeListener({address: contractModule.CONTRACT_ADDRESS, topics: [ethers.id('TicketBought(address,uint256)')]});
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
}

// Subscribe to WinnerSelected events to keep track of winners
export async function watchWinnerEvents(onWinner) {
  const currentContract = await getContractInstance();
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
      console.error(err);
    }
  };

  // Listen on the contract for WinnerSelected events
  try {
    currentContract.on('WinnerSelected', handler);
  } catch (e) {
    console.error('Error setting up WinnerSelected event listener:', e);
    // Alternative approach using provider directly if .on() fails
    try {
      // Dynamically import the contract address for the filter
      const contractModule = await import('./contract');
      const filter = {
        address: contractModule.CONTRACT_ADDRESS,
        topics: [
          ethers.id('WinnerSelected(address,uint256)')
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
            const round = parsedLog.args[1];
            const winnerData = {
              address: winner,
              round: parseInt(round?.toString?.() ?? '0')
            };
            onWinner(winnerData);
          }
        } catch (parseErr) {
          console.error('Error parsing WinnerSelected log:', parseErr);
        }
      });
    } catch (altError) {
      console.error('Alternative WinnerSelected event listening also failed:', altError);
    }
  }

  // return unsubscribe
  return () => {
    try {
      currentContract.off('WinnerSelected', handler);
    } catch (e) {
      // If off() fails, try alternative cleanup
      try {
        // Dynamically import the contract address for cleanup
        import('./contract').then((contractModule) => {
          provider.removeListener({address: contractModule.CONTRACT_ADDRESS, topics: [ethers.id('WinnerSelected(address,uint256)')]});
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
}

// Subscribe to PrizePool updates to keep track of the pool amount
export async function watchPrizePoolUpdates(onUpdate) {
  const currentContract = await getContractInstance();
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
      console.error(err);
    }
  };

  try {
    currentContract.on('TicketBought', handler);
  } catch (e) {
    console.error('Error setting up prize pool event listener:', e);
    // Alternative approach if .on() fails
    try {
      const filter = {
        address: CONTRACT_ADDRESS,
        topics: [
          ethers.id('TicketBought(address,uint256)')
        ]
      };
      provider.on(filter, (log) => {
        try {
          const contractInterface = new ethers.Interface(CONTRACT_ABI);
          const parsedLog = contractInterface.parseLog(log);
          if (parsedLog && parsedLog.args) {
            readPrizePool().then(poolAmount => {
              onUpdate(poolAmount);
            }).catch(err => {
              console.error('Error reading prize pool after ticket purchase:', err);
            });
          }
        } catch (parseErr) {
          console.error('Error parsing log for prize pool update:', parseErr);
        }
      });
    } catch (altError) {
      console.error('Alternative prize pool event listening also failed:', altError);
    }
  }

  // return unsubscribe
  return () => {
    try {
      currentContract.off('TicketBought', handler);
    } catch (e) {
      // If off() fails, try alternative cleanup
      provider.removeAllListeners();
    }
  };
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

// Function to get recent winners by querying the blockchain for WinnerSelected events
export async function getRecentWinners(forceRefresh = false) {
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
      
      // Get winners using the contract manager's method which uses roundWinners
      const winnersInfo = await import('../../utils/contractManager');
      const winners = await winnersInfo.getWinnersInfo();
      
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
}
