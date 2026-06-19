/* eslint-disable no-undef */
// expo-secure-store native modülünü testte sahte (in-memory) ile değiştir.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k) => {
      store.delete(k);
    }),
  };
});

// expo-constants: API_BASE testte sabit
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiBase: 'http://test.local/api' } },
}));
