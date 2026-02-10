import { ethers } from 'ethers';

// ABI вашего смарт-контракта
const contractABI = [
  // Основные функции чтения
  {
    "inputs": [],
    "name": "getCurrentJackpot",
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
    "name": "getTotalTicketsSold",
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
    "name": "getUserTickets",
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
    "name": "getRoundId",
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
    "name": "getPoolTarget",
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
  // Функция покупки билета
  {
    "inputs": [],
    "name": "buyTicket",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

const contractAddress = '0xf90169ad413429af4ae0a3b8962648d4a3289011';
const polygonRpcUrl = 'https://polygon-rpc.com/';

class ContractService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(polygonRpcUrl);
    this.contract = new ethers.Contract(contractAddress, contractABI, this.provider);
  }

  async getCurrentJackpot() {
    try {
      const jackpot = await this.contract.getCurrentJackpot();
      return parseFloat(ethers.formatEther(jackpot));
    } catch (error) {
      console.error('Error fetching jackpot:', error);
      return 0;
    }
  }

  async getTotalTicketsSold() {
    try {
      const tickets = await this.contract.getTotalTicketsSold();
      return parseInt(tickets);
    } catch (error) {
      console.error('Error fetching total tickets sold:', error);
      return 0;
    }
  }

  async getUserTickets(userAddress) {
    try {
      if (!userAddress) return 0;
      const tickets = await this.contract.getUserTickets(userAddress);
      return parseInt(tickets);
    } catch (error) {
      console.error('Error fetching user tickets:', error);
      return 0;
    }
  }

  async getRoundId() {
    try {
      const roundId = await this.contract.getRoundId();
      return parseInt(roundId);
    } catch (error) {
      console.error('Error fetching round ID:', error);
      return 1; // по умолчанию
    }
  }

  async getPoolTarget() {
    try {
      const target = await this.contract.getPoolTarget();
      return parseFloat(ethers.formatEther(target));
    } catch (error) {
      console.error('Error fetching pool target:', error);
      return 1000000; // по умолчанию
    }
  }

  async buyTicket(userAddress, signer) {
    try {
      const contractWithSigner = this.contract.connect(signer);
      const tx = await contractWithSigner.buyTicket({ value: ethers.parseEther('30') });
      await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error buying ticket:', error);
      throw error;
    }
  }

  async listenToEvents(setFeed) {
    // Подписка на события контракта
    try {
      // Здесь можно добавить прослушивание событий типа TicketPurchased, JackpotIncreased и т.д.
      // Пример: this.contract.on("TicketPurchased", (user, count, event) => { ... });
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }
}

export default new ContractService();