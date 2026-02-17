import { ethers } from 'ethers';
import { getCurrentProvider } from '../src/utils/ethersUtils';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../src/utils/contract';

// Configuration constants
const DEFAULT_RPC = 'https://polygon-rpc.com';
const CONTRACT_RETRY_ATTEMPTS = 5;
const CONTRACT_RETRY_DELAY = 1000; // ms
const PROVIDER_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Internal state
let contractInstance = null;
let initializationPromise = null;
let currentProvider = null;
let healthCheckInterval = null;
let isInitialized = false;

// Create a backup provider for fallback
let backupProvider = new ethers.JsonRpcProvider(DEFAULT_RPC);

/**
 * Test if provider is healthy by making a simple call
 */
async function testProviderHealth(provider) {
  try {
    await provider.getBlockNumber();
    return true;
  } catch (error) {
    console.warn('Provider health check failed:', error.message);
    return false;
  }
}

/**
 * Initialize or validate the provider
 */
async function ensureValidProvider() {
  // If we have a current provider, check if it's still healthy
  if (currentProvider) {
    const isHealthy = await testProviderHealth(currentProvider);
    if (isHealthy) {
      return currentProvider;
    }
  }

  // Try to get the current provider from ethersUtils
  try {
    const providerFromUtils = getCurrentProvider();
    if (providerFromUtils && await testProviderHealth(providerFromUtils)) {
      currentProvider = providerFromUtils;
      return currentProvider;
    }
  } catch (error) {
    console.warn('Could not get provider from ethersUtils:', error.message);
  }

  // Fall back to backup provider
  currentProvider = backupProvider;
  return backupProvider;
}

/**
 * Initialize the contract with retry logic
 */
export const initializeContract = async (force = false) => {
  // If already initialized and not forcing, return the existing instance
  if (isInitialized && contractInstance && !force) {
    return contractInstance;
  }

  // If already initializing, return the existing promise
  if (initializationPromise && !force) {
    return initializationPromise;
  }

  initializationPromise = new Promise(async (resolve) => {
    let lastError = null;

    for (let attempt = 1; attempt <= CONTRACT_RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`Contract initialization attempt ${attempt}/${CONTRACT_RETRY_ATTEMPTS}`);
        
        const provider = await ensureValidProvider();
        if (!provider) {
          throw new Error('No valid provider available');
        }

        contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

        // Test the contract by calling a method
        await contractInstance.prizePool();

        console.log('Contract initialized successfully');
        isInitialized = true;
        
        // Start health checks
        if (!healthCheckInterval) {
          startHealthChecks();
        }
        
        resolve(contractInstance);
        return;
      } catch (error) {
        console.error(`Contract initialization attempt ${attempt} failed:`, error);
        lastError = error;

        // Wait before retrying (except on the last attempt)
        if (attempt < CONTRACT_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, CONTRACT_RETRY_DELAY));
        }
      }
    }

    // If all attempts failed
    console.error('All contract initialization attempts failed:', lastError);
    contractInstance = null;
    isInitialized = false;
    resolve(null);
  });

  return initializationPromise;
};

/**
 * Start periodic health checks for the provider
 */
function startHealthChecks() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    try {
      if (contractInstance) {
        // Test that the contract is still responsive
        await contractInstance.prizePool();
      }
    } catch (error) {
      console.warn('Contract health check failed, attempting re-initialization:', error);
      // Attempt to reinitialize the contract
      isInitialized = false;
      contractInstance = null;
      await initializeContract(true);
    }
  }, PROVIDER_HEALTH_CHECK_INTERVAL);
}

/**
 * Get the current contract instance (synchronous)
 */
export const getContract = () => {
  return contractInstance;
};

/**
 * Get the contract instance asynchronously, initializing if needed
 */
export const getContractAsync = async () => {
  if (contractInstance) {
    // Still perform a quick health check occasionally
    try {
      await contractInstance.prizePool();
      return contractInstance;
    } catch (error) {
      console.warn('Existing contract instance failed health check, reinitializing:', error);
      isInitialized = false;
      contractInstance = null;
    }
  }
  
  return initializeContract();
};

/**
 * Get contract instance with a signer
 */
export const getContractWithSigner = async (signer) => {
  if (!signer) {
    console.error('No signer provided for contract with signer');
    return null;
  }

  try {
    // Create a new contract instance with the signer
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

/**
 * Force reconnection with a new provider
 */
export const reconnectProvider = async (newProvider) => {
  console.log('Reconnecting with new provider');
  
  // Clear current contract instance
  contractInstance = null;
  isInitialized = false;
  
  // Update the current provider
  if (newProvider) {
    currentProvider = newProvider;
  } else {
    // Fall back to backup provider
    currentProvider = backupProvider;
  }
  
  // Reinitialize the contract
  return await initializeContract(true);
};

/**
 * Clean up resources
 */
export const cleanupContractManager = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  contractInstance = null;
  initializationPromise = null;
  isInitialized = false;
  currentProvider = null;
};

// Initialize on module load
initializeContract();