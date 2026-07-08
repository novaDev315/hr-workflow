import { useMemo } from 'react'
import { useMutation, useQuery } from '@apollo/client'

import {
  ADVANCE_RECRUITMENT_APPLICATION_MUTATION,
  CHANGE_JOB_REQUISITION_STATUS_MUTATION,
  CREATE_JOB_REQUISITION_MUTATION,
  CREATE_RECRUITMENT_APPLICATION_MUTATION,
  RECRUITMENT_PAGE_QUERY,
  UPDATE_JOB_REQUISITION_MUTATION,
  UPDATE_RECRUITMENT_APPLICATION_MUTATION,
} from './graphql'

export function useRecruitmentWorkspaceGraphql({
  applicationStatusFilter,
  canManageRecruitment,
  searchQuery,
  selectedRequisitionFilter,
  statusFilter,
}: {
  applicationStatusFilter: string
  canManageRecruitment: boolean
  searchQuery: string
  selectedRequisitionFilter: string
  statusFilter: string
}) {
  const queryVariables = useMemo(
    () => ({
      requisitionFilter: {
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      applicationFilter: {
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        ...(applicationStatusFilter ? { status: applicationStatusFilter } : {}),
        ...(selectedRequisitionFilter
          ? { requisitionId: selectedRequisitionFilter }
          : {}),
      },
    }),
    [
      applicationStatusFilter,
      searchQuery,
      selectedRequisitionFilter,
      statusFilter,
    ]
  )

  const { data, loading, error, refetch } = useQuery(RECRUITMENT_PAGE_QUERY, {
    skip: !canManageRecruitment,
    variables: queryVariables,
  })
  const [createJobRequisition, { loading: creatingRequisition }] = useMutation(
    CREATE_JOB_REQUISITION_MUTATION
  )
  const [updateJobRequisition, { loading: updatingRequisition }] = useMutation(
    UPDATE_JOB_REQUISITION_MUTATION
  )
  const [changeJobRequisitionStatus, { loading: changingRequisitionStatus }] =
    useMutation(CHANGE_JOB_REQUISITION_STATUS_MUTATION)
  const [createRecruitmentApplication, { loading: creatingApplication }] =
    useMutation(CREATE_RECRUITMENT_APPLICATION_MUTATION)
  const [updateRecruitmentApplication, { loading: updatingApplication }] =
    useMutation(UPDATE_RECRUITMENT_APPLICATION_MUTATION)
  const [advanceRecruitmentApplication, { loading: advancingApplication }] =
    useMutation(ADVANCE_RECRUITMENT_APPLICATION_MUTATION)

  return {
    data,
    loading,
    error,
    refetch,
    createJobRequisition,
    creatingRequisition,
    updateJobRequisition,
    updatingRequisition,
    changeJobRequisitionStatus,
    changingRequisitionStatus,
    createRecruitmentApplication,
    creatingApplication,
    updateRecruitmentApplication,
    updatingApplication,
    advanceRecruitmentApplication,
    advancingApplication,
  }
}
