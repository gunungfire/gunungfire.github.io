export type TabId = 'status' | 'info'

interface NavItem {
  id: TabId
  label: string
}

/**
 * Dua bagian. Peta tidak perlu tab: ia selalu ada di belakang lembar, dan
 * penampang di Status adalah irisannya. Isi empat tab lama — Wilayah, Udara,
 * Laporan, Panduan — utuh di Info, terlipat dengan ringkasan satu baris.
 */
const NAV: NavItem[] = [
  { id: 'status', label: 'Status' },
  { id: 'info', label: 'Info' },
]

/** Urutan tab, dipakai juga untuk geser mendatar di lembar. */
export const TAB_ORDER: TabId[] = NAV.map((n) => n.id)

interface Props {
  tab: TabId
  onChange: (tab: TabId) => void
}

export function SheetNav({ tab, onChange }: Props) {
  const index = Math.max(0, TAB_ORDER.indexOf(tab))
  return (
    <nav
      className="snav"
      aria-label="Bagian aplikasi"
      style={{ '--snav-i': index, '--snav-n': NAV.length } as React.CSSProperties}
    >
      {NAV.map((item) => {
        const active = item.id === tab
        return (
          <button
            key={item.id}
            type="button"
            className={`snav__btn${active ? ' snav__btn--on' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
      {/* Satu garis penanda yang meluncur ke tab aktif, bukan garis per tombol
          yang muncul dan hilang — mata mengikuti ke mana isinya pindah. */}
      <span className="snav__ink" aria-hidden="true" />
    </nav>
  )
}
