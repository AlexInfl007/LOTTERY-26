import { ethers } from 'ethers';
import { getCurrentProvider } from '../src/utils/ethersUtils';

// Полный ABI контракта
const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_token",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      }
    ],
    "name": "AddressEmptyCode",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "AddressInsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedInnerCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "LotteryWon",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "enterRaffle",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "prizePool",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ticketsCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "players",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "transferPot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = "0xf90169AD413429af4AE0a3B8962648d4a3289011";

let contractInstance = null;
let initializationPromise = null;
let provider = null;

// Обработка ошибок RPC и повторные попытки
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`RPC operation failed, attempt ${i + 1}/${maxRetries}:`, error.message);
      
      // Проверяем, является ли ошибка связанной с RPC
      if (error.message.includes('401') || 
          error.message.includes('API key disabled') || 
          error.message.includes('tenant disabled') ||
          error.message.includes('rate limit') || 
          error.message.includes('too many requests') || 
          error.message.includes('server error') ||
          error.message.includes('network error') ||
          error.message.includes('connection refused')) {
        if (i < maxRetries - 1) {
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Увеличиваем задержку вдвое для следующей попытки
          continue;
        }
      }
      throw error;
    }
  }
};

export const initializeContract = async (force = false) => {
  // Если уже инициализируется, возвращаем существующий промис
  if (initializationPromise && !force) {
    return initializationPromise;
  }
  
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      // Получаем провайдер с оберткой для повторных попыток
      const providerOperation = async () => {
        const p = getCurrentProvider();
        if (!p) {
          throw new Error('No provider available');
        }
        return p;
      };
      
      provider = await retryOperation(providerOperation);
      
      // Создаем экземпляр контракта
      contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );
      
      // Проверяем, что контракт отвечает, с повторными попытками
      await retryOperation(async () => {
        await contractInstance.prizePool();
      });
      
      console.log('Contract initialized successfully');
      resolve(contractInstance);
    } catch (error) {
      console.error('Failed to initialize contract after retries:', error);
      contractInstance = null;
      provider = null;
      reject(error);
    }
  });
  
  return initializationPromise;
};

export const getContract = () => {
  return contractInstance;
};

export const getContractAsync = async () => {
  if (contractInstance) {
    // Дополнительная проверка, что контракт все еще рабочий
    try {
      await contractInstance.prizePool();
      return contractInstance;
    } catch (error) {
      console.warn('Existing contract instance failed, reinitializing:', error);
      // Попробуем переинициализировать
      return await initializeContract(true);
    }
  }
  return await initializeContract();
};

export const getContractWithSigner = async (signer) => {
  try {
    if (!signer) {
      // Если подписан не предоставлен, пробуем получить его из провайдера
      const provider = getCurrentProvider();
      if (!provider || !provider.getSigner) {
        throw new Error('No signer available');
      }
      signer = await provider.getSigner();
    }
    
    return new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );
  } catch (error) {
    console.error('Error creating contract with signer:', error);
    return null;
  }
};

// Функция для получения последних покупок билетов (live feed)
export const getLatestPurchases = async (fromBlock = null) => {
  try {
    const contract = await getContractAsync();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Получаем номер последнего блока, если fromBlock не указан
    if (!fromBlock) {
      const latestBlock = await provider.getBlockNumber();
      fromBlock = latestBlock - 1000; // За последние 1000 блоков
    }

    // Получаем фильтр для событий TicketBought
    const filter = contract.filters.TicketBought();
    const events = await retryOperation(async () => {
      return await contract.queryFilter(filter, fromBlock);
    });

    // Обрабатываем события и возвращаем информацию о покупках
    const purchases = events.map(event => ({
      buyer: event.args.buyer,
      round: event.args.round ? parseInt(event.args.round) : 0,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    }));

    return purchases.reverse(); // Последние покупки первыми
  } catch (error) {
    console.error('Error getting latest purchases:', error);
    return [];
  }
};

// Функция для получения информации о победителях
export const getWinnersInfo = async () => {
  try {
    const contract = await getContractAsync();
    if (!contract) {
      throw new Error('Contract not available');
    }

    // Since our contract doesn't have roundWinners and related functions,
    // we'll return an empty array or implement an alternative approach
    // For now, we'll just return an empty array since the contract doesn't support historical winner data
    return [];
  } catch (error) {
    console.error('Error getting winners info:', error);
    return [];
  }
};

// Функция для периодического обновления данных
export const setupPeriodicUpdates = (callback, intervalMs = 30000) => {
  let intervalId = null;
  
  const updateData = async () => {
    try {
      const contract = await getContractAsync();
      if (!contract) {
        console.warn('Cannot update data: contract not available');
        return;
      }
      
      // Получаем актуальные данные
      const prizePool = await retryOperation(async () => {
        return await contract.prizePool();
      });
      
      // Вызываем callback с обновленными данными
      callback({
        prizePool: ethers.formatEther(prizePool),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error during periodic update:', error);
      // Попробуем переинициализировать контракт в случае ошибки
      try {
        await initializeContract(true);
      } catch (reinitError) {
        console.error('Reinitialization failed:', reinitError);
      }
    }
  };
  
  // Выполняем первоначальное обновление
  updateData();
  
  // Устанавливаем интервал для регулярных обновлений
  intervalId = setInterval(updateData, intervalMs);
  
  // Возвращаем функцию для остановки обновлений
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
};

// Функция для подписки на события покупки билетов
export const subscribeToTicketPurchases = (callback) => {
  let contract = null;
  let unsubscribe = null;
  
  const setupSubscription = async () => {
    try {
      contract = await getContractAsync();
      if (!contract) {
        throw new Error('Contract not available for subscription');
      }

      // Подписываемся на событие enterRaffle (пользователь отправляет средства в лотерею)
      const handler = (from, amount, event) => {
        try {
          callback({
            from,
            amount: ethers.formatEther(amount),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error('Error in ticket purchase callback:', error);
        }
      };

      // Since our contract doesn't have a specific TicketBought event,
      // we'll listen for the receive/fallback function payments or transfer events if it's an ERC20 token
      // For now, since the contract is payable and uses enterRaffle function, we'll need to find a way to track entries
      // The contract ABI doesn't show a specific event for entering raffle
      // We could potentially listen to the receive/transfer events but those aren't explicitly defined in the ABI
      // For now, we'll just listen to any balance change as a potential entry
      
      // Alternative: Listen to generic events if possible, or skip this for now
      // Let's skip the event listener since the ABI doesn't specify any events for ticket purchases
      // The original ABI only has LotteryWon event
    } catch (error) {
      console.error('Error setting up ticket purchase subscription:', error);
      
      // Повторная попытка через некоторое время
      setTimeout(setupSubscription, 5000);
    }
  };

  setupSubscription();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

// Функция для подписки на события выбора победителей
export const subscribeToWinnerSelections = (callback) => {
  let contract = null;
  let unsubscribe = null;
  
  const setupSubscription = async () => {
    try {
      contract = await getContractAsync();
      if (!contract) {
        throw new Error('Contract not available for subscription');
      }

      // Подписываемся на событие LotteryWon (пользователь выиграл в лотерее)
      const handler = (winner, amount, event) => {
        try {
          callback({
            winner,
            amount: ethers.formatEther(amount),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
          });
        } catch (error) {
          console.error('Error in winner selection callback:', error);
        }
      };

      // Listen for the LotteryWon event which is present in the contract ABI
      contract.on('LotteryWon', handler);

      // Возвращаем функцию отписки
      unsubscribe = () => {
        try {
          contract.off('LotteryWon', handler);
        } catch (error) {
          console.error('Error unsubscribing from LotteryWon:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up winner selection subscription:', error);
      
      // Повторная попытка через некоторое время
      setTimeout(setupSubscription, 5000);
    }
  };

  setupSubscription();

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};