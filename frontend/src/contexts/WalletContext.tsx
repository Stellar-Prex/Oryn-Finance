import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  WalletNetwork,
  WalletSession,
  WalletType,
} from '@/types/wallet';
import {
  getWalletAdapter,
  NETWORK_PASSPHRASES,
  walletAdapters,
} from '@/wallet/providers';
import {
  clearWalletSession,
  loadWalletNetwork,
  loadWalletSession,
  saveWalletSession,
  WALLET_NETWORK_KEY,
} from '@/wallet/session';

const HORIZON_URLS: Record<WalletNetwork, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
};

interface WalletState {
  isConnected: boolean;
  address: string | null;
  xlmBalance: string;
  usdcBalance: string;
  isConnecting: boolean;
  isFreighterInstalled: boolean;
  isRabetInstalled: boolean;
  connectedWallet: WalletType | null;
  networkPassphrase: string | null;
  network: WalletNetwork;
  error: string | null;
}

interface WalletContextType extends WalletState {
  publicKey: string | null;
  connect: (walletType?: WalletType) => Promise<void>;
  switchWallet: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
  refreshBalances: () => Promise<void>;
  switchNetwork: (network: WalletNetwork) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const disconnectedState = (network: WalletNetwork): WalletState => ({
  isConnected: false,
  address: null,
  xlmBalance: '0',
  usdcBalance: '0',
  isConnecting: false,
  isFreighterInstalled: false,
  isRabetInstalled: false,
  connectedWallet: null,
  networkPassphrase: null,
  network,
  error: null,
});

async function fetchBalances(address: string, network: WalletNetwork) {
  try {
    const response = await fetch(`${HORIZON_URLS[network]}/accounts/${address}`);
    if (!response.ok) throw new Error('Failed to fetch account data');

    const accountData = await response.json();
    let xlmBalance = '0';
    let usdcBalance = '0';

    for (const balance of accountData.balances ?? []) {
      if (balance.asset_type === 'native') {
        xlmBalance = Number.parseFloat(balance.balance).toFixed(2);
      } else if (balance.asset_code === 'USDC') {
        usdcBalance = Number.parseFloat(balance.balance).toFixed(2);
      }
    }
    return { xlmBalance, usdcBalance };
  } catch (error) {
    console.warn('Failed to fetch wallet balances:', error);
    return { xlmBalance: '0', usdcBalance: '0' };
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(() =>
    disconnectedState(loadWalletNetwork())
  );
  const stateRef = useRef(state);
  const restoredRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const checkWalletInstallation = useCallback(async () => {
    const [isFreighterInstalled, isRabetInstalled] = await Promise.all([
      walletAdapters.freighter.isAvailable(),
      walletAdapters.rabet.isAvailable(),
    ]);
    setState((previous) => ({
      ...previous,
      isFreighterInstalled,
      isRabetInstalled,
    }));
  }, []);

  const applyConnection = useCallback(
    async (
      wallet: WalletType,
      address: string,
      network: WalletNetwork,
      networkPassphrase?: string
    ) => {
      const balances = await fetchBalances(address, network);
      const session: WalletSession = { wallet, address, network };
      saveWalletSession(session);
      setState((previous) => ({
        ...previous,
        ...balances,
        isConnected: true,
        isConnecting: false,
        address,
        connectedWallet: wallet,
        network,
        networkPassphrase:
          networkPassphrase ?? NETWORK_PASSPHRASES[network],
        error: null,
      }));
    },
    []
  );

  const connect = useCallback(
    async (requestedWallet?: WalletType) => {
      setState((previous) => ({
        ...previous,
        isConnecting: true,
        error: null,
      }));

      try {
        let wallet = requestedWallet;
        if (!wallet) {
          const availability = await Promise.all(
            (Object.keys(walletAdapters) as WalletType[]).map(async (type) => ({
              type,
              available: await walletAdapters[type].isAvailable(),
            }))
          );
          wallet = availability.find((item) => item.available)?.type;
        }
        if (!wallet) throw new Error('No supported wallet provider is available');

        const previous = stateRef.current;
        const connection = await getWalletAdapter(wallet).connect(previous.network);

        if (
          previous.connectedWallet &&
          previous.connectedWallet !== wallet
        ) {
          await getWalletAdapter(previous.connectedWallet).disconnect(
            previous.address ?? undefined
          );
        }

        await applyConnection(
          wallet,
          connection.address,
          previous.network,
          connection.networkPassphrase
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to connect wallet';
        setState((previous) => ({
          ...previous,
          isConnecting: false,
          error: message,
        }));
        throw new Error(message);
      }
    },
    [applyConnection]
  );

  const switchWallet = useCallback(
    async (walletType: WalletType) => connect(walletType),
    [connect]
  );

  const disconnect = useCallback(async () => {
    const current = stateRef.current;
    try {
      if (current.connectedWallet) {
        await getWalletAdapter(current.connectedWallet).disconnect(
          current.address ?? undefined
        );
      }
    } catch (error) {
      console.warn('Wallet provider disconnect failed:', error);
    } finally {
      clearWalletSession();
      setState((previous) => ({
        ...disconnectedState(previous.network),
        isFreighterInstalled: previous.isFreighterInstalled,
        isRabetInstalled: previous.isRabetInstalled,
      }));
    }
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    const current = stateRef.current;
    if (
      !current.isConnected ||
      !current.connectedWallet ||
      !current.address
    ) {
      throw new Error('Wallet is not connected');
    }
    return getWalletAdapter(current.connectedWallet).signTransaction(
      xdr,
      current.network,
      current.address
    );
  }, []);

  const refreshBalances = useCallback(async () => {
    const current = stateRef.current;
    if (!current.address) return;
    const balances = await fetchBalances(current.address, current.network);
    setState((previous) => ({ ...previous, ...balances }));
  }, []);

  const switchNetwork = useCallback((network: WalletNetwork) => {
    localStorage.setItem(WALLET_NETWORK_KEY, network);
    const current = stateRef.current;
    if (current.connectedWallet && current.address) {
      saveWalletSession({
        wallet: current.connectedWallet,
        address: current.address,
        network,
      });
      void fetchBalances(current.address, network).then((balances) => {
        setState((previous) => ({
          ...previous,
          ...balances,
          network,
          networkPassphrase: NETWORK_PASSPHRASES[network],
        }));
      });
    } else {
      setState((previous) => ({ ...previous, network }));
    }
  }, []);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    void checkWalletInstallation();

    const session = loadWalletSession();
    if (!session) return;

    setState((previous) => ({ ...previous, isConnecting: true }));
    void getWalletAdapter(session.wallet)
      .restore(session)
      .then(async (connection) => {
        if (!connection) {
          clearWalletSession();
          setState((previous) => ({
            ...disconnectedState(session.network),
            isFreighterInstalled: previous.isFreighterInstalled,
            isRabetInstalled: previous.isRabetInstalled,
          }));
          return;
        }
        await applyConnection(
          session.wallet,
          connection.address,
          session.network,
          connection.networkPassphrase
        );
      })
      .catch((error) => {
        console.warn('Failed to restore wallet session:', error);
        clearWalletSession();
        setState((previous) => ({
          ...disconnectedState(session.network),
          isFreighterInstalled: previous.isFreighterInstalled,
          isRabetInstalled: previous.isRabetInstalled,
        }));
      });
  }, [applyConnection, checkWalletInstallation]);

  useEffect(() => {
    if (!state.isConnected || !state.address) return;
    const interval = window.setInterval(() => void refreshBalances(), 30_000);
    return () => window.clearInterval(interval);
  }, [state.isConnected, state.address, refreshBalances]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        publicKey: state.address,
        connect,
        switchWallet,
        disconnect,
        signTransaction,
        refreshBalances,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
