import type { DataStateView } from '../data/dataState'
import type { AshfallReport } from '../types'
import { SampleTag } from './SampleTag'

interface Props {
  ashfall: AshfallReport
  dataState: DataStateView
}

/** Arah sebaran abu dari angin terukur, dan tinggi kolom yang belum tersambung. */
export function AshWindCard({ ashfall, dataState }: Props) {
  return (
    <section className="ash dim">
      <div className="ash__split">
        <div className="ash__cell ash__cell--left">
          <div className="ash__k">
            Arah sebaran
            {ashfall.windProvenance === 'sample' && <SampleTag />}
          </div>
          <div className="ash__v">{ashfall.windDirection}</div>
          <div className="ash__d">angin {ashfall.windSpeedKmh} km/jam</div>
        </div>
        <div className="ash__cell">
          <div className="ash__k">Puncak kolom abu</div>
          <div className="ash__v ash__v--none">belum tersambung</div>
          <div className="ash__d">hanya dari pos pengamatan PVMBG</div>
        </div>
      </div>
      <p className="ash__advice">{ashfall.advice}</p>
      <div className="ash__src">
        Sumber: {ashfall.source} · {dataState.sourceTime}
      </div>
    </section>
  )
}
