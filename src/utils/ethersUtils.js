import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contract';
import { ethers } from 'ethers';

// public RPC (free)
const DEFAULT_RPC = 'https://polygon-rpc.com'; // бесплатный публичный RPC

// provider можно заменить пользователем при желании
let provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// Функция для обновления провайдера с учетом подключенного кошелька
export function updateProviderWithSigner(signer) {
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// read prize pool (returns number in MATIC/POL decimals assumed 18 -> convert to ether)
export async function readPrizePool() {
  try {
    const raw = await contract.prizePool();
    // ethers v6 returns BigInt; format as number
    const formatted = Number(ethers.formatEther(raw || 0));
    return formatted;
  } catch (e) {
    console.error('readPrizePool error', e);
    return 0;
  }
}

// get current round ID
export async function getCurrentRound() {
  try {
    const raw = await contract.roundId();
    return Number(raw || 0);
  } catch (e) {
    console.error('getCurrentRound error', e);
    return 0;
  }
}

// get tickets count for an address
export async function getUserTickets(userAddress) {
  try {
    const raw = await contract.tickets(userAddress);
    return Number(raw || 0);
  } catch (e) {
    console.error('getUserTickets error', e);
    return 0;
  }
}

// buy ticket function
export async function buyTicket(roundId, value, signer) {
  try {
    // Обновляем контракт с signer'ом для выполнения транзакции
    const walletContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    
    // Отправляем транзакцию на покупку билета
    const tx = await walletContract.buyTicket(roundId, { value: value });
    console.log("Transaction sent:", tx.hash);
    
    // Ждем подтверждения транзакции
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt.hash);
    
    return { success: true, hash: tx.hash };
  } catch (e) {
    console.error('buyTicket error', e);
    return { success: false, error: e.message };
  }
}

// get reward for user
export async function getUserReward(userAddress) {
  try {
    const raw = await contract.getReward(userAddress);
    return Number(ethers.formatEther(raw || 0));
  } catch (e) {
    console.error('getUserReward error', e);
    return 0;
  }
}

// get winners for current round
export async function getWinners() {
  try {
    const currentRound = await getCurrentRound();
    const winnersArray = [];
    
    // Получаем всех победителей для текущего раунда
    for (let i = 0; i <= currentRound; i++) {
      try {
        const winnerAddress = await contract.winners(i);
        if (winnerAddress !== '0x0000000000000000000000000000000000000000') {
          winnersArray.push(winnerAddress);
        }
      } catch (e) {
        // Если не удается получить адрес победителя для конкретного индекса, продолжаем
        break;
      }
    }
    
    return winnersArray;
  } catch (e) {
    console.error('getWinners error', e);
    return [];
  }
}

// subscribe to TicketBought events -> calls callback with readable message
export function watchTicketEvents(onEvent) {
  const handler = (buyer, round) => {
    try {
      const msg = `${buyer} купил билет (round #${round?.toString?.() ?? ''})`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  contract.on('TicketBought', handler);

  // return unsubscribe
  return () => {
    contract.off('TicketBought', handler);
  };
}

// subscribe to WinnerSelected events
export function watchWinnerEvents(onEvent) {
  const handler = (winner, amount, roundId) => {
    try {
      const formattedAmount = ethers.formatEther(amount);
      const msg = `${winner} выиграл ${formattedAmount} POL в раунде ${roundId}`;
      onEvent(msg);
    } catch (err) {
      console.error(err);
    }
  };

  contract.on('WinnerSelected', handler);

  // return unsubscribe
  return () => {
    contract.off('WinnerSelected', handler);
  };
}
