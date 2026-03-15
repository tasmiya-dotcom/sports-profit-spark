import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Currency = 'EUR' | 'INR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number;
  isOffline: boolean;
  updatedAt: Date | null;
  /** Format an absolute EUR value in the active currency */
  fmt: (eurValue: number) => string;
  /** Format a signed EUR value (with +/−) in the active currency */
  fmtSigned: (eurValue: number) => string;
  /** Convert EUR amount to active currency */
  convert: (eurValue: number) => number;
  /** Get the active currency symbol */
  symbol: string;
}

const FALLBACK_RATE = 91.5;
const STORAGE_KEY = 'arena365_currency';

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Currency) || 'EUR';
    } catch {
      return 'EUR';
    }
  });
  const [rate, setRate] = useState(FALLBACK_RATE);
  const [isOffline, setIsOffline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  }, []);

  // Fetch live rate on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/EUR');
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        const inrRate = json?.rates?.INR;
        if (inrRate && !cancelled) {
          setRate(inrRate);
          setIsOffline(false);
          setUpdatedAt(new Date());
        }
      } catch {
        if (!cancelled) {
          setRate(FALLBACK_RATE);
          setIsOffline(true);
          setUpdatedAt(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const convert = useCallback((eurValue: number) => {
    return currency === 'INR' ? eurValue * rate : eurValue;
  }, [currency, rate]);

  const symbol = currency === 'INR' ? '₹' : '€';

  const fmt = useCallback((eurValue: number) => {
    const v = convert(Math.abs(eurValue));
    return `${symbol}${Math.round(v).toLocaleString()}`;
  }, [convert, symbol]);

  const fmtSigned = useCallback((eurValue: number) => {
    const v = convert(Math.abs(eurValue));
    return `${eurValue >= 0 ? '+' : '-'}${symbol}${Math.round(v).toLocaleString()}`;
  }, [convert, symbol]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate, isOffline, updatedAt, fmt, fmtSigned, convert, symbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
