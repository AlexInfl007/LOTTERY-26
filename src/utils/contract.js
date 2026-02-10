// src/utils/contract.js
// Contract address and ABI for Seren Lottery Chain

export const CONTRACT_ADDRESS = "0xf90169AD413429af4AE0a3B8962648d4a3289011";

// ABI for the lottery contract - includes methods for reading prize pool and ticket events
export const CONTRACT_ABI = [
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
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "buyer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "round",
        "type": "uint256"
      }
    ],
    "name": "TicketBought",
    "type": "event"
  }
];
