import { useMutation } from '@apollo/client'
import { Pencil, Plus, XCircle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { useConfirm } from '@/features/shared/confirm-dialog'
import { TextField } from '@/features/shared/controls'
import { DataTable, EmptyState, Td, Th, Tr } from '@/features/shared/data-table'
import { readableError } from '@/lib/graphql-errors'
import { OverflowMenu } from '@/features/shared/overflow-menu'
import type { WorkSite } from '@/features/shared/reference-data'
import { SideSheet } from '@/features/shared/side-sheet'
import { formatNumber, formatStatus, plural } from '@/lib/format'

import {
  CREATE_LOCATION_MUTATION,
  DEACTIVATE_LOCATION_MUTATION,
  ORGANISATION_REFETCH,
  UPDATE_LOCATION_MUTATION,
} from './graphql'

type SiteForm = {
  id: string | null
  name: string
  code: string
  address: string
  city: string
  country: string
  latitude: string
  longitude: string
  geofenceRadius: string
}

type SiteErrors = Partial<Record<keyof SiteForm, string>>

const CODE_PATTERN = /^[A-Z0-9_]+$/

function validateSite(form: SiteForm): SiteErrors {
  const errors: SiteErrors = {}
  if (!form.name.trim()) errors.name = 'Enter a name.'
  if (!CODE_PATTERN.test(form.code)) {
    errors.code = 'Use capital letters, numbers and underscores only.'
  }
  if (!form.address.trim()) errors.address = 'Enter the street address.'
  if (form.country && !/^[A-Z]{2}$/.test(form.country)) errors.country = 'Use a two-letter country code.'
  const lat = Number.parseFloat(form.latitude)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = 'Latitude must be between −90 and 90.'
  const lng = Number.parseFloat(form.longitude)
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = 'Longitude must be between −180 and 180.'
  const radius = Number.parseInt(form.geofenceRadius, 10)
  if (!Number.isFinite(radius) || radius < 20 || radius > 5000) {
    errors.geofenceRadius = 'Radius must be between 20 and 5,000 metres.'
  }
  return errors
}

export function SitesSection({
  sites,
  peopleAt,
  defaultCountry,
  canEdit,
  onNotice,
}: {
  sites: WorkSite[]
  peopleAt: (siteId: string) => number | null
  defaultCountry: string
  canEdit: boolean
  onNotice: (message: ReactNode, tone: 'success' | 'danger') => void
}) {
  const [form, setForm] = useState<SiteForm | null>(null)
  const [errors, setErrors] = useState<SiteErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()
  const [createSite, createState] = useMutation(CREATE_LOCATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [updateSite, updateState] = useMutation(UPDATE_LOCATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [deactivateSite] = useMutation(DEACTIVATE_LOCATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH })

  const sorted = [...sites].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
  )

  const open = (site?: WorkSite) => {
    setErrors({})
    setServerError(null)
    setForm(
      site
        ? {
            id: site.id,
            name: site.name,
            code: site.code,
            address: site.address,
            city: site.city ?? '',
            country: site.country ?? '',
            latitude: String(site.latitude),
            longitude: String(site.longitude),
            geofenceRadius: String(site.geofenceRadius),
          }
        : {
            id: null,
            name: '',
            code: '',
            address: '',
            city: '',
            country: defaultCountry,
            latitude: '',
            longitude: '',
            geofenceRadius: '100',
          },
    )
  }

  const update = (patch: Partial<SiteForm>) => {
    if (!form) return
    setForm({ ...form, ...patch })
    const keys = Object.keys(patch) as (keyof SiteForm)[]
    if (keys.some((key) => errors[key])) {
      setErrors((current) => {
        const next = { ...current }
        keys.forEach((key) => delete next[key])
        return next
      })
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    setServerError(null)
    const found = validateSite(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const input = {
      name: form.name.trim(),
      code: form.code.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      latitude: Number.parseFloat(form.latitude),
      longitude: Number.parseFloat(form.longitude),
      geofenceRadius: Number.parseInt(form.geofenceRadius, 10),
    }
    try {
      if (form.id) {
        await updateSite({ variables: { input: { id: form.id, ...input } } })
        onNotice(`${input.name} updated.`, 'success')
      } else {
        await createSite({ variables: { input } })
        onNotice(`${input.name} added. Assign people to it from People.`, 'success')
      }
      setForm(null)
    } catch (mutationError) {
      setServerError(readableError(mutationError, 'The work site could not be saved.'))
    }
  }

  const handleDeactivate = async (site: WorkSite) => {
    const ok = await confirm({
      title: `Deactivate ${site.name}?`,
      description: 'People can no longer clock in or out there. Past attendance records keep the site.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateSite({ variables: { input: { id: site.id } } })
      onNotice(`${site.name} deactivated.`, 'success')
    } catch (mutationError) {
      onNotice(readableError(mutationError, 'The work site could not be deactivated.'), 'danger')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(sites.filter((site) => site.isActive).length, 'active site')}
        </p>
        {canEdit ? (
          <Button onClick={() => open()} size="sm" type="button" variant="outline">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add work site
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No work sites yet">
          Work sites are the places people clock in. Each one has a centre point and a radius
          that attendance is checked against.
        </EmptyState>
      ) : (
        <DataTable label="Work sites" minWidth={760}>
          <thead>
            <tr>
              <Th>Site</Th>
              <Th>Address</Th>
              <Th>Centre</Th>
              <Th className="text-right">Radius</Th>
              <Th className="text-right">People</Th>
              <Th className="w-12"><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((site) => {
              const people = peopleAt(site.id)
              return (
                <Tr className={site.isActive ? undefined : 'text-muted-foreground'} key={site.id}>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{site.name}</span>
                      {site.isActive ? null : <StatusBadge tone="neutral">{formatStatus('INACTIVE')}</StatusBadge>}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{site.code}</p>
                  </Td>
                  <Td className="max-w-[280px]">
                    <p className="truncate" title={site.address}>{site.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {[site.city, site.country].filter(Boolean).join(', ') || '—'}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                    {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {formatNumber(site.geofenceRadius)} m
                  </Td>
                  <Td className="text-right tabular-nums">{people === null ? '—' : people}</Td>
                  <Td className="py-2 text-right">
                    {canEdit ? (
                      <OverflowMenu
                        items={[
                          { label: 'Edit', icon: Pencil, onSelect: () => open(site) },
                          {
                            label: 'Deactivate',
                            icon: XCircle,
                            tone: 'danger',
                            hidden: !site.isActive,
                            onSelect: () => void handleDeactivate(site),
                          },
                        ]}
                        label={`Actions for ${site.name}`}
                      />
                    ) : null}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </DataTable>
      )}

      <SideSheet
        description="People clock in and out when they are inside the radius around the centre point."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setForm(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={createState.loading || updateState.loading} form="site-form" type="submit">
              {createState.loading || updateState.loading ? 'Saving…' : form?.id ? 'Save work site' : 'Add work site'}
            </Button>
          </div>
        }
        onOpenChange={(next) => !next && setForm(null)}
        open={form !== null}
        title={form?.id ? 'Edit work site' : 'New work site'}
      >
        {form ? (
          <form className="space-y-4" id="site-form" noValidate onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <TextField error={errors.name} id="site-name" label="Name">
                <Input id="site-name" onChange={(event) => update({ name: event.target.value })} placeholder="Jebel Ali warehouse" value={form.name} />
              </TextField>
              <TextField error={errors.code} hint="A–Z, 0–9 and _" id="site-code" label="Code">
                <Input
                  autoComplete="off"
                  id="site-code"
                  onChange={(event) => update({ code: event.target.value.toUpperCase().replace(/[\s-]+/g, '_') })}
                  placeholder="JAFZA_WH1"
                  value={form.code}
                />
              </TextField>
            </div>
            <TextField error={errors.address} id="site-address" label="Address">
              <Input id="site-address" onChange={(event) => update({ address: event.target.value })} placeholder="Plot S10101, JAFZA South" value={form.address} />
            </TextField>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <TextField id="site-city" label="City" optional>
                <Input id="site-city" onChange={(event) => update({ city: event.target.value })} value={form.city} />
              </TextField>
              <TextField error={errors.country} hint="Two letters" id="site-country" label="Country">
                <Input
                  id="site-country"
                  maxLength={2}
                  onChange={(event) => update({ country: event.target.value.toUpperCase() })}
                  placeholder="AE"
                  value={form.country}
                />
              </TextField>
            </div>
            <fieldset className="space-y-3 rounded-xl border border-border/70 p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">Centre and radius</legend>
              <p className="text-[13px] leading-5 text-muted-foreground">
                Copy the coordinates from a map (right-click the site in most map apps).
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField error={errors.latitude} hint="−90 to 90" id="site-latitude" label="Latitude">
                  <Input id="site-latitude" inputMode="decimal" onChange={(event) => update({ latitude: event.target.value })} placeholder="25.0119" value={form.latitude} />
                </TextField>
                <TextField error={errors.longitude} hint="−180 to 180" id="site-longitude" label="Longitude">
                  <Input id="site-longitude" inputMode="decimal" onChange={(event) => update({ longitude: event.target.value })} placeholder="55.0611" value={form.longitude} />
                </TextField>
                <TextField error={errors.geofenceRadius} hint="20 to 5,000 m" id="site-radius" label="Radius (m)">
                  <Input id="site-radius" inputMode="numeric" onChange={(event) => update({ geofenceRadius: event.target.value })} value={form.geofenceRadius} />
                </TextField>
              </div>
            </fieldset>
            {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
          </form>
        ) : null}
      </SideSheet>
      {confirmDialog}
    </div>
  )
}
