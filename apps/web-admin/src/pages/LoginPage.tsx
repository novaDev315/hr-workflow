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
  CardTitle,
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
  const title = bootstrapRequired ? "Set up admin access" : "Sign in";
  const subtitle = bootstrapRequired
    ? "Create the first administrator account."
    : "Admin access only.";
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
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-[1220px] gap-4 lg:grid-cols-[minmax(0,1.08fr)_460px]">
        <section className="app-hero-surface p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-primary text-primary-foreground">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="app-kicker">Rakss HR</p>
              <p className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-foreground">
                Admin workspace
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <p className="app-kicker">{bootstrapRequired ? "Set up access" : "Daily entry"}</p>
            <h1 className="app-section-title max-w-3xl text-[2.9rem] sm:text-[4rem]">
              {bootstrapRequired
                ? "Create a calmer home for people operations."
                : "A calmer sign-in for the live people workspace."}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {bootstrapRequired
                ? "Use the first administrator account to open the live HR system with the same warm, low-noise feel as Talent Haven."
                : "Approvals, people updates, payroll, and policy work all sit behind the same steady, low-noise admin surface."}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: bootstrapRequired ? "First admin" : "Leave review",
                detail: bootstrapRequired
                  ? "Set up the first account and open the workspace."
                  : "Keep today focused on approvals and urgent requests.",
              },
              {
                title: "People updates",
                detail: "Employee records, access, and staffing context stay close by.",
              },
              {
                title: "Policy clarity",
                detail: "Low-noise surfaces keep documents and follow-up work readable.",
              },
            ].map((item) => (
              <div className="app-muted-surface p-4" key={item.title}>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="self-center">
          <CardHeader className="space-y-5">
            <div className="space-y-1.5">
              <CardTitle className="text-[2rem]">{title}</CardTitle>
              <CardDescription className="text-sm">{subtitle}</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
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
      </div>
    </div>
  );
}
