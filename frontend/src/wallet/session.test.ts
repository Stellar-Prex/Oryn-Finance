import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWalletSession,
  loadWalletNetwork,
  loadWalletSession,
  saveWalletSession,
  WALLET_NETWORK_KEY,
  WALLET_SESSION_KEY,
} from '@/wallet/session';

describe('wallet session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and restores the selected provider, address, and network', () => {
    const session = {
      wallet: 'albedo' as const,
      address: 'GTESTADDRESS',
      network: 'testnet' as const,
    };

    saveWalletSession(session);

    expect(loadWalletSession()).toEqual(session);
    expect(loadWalletNetwork()).toBe('testnet');
  });

  it('clears malformed persisted sessions', () => {
    localStorage.setItem(
      WALLET_SESSION_KEY,
      JSON.stringify({ wallet: 'unknown', address: '', network: 'testnet' })
    );

    expect(loadWalletSession()).toBeNull();
    expect(localStorage.getItem(WALLET_SESSION_KEY)).toBeNull();
  });

  it('uses mainnet when the persisted network is invalid', () => {
    localStorage.setItem(WALLET_NETWORK_KEY, 'invalid');
    expect(loadWalletNetwork()).toBe('mainnet');
  });

  it('removes current and legacy session keys on disconnect', () => {
    localStorage.setItem(WALLET_SESSION_KEY, '{}');
    localStorage.setItem('walletConnected', 'true');
    localStorage.setItem('walletAddress', 'GTESTADDRESS');
    localStorage.setItem('connectedWallet', 'rabet');

    clearWalletSession();

    expect(localStorage.getItem(WALLET_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem('walletConnected')).toBeNull();
    expect(localStorage.getItem('walletAddress')).toBeNull();
    expect(localStorage.getItem('connectedWallet')).toBeNull();
  });
});
