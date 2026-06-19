import { demoApps } from '@/demo/apps'
import { demoHref } from '@/demo/catalog'

export function DemoGalleryPage() {
  return (
    <div className="demo-gallery min-h-screen bg-[#ece8de] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1560px]">
        <section className="rounded-[34px] border border-black/8 bg-white/92 px-6 py-7 shadow-[0_26px_48px_rgba(15,23,42,0.08)] sm:px-8 sm:py-9">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rakss demo gallery</p>
              <h1 className="mt-4 max-w-5xl text-[2.6rem] font-semibold tracking-[-0.07em] text-slate-950 sm:text-[4.1rem]">
                One calmer HR family: `Talent Haven` as the anchor, nine demos rebuilt around its shell calm, `Care Loop` modules, and `Welcome House` warmth.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                The gallery now reads like one related product suite instead of ten unrelated experiments. `Talent Haven`
                stays intact, while the other nine demos share a softer navigation feel, stronger working modules, and a
                warmer dashboard home page.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white">10 demo apps</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-600">10 pages each</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[13px] font-semibold text-slate-600">Shared family, not unrelated skins</span>
              </div>
            </div>
            <aside className="rounded-[28px] border border-black/6 bg-[#f7f3ea] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reading the set</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Start with the dashboard: the warmer home page should read like a welcome surface in every rebuilt demo.</p>
                <p>Then open payroll, reports, or policies and notice how the product shifts into calmer working modules.</p>
                <p>`Talent Haven` is the benchmark; the other nine are its new related family, not separate visual worlds.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {demoApps.map((demo) => (
            <article
              className="overflow-hidden rounded-[30px] border border-black/8 bg-white/94 shadow-[0_20px_40px_rgba(15,23,42,0.06)]"
              key={demo.meta.id}
            >
              <div className="p-4">{demo.renderPreview()}</div>
              <div className="border-t border-black/6 px-5 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {demo.meta.spectrum}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                    10 pages
                  </span>
                </div>
                <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.04em] text-slate-950">{demo.meta.title}</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">{demo.meta.tagline}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{demo.meta.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white"
                    href={demoHref(demo.meta.id, 'dashboard')}
                  >
                    Open dashboard
                  </a>
                  <a
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700"
                    href={demoHref(demo.meta.id, 'login')}
                  >
                    Preview login
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
