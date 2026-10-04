import type { LiveQuakesState } from '../hooks/useLiveQuakes'
import { formatFeedTime, formatNumber } from '../lib/format'
import type { VolcanoRef } from '../types'

interface Props {
  live: LiveQuakesState
  volcano: VolcanoRef
  nowISO: string
}

/** Warna mengikuti level PAGER USGS, satu-satunya penilaian dampak resmi di feed. */
const ALERT_COLOR: Record<string, string> = {
  green: 'var(--c-safe)',
  yellow: 'var(--c-watch)',
  orange: 'var(--c-alert)',
  red: 'var(--c-danger)',
}

const ALERT_LABEL: Record<string, string> = {
  green: 'PAGER hijau — dampak diperkirakan kecil',
  yellow: 'PAGER kuning — kemungkinan ada korban atau kerusakan',
  orange: 'PAGER oranye — dampak luas mungkin terjadi',
  red: 'PAGER merah — dampak berat mungkin terjadi',
}

export function LiveQuakeList({ live, volcano, nowISO }: Props) {
  const { quakes, status, fetchedAtISO } = live

  return (
    <section className="livequakes">
      <div className="livequakes__head">
        <h2 className="section">Gempa terkini di sekitar</h2>
        <span
          className={`livedot${status === 'ok' ? ' livedot--on' : ''}`}
          title={
            status === 'ok'
              ? 'Diambil langsung oleh perangkat Anda dari USGS'
              : 'Belum tersambung ke USGS'
          }
        >
          {status === 'ok' ? 'LANGSUNG' : status === 'loading' ? 'MEMUAT' : 'GAGAL'}
        </span>
      </div>

      {status === 'failed' && quakes.length === 0 && (
        <p className="emptynote">
          Feed USGS tidak bisa dihubungi dari perangkat ini. Daftar gempa resmi
          BMKG di bawah tetap tampil karena diambil terpisah lewat server.
        </p>
      )}

      {status !== 'failed' && quakes.length === 0 && (
        <p className="emptynote">
          Tidak ada gempa M 2,5 ke atas tercatat USGS dalam 24 jam terakhir pada
          radius 600 km dari {volcano.name}. USGS mencatat kawasan Indonesia
          sekitar M 4,5 ke atas, jadi gempa kecil bisa saja terjadi tanpa masuk
          daftar ini.
        </p>
      )}

      {quakes.length > 0 && (
        <ul className="lqlist">
          {quakes.map((q) => (
            <li key={q.id}>
              <a
                className="lqitem"
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span
                  className="lqitem__mag mono"
                  style={{ color: q.alert ? ALERT_COLOR[q.alert] : undefined }}
                >
                  M {q.mag.toFixed(1)}
                </span>
                <span className="lqitem__body">
                  <span className="lqitem__place">{q.place}</span>
                  <span className="lqitem__meta">
                    {formatNumber(q.distanceKm)} km dari kawah
                    {q.depthKm !== null && ` · kedalaman ${Math.round(q.depthKm)} km`}
                    {' · '}
                    {formatFeedTime(q.timeISO, nowISO)}
                  </span>
                  {(q.tsunami || q.alert || q.felt) && (
                    <span className="lqitem__flags">
                      {q.tsunami && (
                        <span className="lqflag lqflag--tsunami">
                          ditandai berpotensi tsunami
                        </span>
                      )}
                      {q.alert && (
                        <span
                          className="lqflag"
                          style={{ color: ALERT_COLOR[q.alert] }}
                        >
                          {ALERT_LABEL[q.alert] ?? `PAGER ${q.alert}`}
                        </span>
                      )}
                      {q.felt !== null && q.felt > 0 && (
                        <span className="lqflag">
                          {formatNumber(q.felt)} laporan dirasakan
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="lqsrc">
        Sumber: USGS <code>summary/2.5_day</code>, diambil langsung oleh
        perangkat Anda
        {fetchedAtISO && ` · ${formatFeedTime(fetchedAtISO, nowISO)}`}. Ketuk satu
        baris untuk membuka halaman resmi kejadiannya.
      </p>
    </section>
  )
}
