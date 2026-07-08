import type { Dispatch, FormEventHandler, SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import type {
  ApplicationFormState,
  Department,
  Designation,
  JobRequisition,
  RequisitionFormState,
} from './types'

const ANY_DESIGNATION_VALUE = 'ANY_DESIGNATION'

export function RequisitionFormDrawer({
  closeRequisitionForm,
  creatingRequisition,
  departments,
  editingRequisitionId,
  filteredDesignations,
  handleSaveRequisition,
  open,
  requisitionForm,
  setRequisitionForm,
  setShowRequisitionForm,
  updatingRequisition,
}: {
  closeRequisitionForm: () => void
  creatingRequisition: boolean
  departments: Department[]
  editingRequisitionId: string | null
  filteredDesignations: Designation[]
  handleSaveRequisition: FormEventHandler<HTMLFormElement>
  open: boolean
  requisitionForm: RequisitionFormState
  setRequisitionForm: Dispatch<SetStateAction<RequisitionFormState>>
  setShowRequisitionForm: Dispatch<SetStateAction<boolean>>
  updatingRequisition: boolean
}) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={(drawerOpen) => {
        if (drawerOpen) {
          setShowRequisitionForm(true)
        } else {
          closeRequisitionForm()
        }
      }}
      kicker="Opening"
      title={editingRequisitionId ? 'Edit requisition' : 'Create requisition'}
      description="Keep the hiring list in view while you add or update the role details."
    >
      <form className="space-y-4" onSubmit={handleSaveRequisition}>
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <Label htmlFor="requisition-title">Job title</Label>
            <Input
              id="requisition-title"
              required
              value={requisitionForm.jobTitle}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  jobTitle: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="requisition-department">Department</Label>
            <Select
              name="requisition-department"
              value={requisitionForm.departmentId}
              onValueChange={(departmentId) =>
                setRequisitionForm((current) => ({
                  ...current,
                  departmentId,
                  designationId: '',
                }))
              }
              required
            >
              <SelectTrigger id="requisition-department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="requisition-designation">Designation</Label>
            <Select
              name="requisition-designation"
              value={requisitionForm.designationId || ANY_DESIGNATION_VALUE}
              onValueChange={(designationId) =>
                setRequisitionForm((current) => ({
                  ...current,
                  designationId:
                    designationId === ANY_DESIGNATION_VALUE ? '' : designationId,
                }))
              }
            >
              <SelectTrigger id="requisition-designation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_DESIGNATION_VALUE}>Any designation</SelectItem>
                {filteredDesignations.map((designation) => (
                  <SelectItem key={designation.id} value={designation.id}>
                    {designation.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="requisition-positions">Positions</Label>
            <Input
              id="requisition-positions"
              min="1"
              required
              type="number"
              value={requisitionForm.positionsCount}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  positionsCount: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="requisition-employment-type">Employment type</Label>
            <Select
              name="requisition-employment-type"
              value={requisitionForm.employmentType}
              onValueChange={(employmentType) =>
                setRequisitionForm((current) => ({
                  ...current,
                  employmentType,
                }))
              }
            >
              <SelectTrigger id="requisition-employment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full time</SelectItem>
                <SelectItem value="PART_TIME">Part time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="INTERNSHIP">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="requisition-priority">Priority</Label>
            <Select
              name="requisition-priority"
              value={requisitionForm.priority}
              onValueChange={(priority) =>
                setRequisitionForm((current) => ({
                  ...current,
                  priority,
                }))
              }
            >
              <SelectTrigger id="requisition-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="requisition-target-start">Target start</Label>
            <Input
              id="requisition-target-start"
              type="date"
              value={requisitionForm.targetStartDate}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  targetStartDate: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="requisition-salary-min">Salary min</Label>
            <Input
              id="requisition-salary-min"
              min="0"
              type="number"
              value={requisitionForm.salaryMin}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  salaryMin: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="requisition-salary-max">Salary max</Label>
            <Input
              id="requisition-salary-max"
              min="0"
              type="number"
              value={requisitionForm.salaryMax}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  salaryMax: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <Label htmlFor="requisition-description">Description</Label>
            <Textarea
              id="requisition-description"
              required
              className="min-h-[110px]"
              value={requisitionForm.description}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="requisition-requirements">Requirements</Label>
            <Textarea
              id="requisition-requirements"
              className="min-h-[110px]"
              value={requisitionForm.requirements}
              onChange={(event) =>
                setRequisitionForm((current) => ({
                  ...current,
                  requirements: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={creatingRequisition || updatingRequisition}>
            {editingRequisitionId ? 'Update Requisition' : 'Create Requisition'}
          </Button>
          <Button type="button" variant="outline" onClick={closeRequisitionForm}>
            Cancel
          </Button>
        </div>
      </form>
    </FormDrawer>
  )
}

export function ApplicationFormDrawer({
  applicationForm,
  closeApplicationForm,
  creatingApplication,
  editingApplicationId,
  handleSaveApplication,
  open,
  openRequisitions,
  setApplicationForm,
  setShowApplicationForm,
  updatingApplication,
}: {
  applicationForm: ApplicationFormState
  closeApplicationForm: () => void
  creatingApplication: boolean
  editingApplicationId: string | null
  handleSaveApplication: FormEventHandler<HTMLFormElement>
  open: boolean
  openRequisitions: JobRequisition[]
  setApplicationForm: Dispatch<SetStateAction<ApplicationFormState>>
  setShowApplicationForm: Dispatch<SetStateAction<boolean>>
  updatingApplication: boolean
}) {
  return (
    <FormDrawer
      open={open}
      onOpenChange={(drawerOpen) => {
        if (drawerOpen) {
          setShowApplicationForm(true)
        } else {
          closeApplicationForm()
        }
      }}
      kicker="Candidate"
      title={editingApplicationId ? 'Edit application' : 'Add candidate'}
      description="Capture the candidate without leaving the recruitment workflow."
    >
      <form className="space-y-4" onSubmit={handleSaveApplication}>
        <div className="grid gap-3 lg:grid-cols-3">
          <div>
            <Label htmlFor="application-requisition">Requisition</Label>
            <Select
              name="application-requisition"
              value={applicationForm.requisitionId}
              onValueChange={(requisitionId) =>
                setApplicationForm((current) => ({
                  ...current,
                  requisitionId,
                }))
              }
              required
            >
              <SelectTrigger id="application-requisition">
                <SelectValue placeholder="Select requisition" />
              </SelectTrigger>
              <SelectContent>
                {openRequisitions.map((requisition) => (
                  <SelectItem key={requisition.id} value={requisition.id}>
                    {requisition.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="candidate-first-name">First name</Label>
            <Input
              id="candidate-first-name"
              required
              value={applicationForm.firstName}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-last-name">Last name</Label>
            <Input
              id="candidate-last-name"
              required
              value={applicationForm.lastName}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-email">Email</Label>
            <Input
              id="candidate-email"
              required
              type="email"
              value={applicationForm.email}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-phone">Phone</Label>
            <Input
              id="candidate-phone"
              value={applicationForm.phone}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-source">Source</Label>
            <Input
              id="candidate-source"
              value={applicationForm.source}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-experience">Years experience</Label>
            <Input
              id="candidate-experience"
              min="0"
              step="0.5"
              type="number"
              value={applicationForm.yearsExperience}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  yearsExperience: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-expected-salary">Expected salary</Label>
            <Input
              id="candidate-expected-salary"
              min="0"
              type="number"
              value={applicationForm.expectedSalary}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  expectedSalary: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="candidate-resume-url">Resume URL</Label>
            <Input
              id="candidate-resume-url"
              value={applicationForm.resumeUrl}
              onChange={(event) =>
                setApplicationForm((current) => ({
                  ...current,
                  resumeUrl: event.target.value,
                }))
              }
            />
          </div>
        </div>
        <div>
          <Label htmlFor="candidate-notes">Notes</Label>
          <Textarea
            id="candidate-notes"
            className="min-h-[100px]"
            value={applicationForm.notes}
            onChange={(event) =>
              setApplicationForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={creatingApplication || updatingApplication}>
            {editingApplicationId ? 'Update Candidate' : 'Add Candidate'}
          </Button>
          <Button type="button" variant="outline" onClick={closeApplicationForm}>
            Cancel
          </Button>
        </div>
      </form>
    </FormDrawer>
  )
}
