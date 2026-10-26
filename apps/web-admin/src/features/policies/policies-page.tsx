import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client'
import { Archive, ExternalLink, FileText, Paperclip, Pencil, Plus } from 'lucide-react'

import { AdminHero } from '@/components/admin/admin-hero'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { readFileAsBase64 } from '@/lib/download-export'
import { formatDay, safeExternalUrl, todayLocal } from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'

import {
  ARCHIVE_POLICY_DOCUMENT_MUTATION,
  CREATE_POLICY_DOCUMENT_MUTATION,
  POLICY_DOCUMENTS_QUERY,
  PUBLISH_POLICY_DOCUMENT_MUTATION,
  UPDATE_POLICY_DOCUMENT_MUTATION,
  UPLOAD_POLICY_DOCUMENT_FILE_MUTATION,
  type PolicyDocument,
} from './graphql'
import { checkPolicyFile, isUploadedFile, POLICY_FILE_ACCEPT, POLICY_FILE_HINT } from './upload-rules'

type PolicyFormState = {
  title: string
  category: string
  version: string
  effectiveDate: string
  description: string
  documentUrl: string
  content: string
  status: string
}

function policyFormDefaults(): PolicyFormState {
  return {
    title: '',
    category: '',
    version: '1.0',
    effectiveDate: todayLocal(),
    description: '',
    documentUrl: '',
    content: '',
    status: 'DRAFT',
  }
}

function policyTone(status: string) {
  if (status === 'PUBLISHED') return 'success' as const
  if (status === 'ARCHIVED') return 'neutral' as const
  return 'warning' as const
}

function PolicyDocumentLink({ policy }: { policy: PolicyDocument }) {
  if (!policy.documentUrl) return null

  const uploaded = isUploadedFile(policy)
  const fileLabel = policy.documentOriginalName || 'Linked document'

  // Uploaded files are only served once the policy is published.
  if (uploaded && policy.status !== 'PUBLISHED') {
    return (
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <Paperclip aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{fileLabel}</span>
        <span className="shrink-0">· Available after publishing</span>
      </p>
    )
  }

  const safeUrl = safeExternalUrl(policy.documentUrl)
  if (!safeUrl) {
    return (
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <Paperclip aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate" title={policy.documentUrl}>
          {policy.documentUrl}
        </span>
        <span className="shrink-0">· Not a web link</span>
      </p>
    )
  }

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-w-0 max-w-full items-center gap-2 text-[13px] font-semibold text-primary hover:underline"
    >
      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{uploaded ? `View ${fileLabel}` : 'Open document link'}</span>
    </a>
  )
}

export function PolicyDocumentsPage() {
  const { account } = useAdminSession()
  const canManagePolicies = canManageAccounts(account)
  const [policyForm, setPolicyForm] = useState(policyFormDefaults)
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [archiving, setArchiving] = useState<PolicyDocument | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const { data, loading, error, refetch } = useQuery<{ policyDocuments: PolicyDocument[] }>(
    POLICY_DOCUMENTS_QUERY,
  )
  const [createPolicyDocument, { loading: creating }] = useMutation(CREATE_POLICY_DOCUMENT_MUTATION)
  const [updatePolicyDocument, { loading: updating }] = useMutation(UPDATE_POLICY_DOCUMENT_MUTATION)
  const [uploadPolicyDocumentFile, { loading: uploading }] = useMutation(UPLOAD_POLICY_DOCUMENT_FILE_MUTATION)
  const [publishPolicyDocument] = useMutation(PUBLISH_POLICY_DOCUMENT_MUTATION)
  const [archivePolicyDocument, { loading: archivingPolicy }] = useMutation(ARCHIVE_POLICY_DOCUMENT_MUTATION)
  const saving = creating || updating || uploading

  const policies = data?.policyDocuments ?? []
  const publishedCount = policies.filter((policy) => policy.status === 'PUBLISHED').length
  const draftCount = policies.filter((policy) => policy.status === 'DRAFT').length
  const archivedCount = policies.filter((policy) => policy.status === 'ARCHIVED').length

  const resetFeedback = () => {
    setErrorMessage(null)
    setStatusMessage(null)
    setFormError(null)
  }

  const resetComposer = () => {
    setPolicyForm(policyFormDefaults())
    setEditingPolicyId(null)
    setSelectedFile(null)
    setFileInputKey((key) => key + 1)
    setFormError(null)
  }

  const openNewPolicy = () => {
    resetFeedback()
    resetComposer()
    setShowComposer(true)
  }

  const handleFileChange = (file: File | null) => {
    setFormError(null)
    if (!file) {
      setSelectedFile(null)
      return
    }
    const check = checkPolicyFile(file)
    if (!check.ok) {
      setSelectedFile(null)
      setFileInputKey((key) => key + 1)
      setFormError(check.message)
      return
    }
    setSelectedFile(file)
  }

  const handleSavePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetFeedback()

    const documentUrl = policyForm.documentUrl.trim()
    if (documentUrl && !safeExternalUrl(documentUrl)) {
      setFormError('The document link must start with https:// or http://.')
      return
    }

    let fileMimeType: string | null = null
    if (selectedFile) {
      const check = checkPolicyFile(selectedFile)
      if (!check.ok) {
        setFormError(check.message)
        return
      }
      fileMimeType = check.mimeType
    }

    const wasEditing = Boolean(editingPolicyId)
    let policyId = editingPolicyId

    try {
      const input = {
        title: policyForm.title.trim(),
        category: policyForm.category.trim(),
        version: policyForm.version.trim(),
        effectiveDate: policyForm.effectiveDate,
        description: policyForm.description.trim(),
        documentUrl: documentUrl || null,
        content: policyForm.content.trim() || null,
        status: policyForm.status,
      }

      if (policyId) {
        const existing = policies.find((policy) => policy.id === policyId)
        // An empty link field must not wipe an uploaded file's URL.
        const { documentUrl: linkInput, ...rest } = input
        const keepUploadedFile = !linkInput && existing && isUploadedFile(existing)
        await updatePolicyDocument({
          variables: {
            input: { id: policyId, ...rest, ...(keepUploadedFile ? {} : { documentUrl: linkInput }) },
          },
        })
      } else {
        const created = await createPolicyDocument({ variables: { input } })
        policyId = (created.data?.createPolicyDocument?.id as string | undefined) ?? null
        // From here on, a retry updates this policy instead of creating a duplicate.
        if (policyId) setEditingPolicyId(policyId)
      }
    } catch (mutationError) {
      setFormError(readableError(mutationError, 'Could not save the policy.'))
      return
    }

    if (selectedFile && policyId && fileMimeType) {
      try {
        const contentBase64 = await readFileAsBase64(selectedFile)
        await uploadPolicyDocumentFile({
          variables: {
            input: {
              policyDocumentId: policyId,
              fileName: selectedFile.name,
              mimeType: fileMimeType,
              contentBase64,
            },
          },
        })
      } catch (uploadError) {
        await refetch()
        setFormError(
          `The policy was saved, but the file did not upload: ${readableError(uploadError, 'please try again.')} Select Save to try the upload again.`,
        )
        return
      }
    }

    setShowComposer(false)
    resetComposer()
    setStatusMessage(
      wasEditing
        ? 'Policy updated.'
        : selectedFile
          ? 'Policy created with its file.'
          : 'Policy created.',
    )
    await refetch()
  }

  const handleEditPolicy = (policy: PolicyDocument) => {
    resetFeedback()
    setEditingPolicyId(policy.id)
    setPolicyForm({
      title: policy.title,
      category: policy.category,
      version: policy.version,
      effectiveDate: policy.effectiveDate,
      description: policy.description,
      documentUrl: isUploadedFile(policy) ? '' : policy.documentUrl ?? '',
      content: policy.content ?? '',
      status: policy.status === 'ARCHIVED' ? 'DRAFT' : policy.status,
    })
    setSelectedFile(null)
    setFileInputKey((key) => key + 1)
    setShowComposer(true)
  }

  const handleArchivePolicy = async () => {
    if (!archiving) return
    resetFeedback()
    try {
      await archivePolicyDocument({ variables: { input: { policyDocumentId: archiving.id } } })
      setStatusMessage(`${archiving.title} archived.`)
      setArchiving(null)
      await refetch()
    } catch (mutationError) {
      setArchiving(null)
      setErrorMessage(readableError(mutationError, 'Could not archive the policy.'))
    }
  }

  const handlePublishPolicy = async (policy: PolicyDocument) => {
    resetFeedback()
    setPublishingId(policy.id)
    try {
      await publishPolicyDocument({ variables: { input: { policyDocumentId: policy.id } } })
      setStatusMessage(`${policy.title} published. Employees can see it now.`)
      await refetch()
    } catch (mutationError) {
      setErrorMessage(readableError(mutationError, 'Could not publish the policy.'))
    } finally {
      setPublishingId(null)
    }
  }

  const editingPolicy = policies.find((policy) => policy.id === editingPolicyId) ?? null

  return (
    <div className="min-w-0 space-y-4">
      <AdminHero
        title="Policies"
        description="Publish the documents employees need and keep drafts out of sight."
        actions={
          canManagePolicies ? (
            <Button onClick={openNewPolicy}>
              <Plus className="mr-2 h-4 w-4" />
              New policy
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Published"
          value={String(publishedCount)}
          detail="Visible to employees"
        />
        <MetricCard label="Drafts" value={String(draftCount)} detail="Not visible to employees yet" />
        <MetricCard label="Archived" value={String(archivedCount)} detail="Kept for the record" />
      </div>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      {loading && !data ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading policies…</CardContent>
        </Card>
      ) : error && !data ? (
        <PageFeedback loadError={error} loadErrorPrefix="Policies could not be loaded." />
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="text-sm text-muted-foreground">No policies yet.</p>
            {canManagePolicies ? (
              <Button variant="outline" onClick={openNewPolicy}>
                <Plus className="mr-2 h-4 w-4" />
                Add the first policy
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((policy) => (
            <Card key={policy.id} className="flex min-w-0 flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <FileText aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <h2 className="app-editorial min-w-0 break-words text-[1.2rem] leading-tight text-foreground">
                      {policy.title}
                    </h2>
                  </div>
                  <StatusBadge tone={policyTone(policy.status)} value={policy.status} />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {policy.category} · Version {policy.version} · Effective {formatDay(policy.effectiveDate)}
                </p>
                <p className="text-sm leading-6 text-foreground">{policy.description}</p>
                {policy.content ? (
                  <p className="line-clamp-3 text-[13px] leading-5 text-muted-foreground">{policy.content}</p>
                ) : null}
                <PolicyDocumentLink policy={policy} />
                <p className="text-xs text-muted-foreground">
                  {policy.publishedAt ? `Published ${formatDay(policy.publishedAt)}` : 'Not published'}
                </p>
                {canManagePolicies ? (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {policy.status !== 'PUBLISHED' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={publishingId === policy.id}
                        onClick={() => handlePublishPolicy(policy)}
                      >
                        {publishingId === policy.id ? 'Publishing…' : 'Publish'}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPolicy(policy)}
                      aria-label={`Edit ${policy.title}`}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {policy.status !== 'ARCHIVED' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setArchiving(policy)}
                        aria-label={`Archive ${policy.title}`}
                      >
                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                        Archive
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormDrawer
        open={canManagePolicies && showComposer}
        onOpenChange={(open) => {
          if (open) {
            setShowComposer(true)
          } else {
            setShowComposer(false)
            resetComposer()
          }
        }}
        title={editingPolicyId ? 'Edit policy' : 'New policy'}
        description="Save as a draft, or publish it so employees can see it."
      >
        <form className="space-y-4" onSubmit={handleSavePolicy}>
          {formError ? (
            <Notice tone="danger" role="alert">
              {formError}
            </Notice>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="policy-title">Title</Label>
              <Input
                id="policy-title"
                value={policyForm.title}
                onChange={(event) => setPolicyForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-category">Category</Label>
              <Input
                id="policy-category"
                value={policyForm.category}
                onChange={(event) => setPolicyForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="Handbook, IT policy…"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="policy-version">Version</Label>
              <Input
                id="policy-version"
                value={policyForm.version}
                onChange={(event) => setPolicyForm((current) => ({ ...current, version: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-effective">Effective from</Label>
              <Input
                id="policy-effective"
                type="date"
                value={policyForm.effectiveDate}
                onChange={(event) =>
                  setPolicyForm((current) => ({ ...current, effectiveDate: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-status">Status</Label>
              <Select
                name="policy-status"
                value={policyForm.status}
                onValueChange={(status) => setPolicyForm((current) => ({ ...current, status }))}
              >
                <SelectTrigger id="policy-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-description">Short description</Label>
            <Input
              id="policy-description"
              value={policyForm.description}
              onChange={(event) => setPolicyForm((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-file">File</Label>
            {editingPolicy && isUploadedFile(editingPolicy) && !selectedFile ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                Current file: {editingPolicy.documentOriginalName}. Choose a new file to replace it.
              </p>
            ) : null}
            <Input
              key={fileInputKey}
              id="policy-file"
              type="file"
              accept={POLICY_FILE_ACCEPT}
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              aria-describedby="policy-file-hint"
            />
            <p id="policy-file-hint" className="text-xs text-muted-foreground">
              {POLICY_FILE_HINT} Or add a link below instead.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-link">Document link</Label>
            <Input
              id="policy-link"
              type="url"
              inputMode="url"
              value={policyForm.documentUrl}
              onChange={(event) => setPolicyForm((current) => ({ ...current, documentUrl: event.target.value }))}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-content">Summary</Label>
            <Textarea
              id="policy-content"
              value={policyForm.content}
              onChange={(event) => setPolicyForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="Optional summary employees see with the policy"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {uploading ? 'Uploading…' : saving ? 'Saving…' : editingPolicyId ? 'Save changes' : 'Save policy'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowComposer(false)
                resetComposer()
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => (open ? undefined : setArchiving(null))}
        title={archiving ? `Archive ${archiving.title}?` : 'Archive policy?'}
        description="Employees will no longer see it. You can still edit and publish it again later."
        confirmLabel="Archive"
        tone="destructive"
        busy={archivingPolicy}
        onConfirm={handleArchivePolicy}
      />
    </div>
  )
}
