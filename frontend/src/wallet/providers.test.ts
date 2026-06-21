import { beforeEach, describe, expect, it, vi } from 'vitest';

const freighterMocks = vi.hoisted(() => ({
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

const albedoMocks = vi.hoisted(() => ({
  implicitFlow: vi.fn(),
  listImplicitSessions: vi.fn(),
  forgetImplicitSession: vi.fn(),
  tx: vi.fn(),
}));

vi.mock('@stellar/freighter-api', () => freighterMocks);
vi.mock('@albedo-link/intent', () => ({ default: albedoMocks }));
vi.mock('@/wallet/connectRabet', () => ({
  connectRabet: vi.fn(),
  disconnectRabet: vi.fn(),
  isRabetAvailable: vi.fn(() => false),
  isRabetUnlocked: vi.fn(() => false),
  signWithRabet: vi.fn(),
}));

import {
  albedoAdapter,
  freighterAdapter,
  getWalletAdapter,
  NETWORK_PASSPHRASES,
  normalizeWalletError,
  walletAdapters,
} from '@/wallet/providers';

describe('wallet provider abstraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers three supported providers', () => {
    expect(Object.keys(walletAdapters)).toEqual([
      'freighter',
      'rabet',
      'albedo',
    ]);
    expect(getWalletAdapter('albedo')).toBe(albedoAdapter);
  });

  it('connects Albedo with a refresh-restorable implicit session', async () => {
    albedoMocks.implicitFlow.mockResolvedValue({
      granted: true,
      pubkey: 'GALBEDO',
    });

    await expect(albedoAdapter.connect('testnet')).resolves.toEqual({
      address: 'GALBEDO',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    });
    expect(albedoMocks.implicitFlow).toHaveBeenCalledWith({
      intents: ['tx'],
      network: NETWORK_PASSPHRASES.testnet,
    });
  });

  it('restores, signs, and disconnects an Albedo session', async () => {
    albedoMocks.listImplicitSessions.mockReturnValue([
      { pubkey: 'GALBEDO', grants: ['tx'] },
    ]);
    albedoMocks.tx.mockResolvedValue({
      signed_envelope_xdr: 'SIGNED_XDR',
    });

    const session = {
      wallet: 'albedo' as const,
      address: 'GALBEDO',
      network: 'mainnet' as const,
    };

    await expect(albedoAdapter.restore(session)).resolves.toEqual({
      address: 'GALBEDO',
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
    });
    await expect(
      albedoAdapter.signTransaction('XDR', 'mainnet', 'GALBEDO')
    ).resolves.toBe('SIGNED_XDR');

    await albedoAdapter.disconnect('GALBEDO');
    expect(albedoMocks.forgetImplicitSession).toHaveBeenCalledWith('GALBEDO');
  });

  it('connects and signs through the Freighter adapter', async () => {
    freighterMocks.requestAccess.mockResolvedValue({ address: 'GFREIGHTER' });
    freighterMocks.getNetworkDetails.mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    });
    freighterMocks.signTransaction.mockResolvedValue({
      signedTxXdr: 'SIGNED_XDR',
      signerAddress: 'GFREIGHTER',
    });

    await expect(freighterAdapter.connect('testnet')).resolves.toEqual({
      address: 'GFREIGHTER',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    });
    await expect(
      freighterAdapter.signTransaction('XDR', 'testnet', 'GFREIGHTER')
    ).resolves.toBe('SIGNED_XDR');
  });

  it('normalizes user rejection errors', () => {
    expect(
      normalizeWalletError({ message: 'Action rejected by user' }, 'sign')
        .message
    ).toBe('Transaction rejected by user');
  });
});
