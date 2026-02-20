import { ethers } from 'ethers';

// We'll use only the user's wallet provider as the main provider
let polygonProvider = null;

/**
 * Initialize Polygon provider with user's wallet provider (should be called when wallet connects)
 */
export const initializePolygonProvider = async (walletProvider) => {
  try {
    polygonProvider = walletProvider;
    
    // Test the provider with a basic call to ensure it's working
    try {
      // Get network info to verify the provider works
      const network = await polygonProvider.getNetwork();
      console.log('Провайдер Polygon инициализирован с провайдером кошелька пользователя. Сеть:', network.name || network.chainId);
      
      // Additional test: get block number to ensure full functionality
      const blockNumber = await polygonProvider.getBlockNumber();
      console.log('Тестовый номер блока:', blockNumber);
    } catch (testError) {
      console.warn('Предупреждение: ошибка при тестировании провайдера Polygon:', testError);
      // Don't throw here as some wallets might have restrictions on certain methods
    }
    
    return polygonProvider;
  } catch (error) {
    console.error('Ошибка при инициализации провайдера Polygon:', error);
    throw error;
  }
};

/**
 * Get current Polygon provider
 */
export const getPolygonProvider = () => {
  if (!polygonProvider) {
    // Return null if no wallet connected
    return null;
  }
  return polygonProvider;
};

/**
 * Function to make RPC calls through the user's wallet provider
 */
export const makePolygonRpcCall = async (method, params = []) => {
  if (!polygonProvider) {
    throw new Error('Провайдер Polygon не инициализирован. Подключите кошелек пользователя.');
  }
  
  try {
    const response = await fetch(polygonProvider.connection.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    console.error('Ошибка при выполнении RPC-вызова Polygon:', error);
    throw error;
  }
};

/**
 * Function to get provider with automatic checking and recovery
 */
export const getValidPolygonProvider = async () => {
  if (!polygonProvider) {
    throw new Error('Провайдер Polygon не инициализирован. Подключите кошелек пользователя.');
  }
  
  // Test if provider is still responsive
  try {
    // Check if provider is responsive by making a quick call
    await polygonProvider.getBlockNumber();
  } catch (error) {
    console.warn('Провайдер Polygon не отвечает:', error);
    throw new Error('Провайдер Polygon не отвечает. Проверьте подключение кошелька.');
  }
  
  return polygonProvider;
};