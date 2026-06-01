// src/utils/contractManager.js
// Singleton contract manager - only creates contract instances after wallet connection

import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';

let contractInstance = null;

/**
 * Initialize contract with signer after wallet connection.
 * This must be called AFTER the user connects their wallet and switches to Polygon.
 */
export function initializeContract(signer) {
  if (!signer) {
    contractInstance = null;
    return null;
  }
  
  contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return contractInstance;
}

/**
 * Get the contract instance (only available after wallet connection)
 */
export function getContract() {
  return contractInstance;
}

/**
 * Get contract instance with signer for write operations.
 * Throws error if wallet is not connected.
 */
export function getContractWithSigner(signer) {
  if (!signer) {
    throw new Error('Connect wallet to interact with contract');
  }
  
  if (!contractInstance || contractInstance.signer !== signer) {
    contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }
  
  return contractInstance;
}

/**
 * Clear contract instance on wallet disconnect
 */
export function clearContract() {
  contractInstance = null;
}
