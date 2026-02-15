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

// Function to get contract instance with fallback
export function getContractInstance(customProvider = null) {
  const activeProvider = customProvider || provider;
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeProvider);
}

// Function to update contract instance when provider changes
export function updateContractInstance(newProvider) {
  if (!newProvider) {
    console.warn("updateContractInstance called with null/undefined provider");
    return;
  }
  
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
    const currentContract = getContractInstance();
    
    // Try using callStatic instead of direct contract call to avoid filter issues
    const raw = await currentContract.callStatic.prizePool();
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  } catch (e) {
    console.error('readPrizePool error', e);
    
    // Try fallback approach using provider directly
    try {
      const contractInterface = new ethers.Interface(CONTRACT_ABI);
      const data = contractInterface.encodeFunctionData("prizePool");
      
      const result = await provider.call({
        to: CONTRACT_ADDRESS,
        data: data
      });
      
      const decoded = contractInterface.decodeFunctionResult("prizePool", result);
      const formatted = Number(ethers.formatEther(decoded[0] || 0));
      return formatted;
    } catch (fallbackError) {
      console.error('readPrizePool fallback error', fallbackError);
      return 0;
    }
  }
}

// subscribe to TicketBought events -> calls callback with readable message
export function watchTicketEvents(onEvent) {
  const currentContract = getContractInstance();
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
        provider.removeListener({address: CONTRACT_ADDRESS, topics: [ethers.id('TicketBought(address,uint256)')]});
      } catch {
        // Last resort cleanup
        provider.removeAllListeners();
      }
    }
  };
}

// Subscribe to WinnerSelected events to keep track of winners
export function watchWinnerEvents(onWinner) {
  const currentContract = getContractInstance();
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
      const filter = {
        address: CONTRACT_ADDRESS,
        topics: [
          ethers.id('WinnerSelected(address,uint256)')
        ]
      };
      provider.on(filter, (log) => {
        try {
          const contractInterface = new ethers.Interface(CONTRACT_ABI);
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
        provider.removeListener({address: CONTRACT_ADDRESS, topics: [ethers.id('WinnerSelected(address,uint256)')]});
      } catch {
        // Last resort cleanup
        provider.removeAllListeners();
      }
    }
  };
}

// Subscribe to PrizePool updates to keep track of the pool amount
export function watchPrizePoolUpdates(onUpdate) {
  const currentContract = getContractInstance();
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

// Function to get recent winners by querying the blockchain for WinnerSelected events
export async function getRecentWinners() {
  try {
    const currentContract = getContractInstance();
    
    // Get the last blocks to find recent winner events
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(latestBlock - 10000, 0); // Look back at most 10k blocks
    
    // Query for WinnerSelected events
    const filter = currentContract.filters.WinnerSelected;
    const events = await currentContract.queryFilter(filter, fromBlock);
    
    // Process the events to extract winner information
    const winners = events.map(event => {
      if (event.args) {
        return {
          address: event.args[0] || event.args.winner,
          round: parseInt(event.args[1] || event.args.round || 0),
          timestamp: event.blockNumber // Using block number as proxy; could fetch actual timestamp if needed
        };
      }
      return null;
    }).filter(Boolean).reverse(); // Reverse to show most recent first
    
    // If no WinnerSelected events found, return empty array
    return winners;
  } catch (error) {
    console.error('getRecentWinners error:', error);
    // Return empty array as fallback if there's an error
    return [];
  }
}
