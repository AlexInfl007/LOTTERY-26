import { ethers } from 'ethers';
import { getSharedProvider } from '../src/utils/providerStore';

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

const CONTRACT_ADDRESS = '0xf90169AD413429af4AE0a3B8962648d4a3289011';

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
