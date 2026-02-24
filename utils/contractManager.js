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
        "name": "user",
        "type": "address"
      }
    ],
    "name": "ticketsOf",
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

// No fallback RPC URLs - only use the user's wallet provider

// Глобальное состояние для контракта
let contractInstance = null;
let initializationPromise = null;
let provider = null;
let isInitializing = false; // Добавляем флаг для предотвращения параллельной инициализации

// Обработка ошибок RPC и повторные попытки
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`RPC operation failed, attempt ${i + 1}/${maxRetries}:`, error.message);
      
      // Проверяем, является ли ошибка связанной с RPC или контрактом
      if (error.message.includes('401') || 
          error.message.includes('API key disabled') || 
          error.message.includes('tenant disabled') ||
          error.message.includes('rate limit') || 
          error.message.includes('too many requests') || 
          error.message.includes('server error') ||
          error.message.includes('network error') ||
          error.message.includes('connection refused') ||
          error.message.includes('missing revert data') ||
          error.message.includes('CALL_EXCEPTION') ||
          error.message.includes('could not coalesce') ||
          error.message.includes('insufficient funds')) {
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

// Функция для получения провайдера - только кошелек пользователя
const getProvider = async () => {
  const currentProvider = await getCurrentProvider();
  
  // Возвращаем только провайдер кошелька пользователя, иначе null
  return currentProvider;
};

// Функция для проверки доступности провайдера
const isProviderAvailable = async () => {
  try {
    const currentProvider = await getCurrentProvider();
    if (!currentProvider) {
      return false;
    }
    
    // Проверяем, что провайдер может выполнить базовые операции
    await currentProvider.getNetwork();
    // Также проверяем возможность выполнения простого запроса
    await currentProvider.getBlockNumber();
    return true;
  } catch (error) {
    console.warn('Provider availability check failed:', error);
    return false;
  }
};

export const initializeContract = async (force = false) => {
  // Если уже инициализируется, возвращаем существующий промис
  if (initializationPromise && !force && !isInitializing) {
    return initializationPromise;
  }
  
  // Если контракт уже инициализирован и не force, возвращаем существующий экземпляр
  if (contractInstance && provider && !force) {
    // Проверяем, что провайдер все еще доступен
    const providerAvailable = await isProviderAvailable();
    if (providerAvailable) {
      return Promise.resolve(contractInstance);
    } else {
      // Если провайдер больше не доступен, сбрасываем состояние
      contractInstance = null;
      provider = null;
    }
  }
  
  // Устанавливаем флаг инициализации
  isInitializing = true;
  
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      // Получаем провайдер кошелька пользователя
      const p = await getProvider();
      if (!p) {
        throw new Error('No provider available - please connect your wallet');
      }
      provider = p;
      
      // Создаем экземпляр контракта
      contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );
      
      // Проверяем, что контракт отвечает
      try {
        await retryOperation(async () => {
          return await contractInstance.callStatic.prizePool();
        });
      } catch (validationError) {
        console.warn('Contract validation failed:', validationError);
        // Не прерываем инициализацию, если контракт недоступен по какой-либо причине
      }
      
      console.log('Contract initialized successfully with user wallet provider');
      resolve(contractInstance);
    } catch (error) {
      console.error('Failed to initialize contract:', error);
      // Log more details about the error
      if (error.reason) {
        console.error('Error reason:', error.reason);
      }
      if (error.code) {
        console.error('Error code:', error.code);
      }
      reject(error);
    } finally {
      // Сбрасываем флаг инициализации
      isInitializing = false;
    }
  });
  
  return initializationPromise;
};

// Function to check if contract is initialized with a valid provider
export const isContractInitialized = () => {
  return !!contractInstance && !!provider;
};

export const getContract = () => {
  if (!contractInstance) {
    throw new Error('Contract not initialized. Please call initializeContract() first.');
  }
  return contractInstance;
};

export const getContractAsync = async () => {
  // Проверяем, что провайдер все еще доступен
  const providerAvailable = await isProviderAvailable();
  
  // Если нет провайдера или контракт не инициализирован, инициализируем заново
  if (!providerAvailable || !contractInstance) {
    await initializeContract(true);
  }
  
  // Проверяем, что провайдер все еще доступен после инициализации
  const currentProvider = await getProvider();
  if (!currentProvider) {
    throw new Error('No provider available - please connect your wallet');
  }
  
  // Обновляем провайдер в случае, если он изменился
  if (currentProvider !== provider) {
    provider = currentProvider;
    
    // Обновляем экземпляр контракта с новым провайдером
    contractInstance = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );
  }
  
  return contractInstance;
};

export const getContractWithSigner = async (signer) => {
  try {
    // Убедимся, что контракт инициализирован перед использованием
    await initializeContract();
    
    if (!signer) {
      // Получаем провайдер кошелька пользователя
      const provider = await getProvider();
      if (!provider) {
        throw new Error('No provider available - please connect your wallet');
      }
      // Получаем signer из провайдера кошелька
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

    // Our contract doesn't have a TicketBought event, so we'll return empty array
    // The only event in our ABI is LotteryWon
    return [];
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
        return await contract.callStatic.prizePool();
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
  // Our contract doesn't have a specific event for ticket purchases,
  // The only event in our ABI is LotteryWon, so we'll return an empty unsubscriber
  return () => {};
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