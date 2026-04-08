import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  getActiveGraphqlEndpoint,
  getGraphqlEndpointCandidates,
} from '@/lib/apollo-client'
import {
  clearAdminSession,
  hasAdminPanelAccess,
  persistAdminSession,
} from '@/lib/auth-session'

const AUTH_BOOTSTRAP_STATUS = gql`
  query AuthBootstrapStatus {
    authBootstrapStatus {
      bootstrapRequired
      accountCount
    }
  }
`

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      expiresIn
      account {
        id
        email
        firstName
        lastName
        fullName
        roles
        isActive
      }
    }
  }
`

const BOOTSTRAP_ADMIN_MUTATION = gql`
  mutation BootstrapAdmin($input: BootstrapAdminInput!) {
    bootstrapAdmin(input: $input) {
      accessToken
      expiresIn
      account {
        id
        email
        firstName
        lastName
        fullName
        roles
        isActive
      }
    }
  }
`

export function LoginPage() {
  const apolloClient = useApolloClient()
  const navigate = useNavigate()
  const {
    data,
    error: bootstrapStatusError,
    loading: bootstrapStatusLoading,
    refetch: refetchBootstrapStatus,
  } = useQuery(AUTH_BOOTSTRAP_STATUS)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [login] = useMutation(LOGIN_MUTATION)
  const [bootstrapAdmin] = useMutation(BOOTSTRAP_ADMIN_MUTATION)

  const bootstrapRequired = data?.authBootstrapStatus?.bootstrapRequired ?? false
  const title = bootstrapRequired ? 'Set up your admin workspace' : 'Sign in to Rakss HR'
  const subtitle = bootstrapRequired
    ? 'Create the first administrator account and unlock the web admin.'
    : 'Access the quiet workspace for workforce operations, approvals, and payroll.'
  const endpointCandidates = useMemo(() => getGraphqlEndpointCandidates(), [])
  const activeEndpoint = getActiveGraphqlEndpoint()
  const canSubmit = !loading && !bootstrapStatusLoading && !bootstrapStatusError

  useEffect(() => {
    document.title = bootstrapRequired
      ? 'Set Up Admin - Rakss HR'
      : 'Sign In - Rakss HR Admin'
  }, [bootstrapRequired])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = bootstrapRequired
        ? await bootstrapAdmin({
            variables: {
              input: {
                firstName,
                lastName,
                email,
                password,
              },
            },
          })
        : await login({
            variables: {
              input: {
                email,
                password,
              },
            },
          })

      const payload = bootstrapRequired ? result.data?.bootstrapAdmin : result.data?.login

      if (!payload?.accessToken) {
        throw new Error('Authentication response did not include an access token')
      }

      if (!bootstrapRequired && !hasAdminPanelAccess(payload.account.roles)) {
        clearAdminSession()
        throw new Error(
          'This account can use the mobile app, but only ADMIN, HR_ADMIN, MANAGER, and SUPERVISOR accounts can access the admin panel.'
        )
      }

      persistAdminSession(payload)
      await apolloClient.clearStore()
      navigate('/')
    } catch (submitError) {
      console.error('Login failed:', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1480px] gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,540px)]">
        <section className="app-surface hidden min-h-[720px] flex-col justify-between p-8 lg:flex">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(77,124,102,0.18)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="app-kicker">Rakss HR</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-foreground">
                  Admin workspace
                </p>
              </div>
            </div>

            <div className="max-w-2xl space-y-5">
              <StatusBadge tone="accent">
                {bootstrapRequired ? 'Bootstrap mode' : 'Secure sign-in'}
              </StatusBadge>
              <div className="space-y-3">
                <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-foreground">
                  Fewer panels. Clearer actions. Faster daily HR work.
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  The new admin experience trims the noise and keeps only what matters:
                  people records, approvals, payroll, and reporting.
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {[
                ['People', 'Find staff details, departments, and setup flows without jumping across cluttered screens.'],
                ['Approvals', 'Keep leave decisions and operational tasks visible where they matter.'],
                ['Payroll', 'Review periods, payslips, and reports in a calmer monthly workflow.'],
              ].map(([heading, copy]) => (
                <div key={heading} className="app-muted-surface p-4">
                  <p className="text-sm font-semibold text-foreground">{heading}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-muted-surface p-4">
              <p className="app-kicker">Active endpoint</p>
              <p className="mt-2 truncate text-sm font-medium text-foreground">
                {activeEndpoint ?? 'Resolving...'}
              </p>
            </div>
            <div className="app-muted-surface p-4">
              <p className="app-kicker">Available endpoints</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {endpointCandidates.length} candidate{endpointCandidates.length === 1 ? '' : 's'}
                {' '}detected for this environment.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-start justify-center pt-8 sm:pt-10 lg:items-center lg:pt-0">
          <div className="w-full max-w-xl space-y-4">
            <div className="app-surface flex items-center gap-3 px-4 py-4 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(77,124,102,0.18)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="app-kicker">Rakss HR</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
                  Admin workspace
                </p>
              </div>
            </div>

          <Card className="w-full max-w-xl">
            <CardHeader className="space-y-4">
              <div className="space-y-3">
                <StatusBadge tone={bootstrapRequired ? 'accent' : 'info'}>
                  {bootstrapRequired ? 'First-time setup' : 'Web admin access'}
                </StatusBadge>
                <div className="space-y-2">
                  <CardTitle className="text-3xl sm:text-4xl">{title}</CardTitle>
                  <CardDescription className="max-w-lg text-base">
                    {subtitle}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {bootstrapStatusError ? (
                <Notice tone="warning">
                  <div>
                    <p className="font-semibold">The authentication service is not reachable.</p>
                    <p className="mt-1">
                      {bootstrapStatusError.message}
                    </p>
                    <Button
                      className="mt-3"
                      type="button"
                      variant="outline"
                      onClick={() => void refetchBootstrapStatus()}
                    >
                      Retry
                    </Button>
                  </div>
                </Notice>
              ) : null}

              {error ? <Notice tone="danger">{error}</Notice> : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                {bootstrapRequired ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First name</Label>
                      <Input
                        id="first-name"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last name</Label>
                      <Input
                        id="last-name"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    {bootstrapRequired ? 'Create password' : 'Password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={bootstrapRequired ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={bootstrapRequired ? 'Minimum 8 characters' : 'Enter your password'}
                    required
                  />
                </div>

                <Button className="w-full" type="submit" disabled={!canSubmit}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {bootstrapRequired ? 'Creating admin account...' : 'Signing in...'}
                    </>
                  ) : (
                    <>
                      {bootstrapRequired ? 'Create admin and continue' : 'Sign in'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="app-muted-surface p-4">
                <p className="app-kicker">Connection</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {activeEndpoint ?? 'No active endpoint resolved yet'}
                </p>
              </div>
            </CardContent>
          </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
