/**
 * Конфигурация RPC-эндпоинтов для сети Polygon
 * Содержит список доступных RPC-серверов с приоритетом использования
 */

export const POLYGON_RPC_URLS = [
  'https://polygon.drpc.org',
  'https://polygon-rpc.com',
  'https://rpc-mainnet.maticvigil.com',
  'https://rpc-mainnet.matic.network',
  'https://matic-mainnet.chainstacklabs.com',
  'https://polygon-mainnet.public.blastapi.io',
  'https://rpc-mainnet.matic.quiknode.pro',
  'https://polygon.llamarpc.com',
  'https://1rpc.io/matic',
  'https://polygon-bor.publicnode.com'
];

/**
 * Класс для управления подключением к RPC с автоматическим переключением
 */
export class RpcManager {
  constructor(rpcUrls = POLYGON_RPC_URLS) {
    this.rpcUrls = [...rpcUrls]; // Создаем копию массива
    this.currentRpcIndex = 0;
    this.failedRpcs = new Set(); // Отслеживаем не работающие RPC
  }

  /**
   * Получить текущий активный RPC URL
   */
  getCurrentRpcUrl() {
    return this.rpcUrls[this.currentRpcIndex];
  }

  /**
   * Переключиться на следующий доступный RPC
   */
  switchToNextRpc() {
    const startIndex = this.currentRpcIndex;
    
    do {
      this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
      
      // Проверяем, не попали ли мы снова на уже отмеченный как неработающий RPC
      if (!this.failedRpcs.has(this.rpcUrls[this.currentRpcIndex])) {
        console.log(`Переключение на RPC: ${this.rpcUrls[this.currentRpcIndex]}`);
        return this.rpcUrls[this.currentRpcIndex];
      }
    } while (this.currentRpcIndex !== startIndex);
    
    // Если все RPC помечены как неработающие, сбросим список неудачных и вернем первый
    console.warn('Все RPC-серверы были отмечены как неработающие, сброс списка неудачных');
    this.failedRpcs.clear();
    this.currentRpcIndex = 0;
    return this.rpcUrls[0];
  }

  /**
   * Отметить текущий RPC как неработающий и переключиться на следующий
   */
  markCurrentRpcAsFailed() {
    this.failedRpcs.add(this.getCurrentRpcUrl());
    return this.switchToNextRpc();
  }

  /**
   * Выполнить RPC-запрос с автоматическим переключением на другой узел при ошибке
   */
  async makeRpcCall(method, params = []) {
    let attempts = 0;
    const maxAttempts = this.rpcUrls.length;
    
    while (attempts < maxAttempts) {
      try {
        const rpcUrl = this.getCurrentRpcUrl();
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(`RPC error: ${data.error.message}`);
        }

        return data.result;
      } catch (error) {
        console.warn(`Ошибка при обращении к RPC ${this.getCurrentRpcUrl()}:`, error.message);
        
        // Отмечаем текущий RPC как неработающий и переключаемся на следующий
        this.markCurrentRpcAsFailed();
        attempts++;
        
        // Если это была последняя попытка, выбрасываем ошибку
        if (attempts >= maxAttempts) {
          throw new Error(`Не удалось выполнить RPC-запрос после ${maxAttempts} попыток. Все доступные RPC-серверы недоступны.`);
        }
      }
    }
  }

  /**
   * Проверить работоспособность RPC-сервера
   */
  async testRpcConnection(rpcUrl) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test',
          method: 'eth_blockNumber',
          params: []
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return !!data.result;
    } catch (error) {
      console.warn(`Тест подключения к ${rpcUrl} не удался:`, error.message);
      return false;
    }
  }

  /**
   * Найти первый работающий RPC из списка
   */
  async findWorkingRpc() {
    for (const rpcUrl of this.rpcUrls) {
      if (await this.testRpcConnection(rpcUrl)) {
        this.currentRpcIndex = this.rpcUrls.indexOf(rpcUrl);
        console.log(`Найден рабочий RPC: ${rpcUrl}`);
        return rpcUrl;
      }
    }
    
    throw new Error('Не удалось найти ни одного работающего RPC-сервера');
  }
}

// Экземпляр менеджера RPC для использования в приложении
export const rpcManager = new RpcManager();

// Асинхронная инициализация - поиск первого работающего RPC
export const initializeRpcConnection = async () => {
  try {
    await rpcManager.findWorkingRpc();
    console.log(`Подключение к Polygon RPC установлено: ${rpcManager.getCurrentRpcUrl()}`);
  } catch (error) {
    console.error('Не удалось установить подключение к RPC:', error.message);
    throw error;
  }
};