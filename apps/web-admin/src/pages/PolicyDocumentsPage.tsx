import { FormEvent, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Archive, ExternalLink, FileText, Pencil, Plus } from "lucide-react";

import { AdminHero } from "@/components/admin/admin-hero";
import { PageFeedback } from "@/components/admin/page-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDrawer } from "@/components/ui/form-drawer";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { canManageAccounts, readStoredAdminAccount } from "@/lib/auth-session";
import { readFileAsBase64 } from "@/lib/download-export";
import { formatDate } from "@/lib/utils";

const POLICY_DOCUMENTS_QUERY = gql`
  query PolicyDocuments {
    policyDocuments {
      id
      title
      category
      version
      effectiveDate
      description
      status
      documentUrl
      documentOriginalName
      documentMimeType
      content
      createdAt
      publishedAt
    }
  }
`;

const CREATE_POLICY_DOCUMENT_MUTATION = gql`
  mutation CreatePolicyDocument($input: CreatePolicyDocumentInput!) {
    createPolicyDocument(input: $input) {
      id
    }
  }
`;

const UPDATE_POLICY_DOCUMENT_MUTATION = gql`
  mutation UpdatePolicyDocument($input: UpdatePolicyDocumentInput!) {
    updatePolicyDocument(input: $input) {
      id
    }
  }
`;

const PUBLISH_POLICY_DOCUMENT_MUTATION = gql`
  mutation PublishPolicyDocument($input: PublishPolicyDocumentInput!) {
    publishPolicyDocument(input: $input) {
      id
      status
    }
  }
`;

const ARCHIVE_POLICY_DOCUMENT_MUTATION = gql`
  mutation ArchivePolicyDocument($input: ArchivePolicyDocumentInput!) {
    archivePolicyDocument(input: $input) {
      id
      status
    }
  }
`;

const UPLOAD_POLICY_DOCUMENT_FILE_MUTATION = gql`
  mutation UploadPolicyDocumentFile($input: UploadPolicyDocumentFileInput!) {
    uploadPolicyDocumentFile(input: $input) {
      id
      documentUrl
      documentOriginalName
      documentMimeType
    }
  }
`;

type PolicyFormState = {
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  description: string;
  documentUrl: string;
  content: string;
  status: string;
};

const policyFormDefaults: PolicyFormState = {
  title: "",
  category: "",
  version: "1.0",
  effectiveDate: new Date().toISOString().slice(0, 10),
  description: "",
  documentUrl: "",
  content: "",
  status: "DRAFT",
};

export function PolicyDocumentsPage() {
  const currentAdminAccount = readStoredAdminAccount();
  const canManagePolicies = canManageAccounts(currentAdminAccount);
  const [policyForm, setPolicyForm] = useState(policyFormDefaults);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const { data, loading, error, refetch } = useQuery(POLICY_DOCUMENTS_QUERY);
  const [createPolicyDocument, { loading: creatingPolicyDocument }] =
    useMutation(CREATE_POLICY_DOCUMENT_MUTATION);
  const [updatePolicyDocument, { loading: updatingPolicyDocument }] =
    useMutation(UPDATE_POLICY_DOCUMENT_MUTATION);
  const [uploadPolicyDocumentFile, { loading: uploadingPolicyFile }] =
    useMutation(UPLOAD_POLICY_DOCUMENT_FILE_MUTATION);
  const [publishPolicyDocument, { loading: publishingPolicyDocument }] =
    useMutation(PUBLISH_POLICY_DOCUMENT_MUTATION);
  const [archivePolicyDocument, { loading: archivingPolicyDocument }] =
    useMutation(ARCHIVE_POLICY_DOCUMENT_MUTATION);

  const policies = data?.policyDocuments ?? [];
  const publishedCount = policies.filter(
    (policy: { status: string }) => policy.status === "PUBLISHED",
  ).length;

  const handleComposerToggle = () => {
    setPolicyForm(policyFormDefaults);
    setEditingPolicyId(null);
    setSelectedFile(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setShowComposer(true);
  };

  const handleSavePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const input = {
        title: policyForm.title,
        category: policyForm.category,
        version: policyForm.version,
        effectiveDate: policyForm.effectiveDate,
        description: policyForm.description,
        documentUrl: policyForm.documentUrl || null,
        content: policyForm.content || null,
        status: policyForm.status,
      };
      const saved = editingPolicyId
        ? await updatePolicyDocument({
            variables: {
              input: {
                id: editingPolicyId,
                ...input,
              },
            },
          })
        : await createPolicyDocument({
            variables: {
              input,
            },
          });

      const savedPolicyId = editingPolicyId
        ? editingPolicyId
        : (saved.data?.createPolicyDocument?.id as string | undefined);
      if (selectedFile && savedPolicyId) {
        const contentBase64 = await readFileAsBase64(selectedFile);
        await uploadPolicyDocumentFile({
          variables: {
            input: {
              policyDocumentId: savedPolicyId,
              fileName: selectedFile.name,
              mimeType: selectedFile.type || "application/octet-stream",
              contentBase64,
            },
          },
        });
      }

      setPolicyForm(policyFormDefaults);
      setEditingPolicyId(null);
      setSelectedFile(null);
      setShowComposer(false);
      setStatusMessage(
        selectedFile
          ? editingPolicyId
            ? "Policy document updated and file uploaded."
            : "Policy document created and file uploaded."
          : editingPolicyId
            ? "Policy document updated."
            : "Policy document created.",
      );
      await refetch();
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to save policy document.",
      );
    }
  };

  const handleEditPolicy = (policy: {
    id: string;
    title: string;
    category: string;
    version: string;
    effectiveDate: string;
    description: string;
    documentUrl?: string | null;
    content?: string | null;
    status: string;
  }) => {
    setEditingPolicyId(policy.id);
    setPolicyForm({
      title: policy.title,
      category: policy.category,
      version: policy.version,
      effectiveDate: policy.effectiveDate,
      description: policy.description,
      documentUrl: policy.documentUrl ?? "",
      content: policy.content ?? "",
      status: policy.status,
    });
    setSelectedFile(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setShowComposer(true);
  };

  const handleArchivePolicy = async (policyDocumentId: string, title: string) => {
    if (!window.confirm(`Archive ${title}? Employees will no longer see it.`)) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await archivePolicyDocument({
        variables: {
          input: {
            policyDocumentId,
          },
        },
      });
      setStatusMessage("Policy document archived.");
      await refetch();
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to archive policy document.",
      );
    }
  };

  const handlePublishPolicy = async (policyDocumentId: string) => {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await publishPolicyDocument({
        variables: {
          input: {
            policyDocumentId,
          },
        },
      });
      setStatusMessage("Policy document published.");
      await refetch();
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to publish policy document.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <AdminHero
        kicker="Policy library"
        title="Keep policy access simple and current."
        description="Publish only the documents employees need, with a lightweight editor for drafts and uploads."
        actions={
          canManagePolicies ? (
            <Button onClick={handleComposerToggle}>
              <Plus className="mr-2 h-4 w-4" />
              New policy
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          detail="All policy records"
          icon={FileText}
          label="Policies"
          tone="bg-sky-100 text-sky-800"
          value={String(policies.length)}
        />
        <MetricCard
          detail="Visible to employees"
          label="Published"
          tone="bg-emerald-100 text-emerald-800"
          value={String(publishedCount)}
        />
        <MetricCard
          detail="Awaiting release"
          label="Drafts"
          tone="bg-amber-100 text-amber-800"
          value={String(policies.length - publishedCount)}
        />
      </div>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      <FormDrawer
        open={canManagePolicies && showComposer}
        onOpenChange={(open) => {
          if (open) {
            setShowComposer(true);
          } else {
            setShowComposer(false);
            setEditingPolicyId(null);
            setSelectedFile(null);
            setPolicyForm(policyFormDefaults);
          }
        }}
        kicker="Composer"
        title={editingPolicyId ? "Edit policy document" : "Create policy document"}
        description="Draft, upload, or publish a policy without leaving the library."
      >
            <form className="space-y-4" onSubmit={handleSavePolicy}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={policyForm.title}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Policy title"
                  required
                />
                <Input
                  value={policyForm.category}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  placeholder="Category"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  value={policyForm.version}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      version: event.target.value,
                    }))
                  }
                  placeholder="Version"
                  required
                />
                <Input
                  type="date"
                  value={policyForm.effectiveDate}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      effectiveDate: event.target.value,
                    }))
                  }
                  required
                />
                <select
                  value={policyForm.status}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
              <Input
                value={policyForm.description}
                onChange={(event) =>
                  setPolicyForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Short description"
                required
              />
              <Input
                value={policyForm.documentUrl}
                onChange={(event) =>
                  setPolicyForm((current) => ({
                    ...current,
                    documentUrl: event.target.value,
                  }))
                }
                placeholder="Optional document URL"
              />
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,.odt"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Upload a source file or link to an external document. Either
                  option is fine.
                </p>
              </div>
              <textarea
                value={policyForm.content}
                onChange={(event) =>
                  setPolicyForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
                placeholder="Policy summary or text content"
              />
              <Button
                type="submit"
                disabled={
                  creatingPolicyDocument ||
                  updatingPolicyDocument ||
                  uploadingPolicyFile
                }
              >
                {creatingPolicyDocument ||
                updatingPolicyDocument ||
                uploadingPolicyFile
                  ? "Saving..."
                  : editingPolicyId
                    ? "Update policy"
                    : "Save policy"}
              </Button>
              {editingPolicyId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingPolicyId(null);
                    setPolicyForm(policyFormDefaults);
                    setSelectedFile(null);
                    setShowComposer(false);
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </form>
      </FormDrawer>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading policy documents...
          </CardContent>
        </Card>
      ) : error ? (
        <Notice tone="danger">
          Unable to load policy documents. {error.message}
        </Notice>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No policy documents have been created yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map(
            (policy: {
              id: string;
              title: string;
              category: string;
              version: string;
              effectiveDate: string;
              description: string;
              status: string;
              documentUrl?: string | null;
              documentOriginalName?: string | null;
              content?: string | null;
              publishedAt?: string | null;
            }) => (
              <Card key={policy.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <StatusBadge
                      tone={
                        policy.status === "PUBLISHED" ? "success" : "warning"
                      }
                    >
                      {policy.status}
                    </StatusBadge>
                  </div>
                  <CardTitle className="mt-4">{policy.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {policy.description}
                  </p>
                  {policy.content ? (
                    <div className="app-muted-surface p-4 text-sm leading-6 text-muted-foreground">
                      {policy.content}
                    </div>
                  ) : null}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Category</span>
                      <span className="font-medium text-foreground">
                        {policy.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Version</span>
                      <span className="font-medium text-foreground">
                        {policy.version}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Effective</span>
                      <span className="font-medium text-foreground">
                        {formatDate(policy.effectiveDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Published</span>
                      <span className="font-medium text-foreground">
                        {policy.publishedAt
                          ? formatDate(policy.publishedAt)
                          : "Draft"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {policy.documentUrl ? (
                      <Button asChild variant="outline">
                        <a
                          href={policy.documentUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {policy.documentOriginalName
                            ? "Open file"
                            : "Open link"}
                        </a>
                      </Button>
                    ) : null}
                    {canManagePolicies && policy.status !== "PUBLISHED" ? (
                      <Button
                        type="button"
                        disabled={publishingPolicyDocument}
                        onClick={() => handlePublishPolicy(policy.id)}
                      >
                        {publishingPolicyDocument ? "Publishing..." : "Publish"}
                      </Button>
                    ) : null}
                    {canManagePolicies ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleEditPolicy(policy)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    ) : null}
                    {canManagePolicies && policy.status !== "ARCHIVED" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={archivingPolicyDocument}
                        onClick={() => handleArchivePolicy(policy.id, policy.title)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
