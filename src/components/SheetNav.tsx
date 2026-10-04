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

interface Props {
  tab: TabId
  onChange: (tab: TabId) => void
}

export function SheetNav({ tab, onChange }: Props) {
  return (
    <nav className="snav" aria-label="Bagian aplikasi">
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
    </nav>
  )
}
