import { Check, Loader2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { api, type MediaAsset, type StockResult } from '../api';
import { Button, ICON } from './ui';

/**
 * M54: the outlets a campaign buys footage from. Pexels searches for real
 * (M34, with its key in .env). The others are designed in and marked not
 * connected until their keys arrive: the search is there to press, the
 * answer says what it would take.
 */
export const STOCK_OUTLETS = [
  { id: 'pexels', name: 'Pexels', connected: true, licence: 'Clips come from Pexels under its licence; the photographer is credited in the clip\'s name.' },
  { id: 'shutterstock', name: 'Shutterstock', connected: false, licence: 'Licensed per clip through the campaign\'s Shutterstock account.' },
  { id: 'filmpac', name: 'Filmpac', connected: false, licence: 'Licensed through the campaign\'s Filmpac subscription.' },
  { id: 'filmsupply', name: 'Filmsupply', connected: false, licence: 'Licensed per clip through Filmsupply.' },
  { id: 'envato', name: 'Envato', connected: false, licence: 'Licensed through the campaign\'s Envato Elements subscription.' },
] as const;
export type StockOutlet = (typeof STOCK_OUTLETS)[number]['id'];

function rememberedOutlet(): StockOutlet {
  try {
    const saved = window.localStorage.getItem('cc.stock.outlet');
    return STOCK_OUTLETS.some((o) => o.id === saved) ? (saved as StockOutlet) : 'pexels';
  } catch {
    return 'pexels';
  }
}

type Props = {
  /** The clip is in the footage now; the caller reloads its list. */
  onImported: (asset: MediaAsset) => void;
  /** M53: inside a folding section, which carries the heading and the rule. */
  bare?: boolean;
};

/**
 * M34: find stock footage without leaving the editor. Search Pexels from
 * here; a result pulled in becomes an ordinary clip in the footage, ready
 * to press or drag onto the video. The credit rides in the clip's name.
 */
export function StockPanel({ onImported, bare = false }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [outletId, setOutletId] = useState<StockOutlet>(rememberedOutlet);
  const outlet = STOCK_OUTLETS.find((o) => o.id === outletId) ?? STOCK_OUTLETS[0];
  const chooseOutlet = (id: StockOutlet) => {
    setOutletId(id);
    setResults(null);
    setError(null);
    try {
      window.localStorage.setItem('cc.stock.outlet', id);
    } catch {
      /* no storage: the choice lasts the session */
    }
  };

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    try {
      if (!outlet.connected) {
        setResults(null);
        setError(`${outlet.name} is not connected yet. Once its API key is in .env, this search runs against it.`);
        return;
      }
      setResults(await api.searchStock(q));
    } catch (e) {
      setResults(null);
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };
  const importOne = async (r: StockResult) => {
    setImporting(r.id);
    setError(null);
    try {
      const asset = await api.importStock(r.provider, r.id);
      setImported((prev) => new Set(prev).add(r.id));
      onImported(asset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className={bare ? '' : 'mt-4 pt-4 border-t border-line'}>
      {!bare && <h3 className="text-xs font-semibold text-fg-2 mb-2">Find stock footage</h3>}
      <div role="group" aria-label="Stock outlet" className="flex flex-wrap gap-1 mb-2">
        {STOCK_OUTLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === outletId}
            title={o.connected ? `Search ${o.name}` : `${o.name}: not connected yet`}
            onClick={() => chooseOutlet(o.id)}
            className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors ${o.id === outletId ? 'bg-blue text-white' : 'bg-raised border border-line text-fg-2 hover:text-fg hover:bg-hover'}`}
          >
            {o.name}
            {!o.connected && <span className="sr-only"> (not connected)</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          aria-label="Search stock footage"
          value={query}
          placeholder={outlet.connected ? 'rally crowd, capitol, farm…' : `Search ${outlet.name} (not connected yet)`}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
          className="field !py-1.5"
        />
        <Button size="sm" icon={searching ? Loader2 : Search} onClick={() => void search()} disabled={searching || !query.trim()} className={searching ? '[&_svg]:animate-spin' : ''}>
          Search
        </Button>
      </div>
      {error && <p className="text-xs text-red mt-2">{error}</p>}
      {results !== null && results.length === 0 && !error && <p className="text-xs text-fg-2 mt-2">Nothing matched. Try other words.</p>}
      {results !== null && results.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 mt-3">
          {results.map((r) => {
            const done = imported.has(r.id);
            const busy = importing === r.id;
            return (
              <li key={r.id} data-testid={`stock-result-${r.id}`} className="rounded-lg overflow-hidden bg-raised border border-line">
                <div className="relative aspect-video bg-stage">
                  {r.thumbUrl && <img src={r.thumbUrl} alt="" className="w-full h-full object-cover block" />}
                  <span className="absolute bottom-1 right-1 px-1 py-px rounded-xs bg-black/70 text-[10px] text-fg tabular-nums">{r.durationS.toFixed(1)} s</span>
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-xs truncate" title={r.title}>
                    {r.title}
                  </div>
                  <div className="text-[11px] text-fg-3 truncate">{r.credit}</div>
                  <button
                    type="button"
                    aria-label={`Add ${r.title} to footage`}
                    disabled={done || busy}
                    onClick={() => void importOne(r)}
                    className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${done ? 'text-green' : 'text-blue hover:text-blue-hover'} disabled:pointer-events-none`}
                  >
                    {done ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : busy ? <Loader2 size={12} strokeWidth={ICON.strokeWidth} aria-hidden="true" className="animate-spin" /> : <Plus size={12} strokeWidth={2} aria-hidden="true" />}
                    {done ? 'In footage' : busy ? 'Pulling in…' : 'Add to footage'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-fg-3 mt-2" data-testid="stock-licence">
        {outlet.licence}
        {!outlet.connected && ' Not connected yet.'}
      </p>
    </div>
  );
}
