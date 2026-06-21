import { WalletNetwork, WalletSession, WalletType } from '@/types/wallet';

export const WALLET_SESSION_KEY = 'oryn.wallet.session.v1';
export const WALLET_NETWORK_KEY = 'walletNetwork';

const walletTypes: WalletType[] = ['freighter', 'rabet', 'albedo'];
const networks: WalletNetwork[] = ['mainnet', 'testnet'];

export function saveWalletSession(session: WalletSession): void {
  localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(WALLET_NETWORK_KEY, session.network);
}

export function loadWalletSession(): WalletSession | null {
  try {
    const raw = localStorage.getItem(WALLET_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as WalletSession;
    if (
      !walletTypes.includes(session.wallet) ||
      !networks.includes(session.network) ||
      typeof session.address !== 'string' ||
      session.address.length === 0
    ) {
      clearWalletSession();
      return null;
    }

    return session;
  } catch {
    clearWalletSession();
    return null;
  }
}

export function loadWalletNetwork(): WalletNetwork {
  const network = localStorage.getItem(WALLET_NETWORK_KEY);
  return networks.includes(network as WalletNetwork)
    ? (network as WalletNetwork)
    : 'mainnet';
}

export function clearWalletSession(): void {
  localStorage.removeItem(WALLET_SESSION_KEY);
  localStorage.removeItem('walletConnected');
  localStorage.removeItem('walletAddress');
  localStorage.removeItem('connectedWallet');
}
