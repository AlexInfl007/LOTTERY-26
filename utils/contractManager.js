import { ethers } from 'ethers';
import { getProvider } from './ethersUtils';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../src/utils/contract';

// ABI контракта

let contractInstance = null;
let initializationPromise = null;

export const initializeContract = async (force = false) => {
  // Если уже инициализируется, возвращаем существующий промис
  if (initializationPromise && !force) {
    return initializationPromise;
  }
  
  initializationPromise = new Promise(async (resolve) => {
    try {
      const provider = getProvider();
      if (!provider) {
        console.warn('No provider available');
        resolve(null);
        return;
      }
      
      contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );
      
      // Проверяем, что контракт отвечает
      await contractInstance.prizePool().catch(() => null);
      
      console.log('Contract initialized successfully');
      resolve(contractInstance);
    } catch (error) {
      console.error('Failed to initialize contract:', error);
      contractInstance = null;
      resolve(null);
    }
  });
  
  return initializationPromise;
};

export const getContract = () => {
  return contractInstance;
};

export const getContractAsync = async () => {
  if (contractInstance) return contractInstance;
  return initializeContract();
};

export const getContractWithSigner = async () => {
  try {
    const signer = await getProvider(true);
    if (!signer) return null;
    
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