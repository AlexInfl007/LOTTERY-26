import { ethers } from 'ethers';
import { getSharedProvider } from '../src/utils/providerStore';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../src/utils/contract';

let contractInstance = null;
let activeProvider = null;

async function ensurePolygon(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 137) {
    throw new Error(`Please switch to Polygon Mainnet in your wallet. Current chain ID: ${network.chainId}`);
  }
}

export const initializeContract = async (force = false) => {
  const provider = getSharedProvider();
  if (!provider) {
    throw new Error('No provider available - please connect your wallet');
  }

  if (!force && contractInstance && activeProvider === provider) {
    return contractInstance;
  }

  await ensurePolygon(provider);
  contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  activeProvider = provider;
  return contractInstance;
};

export const isContractInitialized = () => !!contractInstance && !!activeProvider;

export const getContract = () => {
  if (!contractInstance) {
    throw new Error('Contract not initialized. Please call initializeContract() first.');
  }
  return contractInstance;
};

export const getContractAsync = async () => {
  return initializeContract();
};

export const getContractWithSigner = async (signer) => {
  if (!signer) {
    throw new Error('Signer is required');
  }
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};
