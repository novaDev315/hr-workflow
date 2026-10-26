import { gql } from '@apollo/client'

export const POLICY_DOCUMENTS_QUERY = gql`
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

export const CREATE_POLICY_DOCUMENT_MUTATION = gql`
  mutation CreatePolicyDocument($input: CreatePolicyDocumentInput!) {
    createPolicyDocument(input: $input) {
      id
    }
  }
`

export const UPDATE_POLICY_DOCUMENT_MUTATION = gql`
  mutation UpdatePolicyDocument($input: UpdatePolicyDocumentInput!) {
    updatePolicyDocument(input: $input) {
      id
    }
  }
`

export const PUBLISH_POLICY_DOCUMENT_MUTATION = gql`
  mutation PublishPolicyDocument($input: PublishPolicyDocumentInput!) {
    publishPolicyDocument(input: $input) {
      id
      status
    }
  }
`

export const ARCHIVE_POLICY_DOCUMENT_MUTATION = gql`
  mutation ArchivePolicyDocument($input: ArchivePolicyDocumentInput!) {
    archivePolicyDocument(input: $input) {
      id
      status
    }
  }
`

export const UPLOAD_POLICY_DOCUMENT_FILE_MUTATION = gql`
  mutation UploadPolicyDocumentFile($input: UploadPolicyDocumentFileInput!) {
    uploadPolicyDocumentFile(input: $input) {
      id
      documentUrl
      documentOriginalName
      documentMimeType
    }
  }
`

export type PolicyDocument = {
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
  createdAt?: string | null
  publishedAt?: string | null
}
