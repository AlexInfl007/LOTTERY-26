import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0xf90169AD413429af4AE0a3B8962648d4a3289011';
const TICKET_BOUGHT_TOPIC = ethers.id('TicketBought(address,uint256)');
const POLYGON_RPC_URL = 'https://polygon-rpc.com';
const CACHE_TTL_MS = 60 * 1000;

let provider = null;
let deploymentBlockCache = null;
let statsCache = {
  updatedAt: 0,
  totalTickets: 0,
  perUser: new Map(),
  recentEvents: []
};

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL, 137, { staticNetwork: true });
  }
  return provider;
}

async function resolveDeploymentBlock(rpcProvider) {
  if (Number.isFinite(deploymentBlockCache)) return deploymentBlockCache;

  const latest = await rpcProvider.getBlockNumber();
  let lo = 0;
  let hi = latest;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const code = await rpcProvider.getCode(CONTRACT_ADDRESS, mid);
    if (code && code !== '0x') {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  deploymentBlockCache = lo;
  return lo;
}

async function collectRecentEvents(rpcProvider, limit = 50) {
  const latest = await rpcProvider.getBlockNumber();
  const batchSize = 3000;
  const events = [];
  const blockTimestamps = new Map();

  for (let end = latest; end >= 0 && events.length < limit; end -= batchSize) {
    const start = Math.max(0, end - batchSize + 1);
    let logs = [];
    try {
      logs = await rpcProvider.getLogs({
        address: CONTRACT_ADDRESS,
        topics: [TICKET_BOUGHT_TOPIC],
        fromBlock: start,
        toBlock: end
      });
    } catch {
      continue;
    }

    for (let i = logs.length - 1; i >= 0 && events.length < limit; i -= 1) {
      const log = logs[i];
      const buyerTopic = Array.isArray(log?.topics) ? log.topics[1] : null;
      const roundTopic = Array.isArray(log?.topics) ? log.topics[2] : null;
      if (!buyerTopic) continue;

      const buyer = ethers.getAddress(`0x${buyerTopic.slice(-40)}`);
      const round = roundTopic ? Number(BigInt(roundTopic)) : null;
      const blockNumber = Number(log.blockNumber);

      if (!blockTimestamps.has(blockNumber)) {
        const block = await rpcProvider.getBlock(blockNumber);
        blockTimestamps.set(blockNumber, block?.timestamp ? Number(block.timestamp) * 1000 : Date.now());
      }

      events.push({
        id: `${log.transactionHash}:${log.index ?? i}`,
        buyer,
        round,
        timestamp: blockTimestamps.get(blockNumber)
      });
    }
  }

  return events;
}

async function rebuildStats() {
  const rpcProvider = getProvider();
  const fromBlock = await resolveDeploymentBlock(rpcProvider);
  const latest = await rpcProvider.getBlockNumber();
  const batchSize = 50000;
  const perUser = new Map();
  let totalTickets = 0;

  for (let start = fromBlock; start <= latest; start += batchSize) {
    const end = Math.min(latest, start + batchSize - 1);
    let logs = [];
    try {
      logs = await rpcProvider.getLogs({
        address: CONTRACT_ADDRESS,
        topics: [TICKET_BOUGHT_TOPIC],
        fromBlock: start,
        toBlock: end
      });
    } catch {
      continue;
    }

    totalTickets += logs.length;
    for (const log of logs) {
      const buyerTopic = Array.isArray(log?.topics) ? log.topics[1] : null;
      if (!buyerTopic) continue;
      const buyer = ethers.getAddress(`0x${buyerTopic.slice(-40)}`).toLowerCase();
      perUser.set(buyer, (perUser.get(buyer) || 0) + 1);
    }
  }

  const recentEvents = await collectRecentEvents(rpcProvider, 80);

  statsCache = {
    updatedAt: Date.now(),
    totalTickets,
    perUser,
    recentEvents
  };

  return statsCache;
}

async function getStats() {
  if (Date.now() - statsCache.updatedAt < CACHE_TTL_MS && Array.isArray(statsCache.recentEvents)) {
    return statsCache;
  }
  return rebuildStats();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const address = typeof req.query?.address === 'string' ? req.query.address.toLowerCase() : null;
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const stats = await getStats();
    const myTickets = address ? (stats.perUser.get(address) || 0) : null;

    res.status(200).json({
      totalTickets: stats.totalTickets || 0,
      myTickets,
      recentEvents: (stats.recentEvents || []).slice(0, limit),
      source: 'rpc-ticketbought-logs'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to build ticket stats',
      message: error?.message || 'Unknown error'
    });
  }
}
