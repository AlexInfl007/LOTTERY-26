// src/utils/contractInteraction.js
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS } from './contract';

// Placeholder ABI - in a real implementation, you would import the actual ABI from your compiled contract
const CONTRACT_ABI = [
  // Add the actual ABI of your lottery contract here
  // For example:
  "function getCurrentPoolAmount() view returns (uint256)",
  "function getTotalTicketsSold() view returns (uint256)",
  "function participate() payable",
  "function getRecentTransactions() view returns (tuple(address user, uint256 amount, uint256 timestamp)[] memory)",
  "function getWinners() view returns (tuple(address winner, uint256 round, uint256 reward)[] memory)",
];

let contractInstance = null;
let signer = null;

// Initialize contract connection
export const initializeContract = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      
      // Create contract instance
      contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      return { contractInstance, signer, provider };
    } catch (error) {
      console.error('Error initializing contract:', error);
      throw error;
    }
  } else {
    throw new Error('Ethereum wallet not found. Please install MetaMask or another Ethereum wallet.');
  }
};

// Get current pool amount from the contract
export const getCurrentPoolAmount = async () => {
  try {
    if (!contractInstance) {
      await initializeContract();
    }
    
    const poolAmount = await contractInstance.getCurrentPoolAmount();
    return parseFloat(ethers.formatEther(poolAmount));
  } catch (error) {
    console.error('Error getting pool amount:', error);
    // Return mock data in case of error for development purposes
    return 300.0;
  }
};

// Get total tickets sold from the contract
export const getTotalTicketsSold = async () => {
  try {
    if (!contractInstance) {
      await initializeContract();
    }
    
    const ticketsSold = await contractInstance.getTotalTicketsSold();
    return parseInt(ticketsSold.toString());
  } catch (error) {
    console.error('Error getting tickets sold:', error);
    // Return mock data in case of error for development purposes
    return 12;
  }
};

// Participate in the lottery
export const participateInLottery = async (amount) => {
  try {
    if (!contractInstance) {
      await initializeContract();
    }
    
    // Convert POL amount to wei (assuming POL is similar to ETH with 18 decimals)
    const amountInWei = ethers.parseEther(amount.toString());
    
    // Call the participate function
    const tx = await contractInstance.participate({ value: amountInWei });
    await tx.wait(); // Wait for transaction to be mined
    
    return tx;
  } catch (error) {
    console.error('Error participating in lottery:', error);
    throw error;
  }
};

// Get recent transactions from the contract
export const getRecentTransactions = async () => {
  try {
    if (!contractInstance) {
      await initializeContract();
    }
    
    const transactions = await contractInstance.getRecentTransactions();
    
    // Format transactions to match the expected structure
    return transactions.map(tx => ({
      user: tx.user,
      amount: parseFloat(ethers.formatEther(tx.amount)),
      timestamp: parseInt(tx.timestamp.toString())
    }));
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    // Return mock data in case of error for development purposes
    return [];
  }
};

// Get winners from the contract
export const getWinners = async () => {
  try {
    if (!contractInstance) {
      await initializeContract();
    }
    
    const winners = await contractInstance.getWinners();
    
    // Format winners to match the expected structure
    return winners.map(winner => ({
      address: winner.winner,
      round: parseInt(winner.round.toString()),
      reward: parseFloat(ethers.formatEther(winner.reward))
    }));
  } catch (error) {
    console.error('Error getting winners:', error);
    // Return mock data in case of error for development purposes
    return [];
  }
};

// Check if wallet is connected
export const isWalletConnected = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0;
    } catch {
      return false;
    }
  }
  return false;
};

// Get connected wallet address
export const getConnectedAddress = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0 ? accounts[0] : null;
    } catch {
      return null;
    }
  }
  return null;
};