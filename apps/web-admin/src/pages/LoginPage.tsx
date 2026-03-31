import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { clearAdminSession, hasAdminPanelAccess } from '@/lib/auth-session'

const AUTH_BOOTSTRAP_STATUS = gql`
  query AuthBootstrapStatus {
    authBootstrapStatus {
      bootstrapRequired
      userCount
    }
  }
`

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      expiresIn
      user {
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
      user {
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
  const navigate = useNavigate()
  const { data, loading: bootstrapStatusLoading } = useQuery(AUTH_BOOTSTRAP_STATUS)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [login] = useMutation(LOGIN_MUTATION)
  const [bootstrapAdmin] = useMutation(BOOTSTRAP_ADMIN_MUTATION)

  const bootstrapRequired = data?.authBootstrapStatus?.bootstrapRequired ?? false
  const title = bootstrapRequired ? 'Set Up HRFlow Pro' : 'HRFlow Pro'
  const subtitle = bootstrapRequired
    ? 'Create the first administrator account'
    : 'Admin Control Panel'

  const persistSession = (payload: {
    accessToken: string
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      fullName: string
      roles: string[]
      isActive: boolean
    }
  }) => {
    localStorage.setItem('auth_token', payload.accessToken)
    localStorage.setItem('user', JSON.stringify(payload.user))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      const payload = bootstrapRequired
        ? result.data?.bootstrapAdmin
        : result.data?.login

      if (!payload?.accessToken) {
        throw new Error('Authentication response did not include an access token')
      }

      if (!bootstrapRequired && !hasAdminPanelAccess(payload.user.roles)) {
        clearAdminSession()
        throw new Error(
          'This account can use the mobile app, but only ADMIN, HR_ADMIN, MANAGER, and SUPERVISOR accounts can access the admin panel.'
        )
      }

      persistSession(payload)

      navigate('/')
    } catch (error) {
      console.error('Login failed:', error)
      setError(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">{title}</CardTitle>
          <CardDescription className="text-center">
            {subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {bootstrapRequired && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Admin"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="User"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@hrflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading || bootstrapStatusLoading
                ? 'Working...'
                : bootstrapRequired
                  ? 'Create Admin Account'
                  : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
