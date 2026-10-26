import { gql, useQuery } from '@apollo/client'
import { useMemo } from 'react'

export type Department = {
  id: string
  name: string
  code: string
  description?: string | null
  isActive: boolean
}

export type Designation = {
  id: string
  title: string
  code: string
  departmentId: string
  level: number
  description?: string | null
  isActive: boolean
}

export type WorkSite = {
  id: string
  code: string
  name: string
  latitude: number
  longitude: number
  geofenceRadius: number
  address: string
  city?: string | null
  country: string
  isActive: boolean
}

export type CompanySettings = {
  id: string
  companyName: string
  legalName?: string | null
  countryCode: string
  currencyCode: string
  timezone: string
  supportEmail?: string | null
  supportPhone?: string | null
}

export type SiteAssignment = {
  id: string
  isPrimary: boolean
  status: string
  assignedDate: string
  location: WorkSite
}

export const SITE_FIELDS = `
  id
  code
  name
  latitude
  longitude
  geofenceRadius
  address
  city
  country
  isActive
`

export const REFERENCE_DATA_QUERY = gql`
  query ReferenceData {
    companySettings {
      id
      companyName
      legalName
      countryCode
      currencyCode
      timezone
      supportEmail
      supportPhone
    }
    departments(includeInactive: true) {
      id
      name
      code
      description
      isActive
    }
    designations(includeInactive: true) {
      id
      title
      code
      departmentId
      level
      description
      isActive
    }
    locations(activeOnly: false) {
      ${SITE_FIELDS}
    }
  }
`

export function useReferenceData() {
  const query = useQuery<{
    companySettings: CompanySettings | null
    departments: Department[]
    designations: Designation[]
    locations: WorkSite[]
  }>(REFERENCE_DATA_QUERY)

  const data = query.data
  return {
    ...query,
    companySettings: data?.companySettings ?? null,
    departments: data?.departments ?? [],
    designations: data?.designations ?? [],
    sites: data?.locations ?? [],
  }
}

// The API only exposes employeeLocations(employeeId), so batch them into one
// aliased request instead of one round-trip per person.
export function useSiteAssignments(employeeIds: string[]) {
  const key = employeeIds.join(',')
  const document = useMemo(() => {
    const ids = key ? key.split(',') : []
    const body = ids.length
      ? ids
          .map(
            (id, index) =>
              `e${index}: employeeLocations(employeeId: ${JSON.stringify(id)}) { id isPrimary status assignedDate location { ${SITE_FIELDS} } }`,
          )
          .join('\n')
      : '__typename'
    return gql(`query SiteAssignments_${ids.length} { ${body} }`)
  }, [key])

  const result = useQuery<Record<string, SiteAssignment[]>>(document, {
    skip: !key,
    fetchPolicy: 'cache-and-network',
  })

  const byEmployee = useMemo(() => {
    const map = new Map<string, SiteAssignment[]>()
    const ids = key ? key.split(',') : []
    ids.forEach((id, index) => {
      const rows = result.data?.[`e${index}`]
      if (Array.isArray(rows)) {
        map.set(
          id,
          rows.filter((row) => row.status === 'ACTIVE'),
        )
      }
    })
    return map
  }, [key, result.data])

  return { ...result, byEmployee }
}
