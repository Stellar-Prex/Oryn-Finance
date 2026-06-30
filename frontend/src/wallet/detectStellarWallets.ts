import { WalletInfo } from "@/types/wallet";
import { detectWalletProviders } from "@/wallet/providers";

export async function detectWallets(): Promise<WalletInfo[]> {
  return detectWalletProviders();
}

export function isRabetDetected(): boolean {
  if (typeof window === 'undefined') return false;
  
  if (window.rabet) {
    console.log('Rabet wallet detected!');
    return true;
  }
  
  console.log('Rabet wallet not detected');
  return false;
}
