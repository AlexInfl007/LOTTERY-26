import { CONTRACT_ADDRESS } from './contract';
import { ethers } from 'ethers';

// public RPC (free)
const DEFAULT_RPC = 'https://polygon-rpc.com'; // бесплатный публичный RPC

// provider можно заменить пользователем при желании
const provider = new ethers.JsonRpcProvider(DEFAULT_RPC);

// ABI контракта (поскольку он отсутствует в файле contract.js)
const CONTRACT_ABI = [
  "function prizePool() view returns (uint256)",
  "event TicketBought(address indexed buyer, uint256 indexed round)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

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
