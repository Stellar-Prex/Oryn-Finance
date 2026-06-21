import albedo from '@albedo-link/intent';
import {
  getAddress,
  getNetworkDetails,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction as signWithFreighter,
} from '@stellar/freighter-api';
import {
  WalletAdapter,
  WalletNetwork,
  WalletSession,
  WalletType,
} from '@/types/wallet';
import {
  connectRabet,
  disconnectRabet,
  isRabetAvailable,
  isRabetUnlocked,
  signWithRabet,
} from '@/wallet/connectRabet';

export const NETWORK_PASSPHRASES: Record<WalletNetwork, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown wallet error';
}

export function normalizeWalletError(
  error: unknown,
  action: 'connect' | 'sign' | 'restore' = 'connect'
): Error {
  const message = errorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('reject') ||
    lower.includes('declin') ||
    lower.includes('denied') ||
    lower.includes('closed')
  ) {
    return new Error(
      action === 'sign'
        ? 'Transaction rejected by user'
        : 'Wallet connection rejected by user'
    );
  }

  return new Error(message || `Failed to ${action} wallet`);
}

function assertFreighterResult<T extends { error?: { message?: string } }>(
  result: T
): T {
  if (result.error) {
    throw new Error(result.error.message || 'Freighter request failed');
  }
  return result;
}

export const freighterAdapter: WalletAdapter = {
  id: 'freighter',
  name: 'Freighter',
  type: 'extension',
  async isAvailable() {
    try {
      return assertFreighterResult(await isConnected()).isConnected;
    } catch {
      return false;
    }
  },
  async connect(network) {
    try {
      const access = assertFreighterResult(await requestAccess());
      if (!access.address) throw new Error('No account found in Freighter');
      const details = assertFreighterResult(await getNetworkDetails());
      if (details.networkPassphrase !== NETWORK_PASSPHRASES[network]) {
        throw new Error(
          `Freighter is not connected to Stellar ${network}. Switch networks in Freighter and try again.`
        );
      }
      return {
        address: access.address,
        networkPassphrase: details.networkPassphrase,
      };
    } catch (error) {
      throw normalizeWalletError(error);
    }
  },
  async restore(session) {
    try {
      const connected = assertFreighterResult(await isConnected());
      const allowed = assertFreighterResult(await isAllowed());
      if (!connected.isConnected || !allowed.isAllowed) return null;

      const account = assertFreighterResult(await getAddress());
      if (!account.address || account.address !== session.address) return null;
      const details = assertFreighterResult(await getNetworkDetails());
      if (
        details.networkPassphrase !== NETWORK_PASSPHRASES[session.network]
      ) {
        return null;
      }
      return {
        address: account.address,
        networkPassphrase: details.networkPassphrase,
      };
    } catch {
      return null;
    }
  },
  async disconnect() {
    // Freighter does not expose an application-level disconnect API.
  },
  async signTransaction(xdr, network, address) {
    try {
      const result = assertFreighterResult(
        await signWithFreighter(xdr, {
          address,
          networkPassphrase: NETWORK_PASSPHRASES[network],
        })
      );
      if (!result.signedTxXdr) {
        throw new Error('Freighter returned an empty signed transaction');
      }
      return result.signedTxXdr;
    } catch (error) {
      throw normalizeWalletError(error, 'sign');
    }
  },
};

export const rabetAdapter: WalletAdapter = {
  id: 'rabet',
  name: 'Rabet',
  type: 'extension',
  async isAvailable() {
    return isRabetAvailable();
  },
  async connect() {
    try {
      return { address: await connectRabet() };
    } catch (error) {
      throw normalizeWalletError(error);
    }
  },
  async restore(session) {
    if (!isRabetAvailable() || !(await isRabetUnlocked())) return null;
    try {
      const address = await connectRabet();
      return address === session.address ? { address } : null;
    } catch {
      return null;
    }
  },
  async disconnect() {
    await disconnectRabet();
  },
  async signTransaction(xdr, network) {
    try {
      return await signWithRabet(xdr, network);
    } catch (error) {
      throw normalizeWalletError(error, 'sign');
    }
  },
};

export const albedoAdapter: WalletAdapter = {
  id: 'albedo',
  name: 'Albedo',
  type: 'web',
  async isAvailable() {
    return typeof window !== 'undefined';
  },
  async connect(network) {
    try {
      const result = await albedo.implicitFlow({
        intents: ['tx'],
        network: NETWORK_PASSPHRASES[network],
      });
      if (!result.granted || !result.pubkey) {
        throw new Error('Albedo connection was not granted');
      }
      return {
        address: result.pubkey,
        networkPassphrase: NETWORK_PASSPHRASES[network],
      };
    } catch (error) {
      throw normalizeWalletError(error);
    }
  },
  async restore(session) {
    const activeSession = albedo
      .listImplicitSessions()
      .find(
        (item) =>
          item.pubkey === session.address && item.grants.includes('tx')
      );
    return activeSession
      ? {
          address: session.address,
          networkPassphrase: NETWORK_PASSPHRASES[session.network],
        }
      : null;
  },
  async disconnect(address) {
    if (address) albedo.forgetImplicitSession(address);
  },
  async signTransaction(xdr, network, address) {
    try {
      const result = await albedo.tx({
        xdr,
        pubkey: address,
        network: NETWORK_PASSPHRASES[network],
        submit: false,
      });
      if (!result.signed_envelope_xdr) {
        throw new Error('Albedo returned an empty signed transaction');
      }
      return result.signed_envelope_xdr;
    } catch (error) {
      throw normalizeWalletError(error, 'sign');
    }
  },
};

export const walletAdapters: Record<WalletType, WalletAdapter> = {
  freighter: freighterAdapter,
  rabet: rabetAdapter,
  albedo: albedoAdapter,
};

export function getWalletAdapter(type: WalletType): WalletAdapter {
  const adapter = walletAdapters[type];
  if (!adapter) throw new Error(`Unsupported wallet type: ${type}`);
  return adapter;
}

export async function detectWalletProviders() {
  return Promise.all(
    Object.values(walletAdapters).map(async (adapter) => ({
      id: adapter.id,
      name: adapter.name,
      type: adapter.type,
      available: await adapter.isAvailable(),
    }))
  );
}
