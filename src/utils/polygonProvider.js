import { ethers } from 'ethers';
import { rpcManager, initializeRpcConnection } from '../config/rpcConfig';

let polygonProvider = null;

/**
 * Инициализировать провайдер Polygon с использованием надежного RPC-менеджера
 */
export const initializePolygonProvider = async () => {
  try {
    // Инициализируем RPC-соединение (найдем первый работающий RPC)
    await initializeRpcConnection();
    
    // Создаем провайдер ethers.js с текущим активным RPC
    const currentRpcUrl = rpcManager.getCurrentRpcUrl();
    polygonProvider = new ethers.JsonRpcProvider(currentRpcUrl);
    
    console.log(`Провайдер Polygon инициализирован с RPC: ${currentRpcUrl}`);
    
    // Добавляем обработчик событий для переподключения при ошибках
    polygonProvider.on('error', async (error) => {
      console.error('Ошибка провайдера Polygon:', error);
      
      // При ошибке переключаемся на следующий RPC и пересоздаем провайдер
      const newRpcUrl = rpcManager.switchToNextRpc();
      polygonProvider = new ethers.JsonRpcProvider(newRpcUrl);
      
      console.log(`Провайдер переключен на новый RPC: ${newRpcUrl}`);
    });
    
    return polygonProvider;
  } catch (error) {
    console.error('Ошибка при инициализации провайдера Polygon:', error);
    throw error;
  }
};

/**
 * Получить текущий провайдер Polygon
 */
export const getPolygonProvider = () => {
  if (!polygonProvider) {
    throw new Error('Провайдер Polygon не инициализирован. Вызовите initializePolygonProvider() сначала.');
  }
  return polygonProvider;
};

/**
 * Функция для выполнения RPC-вызовов через наш менеджер и преобразования для ethers.js
 */
export const makePolygonRpcCall = async (method, params = []) => {
  try {
    return await rpcManager.makeRpcCall(method, params);
  } catch (error) {
    console.error('Ошибка при выполнении RPC-вызова Polygon:', error);
    throw error;
  }
};

/**
 * Функция для получения провайдера с автоматической проверкой и восстановлением соединения
 */
export const getValidPolygonProvider = async () => {
  if (!polygonProvider) {
    return await initializePolygonProvider();
  }

  try {
    // Проверяем соединение, запросив номер последнего блока
    await polygonProvider.getBlockNumber();
    return polygonProvider;
  } catch (error) {
    console.warn('Текущий провайдер Polygon недоступен, переключаемся...', error);
    
    // Переключаемся на следующий RPC и создаем нового провайдера
    const newRpcUrl = rpcManager.switchToNextRpc();
    polygonProvider = new ethers.JsonRpcProvider(newRpcUrl);
    
    console.log(`Провайдер пересоздан с новым RPC: ${newRpcUrl}`);
    return polygonProvider;
  }
};