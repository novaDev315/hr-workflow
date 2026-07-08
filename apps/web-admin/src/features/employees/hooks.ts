import { useMutation, useQuery } from '@apollo/client'

import {
  CREATE_DEPARTMENT_MUTATION,
  CREATE_DESIGNATION_MUTATION,
  CREATE_EMPLOYEE_ACCOUNT_MUTATION,
  CREATE_EMPLOYEE_MUTATION,
  DEACTIVATE_DEPARTMENT_MUTATION,
  DEACTIVATE_DESIGNATION_MUTATION,
  DEACTIVATE_EMPLOYEE_MUTATION,
  EMPLOYEE_PAGE_QUERY,
  PROVISION_STAFF_ACCESS_MUTATION,
  UPDATE_DEPARTMENT_MUTATION,
  UPDATE_DESIGNATION_MUTATION,
  UPDATE_EMPLOYEE_MUTATION,
} from './graphql'

export function useEmployeeWorkspaceGraphql(search: string) {
  const trimmedSearch = search.trim()

  const { data, loading, error, refetch } = useQuery(EMPLOYEE_PAGE_QUERY, {
    variables: {
      filter: trimmedSearch
        ? {
            search: trimmedSearch,
          }
        : null,
    },
  })

  const [createDepartment, { loading: creatingDepartment }] = useMutation(
    CREATE_DEPARTMENT_MUTATION
  )
  const [updateDepartment, { loading: updatingDepartment }] = useMutation(
    UPDATE_DEPARTMENT_MUTATION
  )
  const [deactivateDepartment, { loading: deactivatingDepartment }] = useMutation(
    DEACTIVATE_DEPARTMENT_MUTATION
  )
  const [createDesignation, { loading: creatingDesignation }] = useMutation(
    CREATE_DESIGNATION_MUTATION
  )
  const [updateDesignation, { loading: updatingDesignation }] = useMutation(
    UPDATE_DESIGNATION_MUTATION
  )
  const [deactivateDesignation, { loading: deactivatingDesignation }] = useMutation(
    DEACTIVATE_DESIGNATION_MUTATION
  )
  const [createEmployee, { loading: creatingEmployee }] = useMutation(
    CREATE_EMPLOYEE_MUTATION
  )
  const [updateEmployee, { loading: updatingEmployee }] = useMutation(
    UPDATE_EMPLOYEE_MUTATION
  )
  const [deactivateEmployee, { loading: deactivatingEmployee }] = useMutation(
    DEACTIVATE_EMPLOYEE_MUTATION
  )
  const [createEmployeeAccount, { loading: creatingEmployeeAccount }] = useMutation(
    CREATE_EMPLOYEE_ACCOUNT_MUTATION
  )
  const [provisionStaffAccess, { loading: provisioningStaffAccess }] = useMutation(
    PROVISION_STAFF_ACCESS_MUTATION
  )

  return {
    data,
    loading,
    error,
    refetch,
    createDepartment,
    creatingDepartment,
    updateDepartment,
    updatingDepartment,
    deactivateDepartment,
    deactivatingDepartment,
    createDesignation,
    creatingDesignation,
    updateDesignation,
    updatingDesignation,
    deactivateDesignation,
    deactivatingDesignation,
    createEmployee,
    creatingEmployee,
    updateEmployee,
    updatingEmployee,
    deactivateEmployee,
    deactivatingEmployee,
    createEmployeeAccount,
    creatingEmployeeAccount,
    provisionStaffAccess,
    provisioningStaffAccess,
  }
}
