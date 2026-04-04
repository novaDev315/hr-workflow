import { FormEvent, useState } from 'react'
import { gql, useMutation, useQuery } from '@apollo/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, FileText, ExternalLink } from 'lucide-react'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'
import { readFileAsBase64 } from '@/lib/download-export'

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
`

const CREATE_POLICY_DOCUMENT_MUTATION = gql`
  mutation CreatePolicyDocument($input: CreatePolicyDocumentInput!) {
    createPolicyDocument(input: $input) {
      id
    }
  }
`

const PUBLISH_POLICY_DOCUMENT_MUTATION = gql`
  mutation PublishPolicyDocument($input: PublishPolicyDocumentInput!) {
    publishPolicyDocument(input: $input) {
      id
      status
    }
  }
`

const UPLOAD_POLICY_DOCUMENT_FILE_MUTATION = gql`
  mutation UploadPolicyDocumentFile($input: UploadPolicyDocumentFileInput!) {
    uploadPolicyDocumentFile(input: $input) {
      id
      documentUrl
      documentOriginalName
      documentMimeType
    }
  }
`

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

const policyFormDefaults: PolicyFormState = {
  title: '',
  category: '',
  version: '1.0',
  effectiveDate: new Date().toISOString().slice(0, 10),
  description: '',
  documentUrl: '',
  content: '',
  status: 'DRAFT',
}

export function PolicyDocumentsPage() {
  const currentAdminAccount = readStoredAdminAccount()
  const canManagePolicies = canManageAccounts(currentAdminAccount?.roles ?? [])
  const [policyForm, setPolicyForm] = useState(policyFormDefaults)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, loading, error, refetch } = useQuery(POLICY_DOCUMENTS_QUERY)
  const [createPolicyDocument, { loading: creatingPolicyDocument }] = useMutation(
    CREATE_POLICY_DOCUMENT_MUTATION
  )
  const [uploadPolicyDocumentFile, { loading: uploadingPolicyFile }] = useMutation(
    UPLOAD_POLICY_DOCUMENT_FILE_MUTATION
  )
  const [publishPolicyDocument, { loading: publishingPolicyDocument }] = useMutation(
    PUBLISH_POLICY_DOCUMENT_MUTATION
  )

  const policies = data?.policyDocuments ?? []

  const handleCreatePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const created = await createPolicyDocument({
        variables: {
          input: {
            title: policyForm.title,
            category: policyForm.category,
            version: policyForm.version,
            effectiveDate: policyForm.effectiveDate,
            description: policyForm.description,
            documentUrl: policyForm.documentUrl || null,
            content: policyForm.content || null,
            status: policyForm.status,
          },
        },
      })

      const createdPolicyId = created.data?.createPolicyDocument?.id as string | undefined
      if (selectedFile && createdPolicyId) {
        const contentBase64 = await readFileAsBase64(selectedFile)
        await uploadPolicyDocumentFile({
          variables: {
            input: {
              policyDocumentId: createdPolicyId,
              fileName: selectedFile.name,
              mimeType: selectedFile.type || 'application/octet-stream',
              contentBase64,
            },
          },
        })
      }

      setPolicyForm(policyFormDefaults)
      setSelectedFile(null)
      setStatusMessage(
        selectedFile ? 'Policy document created and file uploaded.' : 'Policy document created.'
      )
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create policy document.'
      )
    }
  }

  const handlePublishPolicy = async (policyDocumentId: string) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await publishPolicyDocument({
        variables: {
          input: {
            policyDocumentId,
          },
        },
      })
      setStatusMessage('Policy document published.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to publish policy document.'
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Policy Documents</h1>
          <p className="text-muted-foreground">Company policies and handbooks</p>
        </div>
        {canManagePolicies && (
          <Button onClick={() => setPolicyForm(policyFormDefaults)}>
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Button>
        )}
      </div>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">{errorMessage}</CardContent>
        </Card>
      )}

      {statusMessage && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">
            {statusMessage}
          </CardContent>
        </Card>
      )}

      {canManagePolicies && (
        <Card>
          <CardHeader>
            <CardTitle>Create Policy Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreatePolicy}>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Upload a policy file to store it inside HRFlow. External URLs are still optional.
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
                className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button type="submit" disabled={creatingPolicyDocument || uploadingPolicyFile}>
                {creatingPolicyDocument || uploadingPolicyFile
                  ? 'Saving...'
                  : 'Save Policy Document'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading policy documents...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-sm text-red-600">
              Unable to load policy documents. {error.message}
            </CardContent>
          </Card>
        ) : policies.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No policy documents have been created yet.
            </CardContent>
          </Card>
        ) : (
          policies.map(
            (policy: {
              id: string
              title: string
              category: string
              version: string
              effectiveDate: string
              description: string
              status: string
              documentUrl?: string | null
              documentOriginalName?: string | null
              documentMimeType?: string | null
              content?: string | null
              publishedAt?: string | null
            }) => (
              <Card key={policy.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-primary" />
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        policy.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {policy.status}
                    </span>
                  </div>
                  <CardTitle className="mt-3">{policy.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{policy.description}</p>
                    {policy.content && (
                      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                        {policy.content}
                      </p>
                    )}
                    <div className="border-t pt-2 text-sm">
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-muted-foreground">Category:</span>
                        <span className="font-medium">{policy.category}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-muted-foreground">Version:</span>
                        <span className="font-medium">{policy.version}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-muted-foreground">Effective:</span>
                        <span className="font-medium">{policy.effectiveDate}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-muted-foreground">Published:</span>
                        <span className="font-medium">{policy.publishedAt || 'Draft'}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {policy.documentUrl && (
                        <Button asChild variant="outline">
                          <a href={policy.documentUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {policy.documentOriginalName
                              ? `Open ${policy.documentOriginalName}`
                              : 'Open Link'}
                          </a>
                        </Button>
                      )}
                      {canManagePolicies && policy.status !== 'PUBLISHED' && (
                        <Button
                          type="button"
                          disabled={publishingPolicyDocument}
                          onClick={() => handlePublishPolicy(policy.id)}
                        >
                          {publishingPolicyDocument ? 'Publishing...' : 'Publish'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )
        )}
      </div>
    </div>
  )
}
