import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import {
  clearAdminSession,
  hasAdminPanelAccess,
  persistAdminSession,
} from "@/lib/auth-session";

const AUTH_BOOTSTRAP_STATUS = gql`
  query AuthBootstrapStatus {
    authBootstrapStatus {
      bootstrapRequired
      accountCount
    }
  }
`;

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
        canAccessAdminPanel
        canManageAccounts
        isActive
      }
    }
  }
`;

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
        canAccessAdminPanel
        canManageAccounts
        isActive
      }
    }
  }
`;

export function LoginPage() {
  const apolloClient = useApolloClient();
  const navigate = useNavigate();
  const {
    data,
    error: bootstrapStatusError,
    loading: bootstrapStatusLoading,
    refetch: refetchBootstrapStatus,
  } = useQuery(AUTH_BOOTSTRAP_STATUS);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [login] = useMutation(LOGIN_MUTATION);
  const [bootstrapAdmin] = useMutation(BOOTSTRAP_ADMIN_MUTATION);

  const bootstrapRequired = data?.authBootstrapStatus?.bootstrapRequired ?? false;
  const title = bootstrapRequired ? "Set up Rakss HR" : "Welcome back";
  const subtitle = bootstrapRequired
    ? "Create the first administrator account to secure and open this workspace."
    : "Sign in with your administrator account to continue.";
  const canSubmit = !loading && !bootstrapStatusLoading && !bootstrapStatusError;

  useEffect(() => {
    document.title = bootstrapRequired
      ? "Set Up Admin - Rakss HR"
      : "Sign In - Rakss HR Admin";
  }, [bootstrapRequired]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

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
          });

      const payload = bootstrapRequired ? result.data?.bootstrapAdmin : result.data?.login;

      if (!payload?.accessToken) {
        throw new Error("Authentication response did not include an access token");
      }

      if (!bootstrapRequired && !hasAdminPanelAccess(payload.account)) {
        clearAdminSession();
        throw new Error(
          "This account can use the mobile app, but only ADMIN, HR_ADMIN, MANAGER, and SUPERVISOR accounts can access the admin panel.",
        );
      }

      persistAdminSession(payload);
      await apolloClient.clearStore();
      navigate("/");
    } catch (submitError) {
      console.error("Login failed:", submitError);
      setError(
        submitError instanceof Error ? submitError.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-accent/70 blur-3xl"
      />

      <div className="relative w-full max-w-[460px]">
        <div className="mb-6 flex items-center justify-center gap-3 sm:mb-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(124,61,40,0.2)]">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
              Rakss HR
            </p>
            <p className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-foreground">
              People operations
            </p>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardHeader className="space-y-2 p-6 pb-4 sm:p-7 sm:pb-4">
            <p className="app-kicker">
              {bootstrapRequired ? "First-time setup" : "Secure admin access"}
            </p>
            <h1 className="app-editorial text-[2rem] leading-tight text-foreground">
              {title}
            </h1>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-6 pt-0 sm:p-7 sm:pt-0">
            {bootstrapStatusError ? (
              <Notice tone="warning">
                <div>
                  <p className="font-semibold">The authentication service is not reachable.</p>
                  <p className="mt-1">{bootstrapStatusError.message}</p>
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
                  {bootstrapRequired ? "Create password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={bootstrapRequired ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    bootstrapRequired ? "Minimum 8 characters" : "Enter your password"
                  }
                  required
                />
              </div>

              <Button className="w-full" type="submit" disabled={!canSubmit}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {bootstrapRequired ? "Creating admin account..." : "Signing in..."}
                  </>
                ) : bootstrapRequired ? (
                  "Create admin"
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          Protected workspace for authorized Rakss HR administrators.
        </p>
      </div>
    </main>
  );
}
