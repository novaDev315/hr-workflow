import { useMutation } from '@apollo/client'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { SelectField, TextField } from '@/features/shared/controls'
import { readableError } from '@/lib/graphql-errors'
import type { CompanySettings } from '@/features/shared/reference-data'

import { ORGANISATION_REFETCH, UPSERT_COMPANY_SETTINGS_MUTATION } from './graphql'

type CompanyForm = {
  companyName: string
  legalName: string
  countryCode: string
  currencyCode: string
  timezone: string
  supportEmail: string
  supportPhone: string
}

const COMMON_TIMEZONES = [
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Kuwait',
  'Asia/Muscat',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Manila',
  'Asia/Singapore',
  'Africa/Cairo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'UTC',
]

function timezoneOptions(current: string) {
  let zones: string[] = COMMON_TIMEZONES
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    const all = intl.supportedValuesOf?.('timeZone')
    if (all && all.length) zones = all.includes('UTC') ? all : [...all, 'UTC']
  } catch {
    // Older browsers: keep the short list.
  }
  if (current && !zones.includes(current)) zones = [current, ...zones]
  return zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))
}

function toForm(settings: CompanySettings | null): CompanyForm {
  return {
    companyName: settings?.companyName ?? '',
    legalName: settings?.legalName ?? '',
    countryCode: settings?.countryCode ?? 'AE',
    currencyCode: settings?.currencyCode ?? 'AED',
    timezone: settings?.timezone ?? 'Asia/Dubai',
    supportEmail: settings?.supportEmail ?? '',
    supportPhone: settings?.supportPhone ?? '',
  }
}

export function CompanySection({
  settings,
  canEdit,
}: {
  settings: CompanySettings | null
  canEdit: boolean
}) {
  const [form, setForm] = useState<CompanyForm>(() => toForm(settings))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(UPSERT_COMPANY_SETTINGS_MUTATION, {
    refetchQueries: ORGANISATION_REFETCH,
  })

  useEffect(() => {
    setForm(toForm(settings))
  }, [settings])

  const zones = useMemo(() => timezoneOptions(form.timezone), [form.timezone])
  const update = (patch: Partial<CompanyForm>) => {
    setSaved(false)
    setForm((current) => ({ ...current, ...patch }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSaved(false)
    try {
      await save({
        variables: {
          input: {
            companyName: form.companyName.trim(),
            legalName: form.legalName.trim() || null,
            countryCode: form.countryCode.trim().toUpperCase() || null,
            currencyCode: form.currencyCode.trim().toUpperCase() || null,
            timezone: form.timezone || null,
            supportEmail: form.supportEmail.trim() || null,
            supportPhone: form.supportPhone.trim() || null,
          },
        },
      })
      setSaved(true)
    } catch (mutationError) {
      setError(readableError(mutationError, 'Company details could not be saved.'))
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {!settings ? (
        <Notice tone="warning">
          Company details are not set up yet. Payslips show a placeholder name and times use
          the default time zone until you save them.
        </Notice>
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={!canEdit || loading}>
        <TextField id="company-name" label="Company name" hint="Shown on payslips and reports.">
          <Input
            id="company-name"
            onChange={(event) => update({ companyName: event.target.value })}
            required
            value={form.companyName}
          />
        </TextField>
        <TextField id="company-legal-name" label="Legal name" optional>
          <Input
            id="company-legal-name"
            onChange={(event) => update({ legalName: event.target.value })}
            value={form.legalName}
          />
        </TextField>
        <TextField id="company-country" label="Country code" hint="Two letters, for example AE.">
          <Input
            autoComplete="off"
            id="company-country"
            maxLength={2}
            onChange={(event) => update({ countryCode: event.target.value.toUpperCase() })}
            pattern="[A-Za-z]{2}"
            value={form.countryCode}
          />
        </TextField>
        <TextField id="company-currency" label="Currency" hint="Three letters, for example AED. New pay records use it by default.">
          <Input
            autoComplete="off"
            id="company-currency"
            maxLength={3}
            onChange={(event) => update({ currencyCode: event.target.value.toUpperCase() })}
            pattern="[A-Za-z]{3}"
            value={form.currencyCode}
          />
        </TextField>
        <SelectField
          id="company-timezone"
          label="Time zone"
          onChange={(timezone) => update({ timezone })}
          options={zones}
          value={form.timezone}
        />
        <TextField id="company-support-email" label="Support email" optional>
          <Input
            id="company-support-email"
            onChange={(event) => update({ supportEmail: event.target.value })}
            type="email"
            value={form.supportEmail}
          />
        </TextField>
        <TextField id="company-support-phone" label="Support phone" optional>
          <Input
            id="company-support-phone"
            onChange={(event) => update({ supportPhone: event.target.value })}
            type="tel"
            value={form.supportPhone}
          />
        </TextField>
      </fieldset>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? <Notice tone="success">Company details saved.</Notice> : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button disabled={loading || !form.companyName.trim()} type="submit">
            {loading ? 'Saving…' : 'Save company details'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only administrators and HR administrators can change company details.
        </p>
      )}
    </form>
  )
}
