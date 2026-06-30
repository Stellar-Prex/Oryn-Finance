// Wallet type definitions
export interface RabetModule {
  connect(): Promise<RabetConnectResult>;
  sign(xdr: string, network: string): Promise<RabetSignResult>;
  disconnect(): Promise<void>;
  isUnlocked(): Promise<boolean>;
  close(): Promise<void>;
  on(event: 'accountChanged' | 'networkChanged', handler: (data?: unknown) => void): void;
}

export interface RabetConnectResult {
  publicKey: string;
  error?: string;
}

export interface RabetSignResult {
  xdr: string;
  error?: string;
}

export interface FreighterModule {
  isConnected(): Promise<boolean>;
  getPublicKey(): Promise<string>;
  signTransaction(xdr: string, opts?: { networkPassphrase?: string }): Promise<string>;
  getNetworkDetails(): Promise<{ networkPassphrase: string; networkUrl: string }>;
}

export interface WalletInfo {
  id: WalletType;
  name: string;
  type: 'extension' | 'web';
  available: boolean;
}

export type WalletType = 'freighter' | 'rabet' | 'albedo';
export type WalletNetwork = 'mainnet' | 'testnet';

export interface WalletConnection {
  address: string;
  networkPassphrase?: string;
}

export interface WalletSession {
  wallet: WalletType;
  address: string;
  network: WalletNetwork;
}

export interface WalletAdapter {
  id: WalletType;
  name: string;
  type: 'extension' | 'web';
  isAvailable(): Promise<boolean>;
  connect(network: WalletNetwork): Promise<WalletConnection>;
  restore(session: WalletSession): Promise<WalletConnection | null>;
  disconnect(address?: string): Promise<void>;
  signTransaction(
    xdr: string,
    network: WalletNetwork,
    address: string
  ): Promise<string>;
}

// Global window type extensions
declare global {
  interface Window {
    freighter?: FreighterModule;
    rabet?: RabetModule;
  }
}
