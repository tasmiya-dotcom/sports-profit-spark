import { useCurrency } from '@/contexts/CurrencyContext';

const CurrencyToggle = () => {
  const { currency, setCurrency, rate, isOffline, updatedAt } = useCurrency();

  const timeLabel = updatedAt
    ? 'updated just now'
    : '';

  return (
    <div className="flex items-center gap-2.5">
      {/* Pill toggle */}
      <div className="flex rounded-full border border-border overflow-hidden text-[11px] font-semibold">
        <button
          onClick={() => setCurrency('EUR')}
          className={`px-3 py-1 transition-all cursor-pointer ${
            currency === 'EUR'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          € EUR
        </button>
        <button
          onClick={() => setCurrency('INR')}
          className={`px-3 py-1 transition-all cursor-pointer ${
            currency === 'INR'
              ? 'text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          style={currency === 'INR' ? { background: '#f59e0b' } : {}}
        >
          ₹ INR
        </button>
      </div>

      {/* Rate label */}
      {currency === 'INR' && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          1 EUR = ₹{rate.toFixed(2)}
          {isOffline ? ' (offline rate)' : timeLabel ? ` — ${timeLabel}` : ''}
        </span>
      )}
    </div>
  );
};

export default CurrencyToggle;
