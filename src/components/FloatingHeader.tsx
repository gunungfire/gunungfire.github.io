import type { Ref } from 'react'
import type { DataStateView } from '../data/dataState'
import type { RidgeItem } from '../data/ridge'
import type { ThemeId } from '../hooks/useTheme'
import { formatNumber } from '../lib/format'
import type { VolcanoRef } from '../types'
import { Ridge } from './Ridge'

interface Props {
  volcano: VolcanoRef
  dataState: DataStateView
  onRefresh: () => void
  onPickVolcano: () => void
  tema: ThemeId
  onToggleTheme: () => void
  ridge: RidgeItem[]
  onSelectVolcano: (id: string) => void
  /** Kartunya diukur induk: tingginya menentukan letak banner dan lembar penuh. */
  cardRef: Ref<HTMLDivElement>
}

/**
 * Kepala halaman yang mengapung di atas peta.
 *
 * Pembungkusnya tidak menerima ketukan supaya peta di sekitarnya tetap bisa
 * digeser; hanya kartunya sendiri yang menerima.
 */
export function FloatingHeader({
  volcano,
  dataState,
  onRefresh,
  onPickVolcano,
  tema,
  onToggleTheme,
  ridge,
  onSelectVolcano,
  cardRef,
}: Props) {
  const keTerang = tema === 'gelap'
  return (
    <header className="fhead">
      <div className="fhead__card" ref={cardRef}>
        <div className="fhead__row">
          <span className="fhead__dot" aria-hidden="true" />
          <button
            type="button"
            className="fhead__id"
            onClick={onPickVolcano}
            aria-label={`Gunung dipantau: ${volcano.name}. Ketuk untuk memilih gunung lain.`}
          >
            <span className="fhead__name">
              {volcano.name}
              <span className="fhead__caret" aria-hidden="true" />
            </span>
            <span className="fhead__meta">
              {volcano.region} · {formatNumber(volcano.elevationM)} m ·{' '}
              {dataState.sub}
            </span>
          </button>
          <button
            type="button"
            className="fhead__sync"
            onClick={onRefresh}
            aria-label={`Kondisi data: ${dataState.label}. Ketuk untuk memuat ulang.`}
          >
            <span className="chip">
              <span className="chip__dot" aria-hidden="true" />
              <span className="chip__label mono">{dataState.label}</span>
            </span>
          </button>
          <button
            type="button"
            className="fhead__tema"
            onClick={onToggleTheme}
            aria-pressed={!keTerang}
            aria-label={
              keTerang ? 'Ganti ke tampilan terang' : 'Ganti ke tampilan gelap'
            }
            title={keTerang ? 'Tampilan terang' : 'Tampilan gelap'}
          >
            {keTerang ? <IkonMatahari /> : <IkonBulan />}
          </button>
        </div>
        <Ridge items={ridge} selectedId={volcano.id} onSelect={onSelectVolcano} />
      </div>
    </header>
  )
}

/* Digambar sendiri, bukan diambil dari pustaka ikon: dua bentuk sesederhana
   ini tidak sepadan dengan menambah satu paket lagi ke unduhan app. */

function IkonMatahari() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="3.4" />
      <g strokeLinecap="round">
        <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4" />
      </g>
    </svg>
  )
}

function IkonBulan() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.8 6.8 0 1 0 8.6 8.6Z" />
    </svg>
  )
}
