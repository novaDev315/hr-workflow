import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnboardingStatus, OffboardingStatus, TaskStatus, ExitType, ClearanceStatus, ReturnStatus } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ==================== ONBOARDING TEMPLATES ====================

  async createOnboardingTemplate(data: {
    name: string;
    description?: string;
    departmentId?: string;
    designationLevel?: number;
    tasks: Array<{
      title: string;
      description?: string;
      category: string;
      assigneeType: string;
      dueInDays: number;
      isRequired?: boolean;
      orderIndex?: number;
      requiresDocument?: boolean;
      documentType?: string;
    }>;
  }) {
    const template = await this.prisma.onboardingTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        designationLevel: data.designationLevel,
        tasks: {
          create: data.tasks.map((task, index) => ({
            title: task.title,
            description: task.description,
            category: task.category as any,
            assigneeType: task.assigneeType as any,
            dueInDays: task.dueInDays,
            isRequired: task.isRequired ?? true,
            orderIndex: task.orderIndex ?? index,
            requiresDocument: task.requiresDocument ?? false,
            documentType: task.documentType as any,
          })),
        },
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });

    this.eventEmitter.emit('onboarding.template.created', template);
    return template;
  }

  async getOnboardingTemplates(departmentId?: string) {
    return this.prisma.onboardingTemplate.findMany({
      where: {
        isActive: true,
        ...(departmentId && {
          OR: [
            { departmentId },
            { departmentId: null },
          ],
        }),
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  // ==================== ONBOARDING PROCESS ====================

  async initiateOnboarding(data: {
    employeeId: string;
    templateId: string;
    startDate?: Date;
    hrCoordinatorId?: string;
    buddyId?: string;
  }) {
    // Check if employee already has an onboarding process
    const existing = await this.prisma.onboardingProcess.findUnique({
      where: { employeeId: data.employeeId },
    });

    if (existing) {
      throw new BadRequestException('Employee already has an onboarding process');
    }

    // Get template with tasks
    const template = await this.prisma.onboardingTemplate.findUnique({
      where: { id: data.templateId },
      include: { tasks: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!template) {
      throw new NotFoundException('Onboarding template not found');
    }

    const startDate = data.startDate || new Date();
    const maxDueInDays = Math.max(...template.tasks.map(t => t.dueInDays), 30);
    const targetEndDate = new Date(startDate);
    targetEndDate.setDate(targetEndDate.getDate() + maxDueInDays);

    // Create process with tasks
    const process = await this.prisma.onboardingProcess.create({
      data: {
        employeeId: data.employeeId,
        templateId: data.templateId,
        startDate,
        targetEndDate,
        hrCoordinatorId: data.hrCoordinatorId,
        buddyId: data.buddyId,
        status: OnboardingStatus.IN_PROGRESS,
        tasks: {
          create: template.tasks.map(task => {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + task.dueInDays);
            return {
              title: task.title,
              description: task.description,
              category: task.category,
              assigneeType: task.assigneeType,
              dueDate,
              isRequired: task.isRequired,
              orderIndex: task.orderIndex,
            };
          }),
        },
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
        template: true,
      },
    });

    this.eventEmitter.emit('onboarding.initiated', process);
    return process;
  }

  async getOnboardingProcess(employeeId: string) {
    const process = await this.prisma.onboardingProcess.findUnique({
      where: { employeeId },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
        template: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Onboarding process not found');
    }

    return process;
  }

  async completeOnboardingTask(taskId: string, completedBy: string, data?: {
    notes?: string;
    documentUrl?: string;
  }) {
    const task = await this.prisma.onboardingTask.findUnique({
      where: { id: taskId },
      include: { process: true },
    });

    if (!task) {
      throw new NotFoundException('Onboarding task not found');
    }

    if (task.status === TaskStatus.COMPLETED) {
      throw new BadRequestException('Task is already completed');
    }

    // Update task
    const updatedTask = await this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy,
        notes: data?.notes,
        documentUrl: data?.documentUrl,
      },
    });

    // Update process progress
    await this.updateOnboardingProgress(task.processId);

    this.eventEmitter.emit('onboarding.task.completed', updatedTask);
    return updatedTask;
  }

  async updateOnboardingProgress(processId: string) {
    const process = await this.prisma.onboardingProcess.findUnique({
      where: { id: processId },
      include: { tasks: true },
    });

    if (!process) return;

    const totalTasks = process.tasks.filter(t => t.isRequired).length;
    const completedTasks = process.tasks.filter(
      t => t.isRequired && t.status === TaskStatus.COMPLETED
    ).length;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const allCompleted = progress === 100;

    await this.prisma.onboardingProcess.update({
      where: { id: processId },
      data: {
        progress,
        status: allCompleted ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
        actualEndDate: allCompleted ? new Date() : null,
      },
    });

    if (allCompleted) {
      this.eventEmitter.emit('onboarding.completed', { processId, employeeId: process.employeeId });
    }
  }

  async getOnboardingTasksByAssignee(assigneeId: string, assigneeType: string) {
    return this.prisma.onboardingTask.findMany({
      where: {
        OR: [
          { assigneeId },
          { assigneeType: assigneeType as any, assigneeId: null },
        ],
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
      },
      include: {
        process: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // ==================== OFFBOARDING TEMPLATES ====================

  async createOffboardingTemplate(data: {
    name: string;
    description?: string;
    exitType?: ExitType;
    tasks: Array<{
      title: string;
      description?: string;
      category: string;
      assigneeType: string;
      dueInDays: number;
      isRequired?: boolean;
      orderIndex?: number;
    }>;
  }) {
    const template = await this.prisma.offboardingTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        exitType: data.exitType,
        tasks: {
          create: data.tasks.map((task, index) => ({
            title: task.title,
            description: task.description,
            category: task.category as any,
            assigneeType: task.assigneeType as any,
            dueInDays: task.dueInDays,
            isRequired: task.isRequired ?? true,
            orderIndex: task.orderIndex ?? index,
          })),
        },
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });

    this.eventEmitter.emit('offboarding.template.created', template);
    return template;
  }

  async getOffboardingTemplates(exitType?: ExitType) {
    return this.prisma.offboardingTemplate.findMany({
      where: {
        isActive: true,
        ...(exitType && {
          OR: [
            { exitType },
            { exitType: null },
          ],
        }),
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  // ==================== OFFBOARDING PROCESS ====================

  async initiateOffboarding(data: {
    employeeId: string;
    templateId: string;
    exitType: ExitType;
    lastWorkingDate: Date;
    resignationDate?: Date;
    exitReason?: string;
    hrCoordinatorId?: string;
  }) {
    // Check if employee already has an offboarding process
    const existing = await this.prisma.offboardingProcess.findUnique({
      where: { employeeId: data.employeeId },
    });

    if (existing) {
      throw new BadRequestException('Employee already has an offboarding process');
    }

    // Get template with tasks
    const template = await this.prisma.offboardingTemplate.findUnique({
      where: { id: data.templateId },
      include: { tasks: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!template) {
      throw new NotFoundException('Offboarding template not found');
    }

    // Create process with tasks
    const process = await this.prisma.offboardingProcess.create({
      data: {
        employeeId: data.employeeId,
        templateId: data.templateId,
        exitType: data.exitType,
        lastWorkingDate: data.lastWorkingDate,
        resignationDate: data.resignationDate,
        exitReason: data.exitReason,
        hrCoordinatorId: data.hrCoordinatorId,
        status: OffboardingStatus.IN_PROGRESS,
        tasks: {
          create: template.tasks.map(task => {
            const dueDate = new Date(data.lastWorkingDate);
            dueDate.setDate(dueDate.getDate() + task.dueInDays);
            return {
              title: task.title,
              description: task.description,
              category: task.category,
              assigneeType: task.assigneeType,
              dueDate,
              isRequired: task.isRequired,
              orderIndex: task.orderIndex,
            };
          }),
        },
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
        template: true,
      },
    });

    this.eventEmitter.emit('offboarding.initiated', process);
    return process;
  }

  async getOffboardingProcess(employeeId: string) {
    const process = await this.prisma.offboardingProcess.findUnique({
      where: { employeeId },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
        template: true,
        assetReturns: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Offboarding process not found');
    }

    return process;
  }

  async completeOffboardingTask(taskId: string, completedBy: string, notes?: string) {
    const task = await this.prisma.offboardingTask.findUnique({
      where: { id: taskId },
      include: { process: true },
    });

    if (!task) {
      throw new NotFoundException('Offboarding task not found');
    }

    const updatedTask = await this.prisma.offboardingTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy,
        notes,
      },
    });

    // Update process progress
    await this.updateOffboardingProgress(task.processId);

    this.eventEmitter.emit('offboarding.task.completed', updatedTask);
    return updatedTask;
  }

  async updateOffboardingProgress(processId: string) {
    const process = await this.prisma.offboardingProcess.findUnique({
      where: { id: processId },
      include: { tasks: true, assetReturns: true },
    });

    if (!process) return;

    const totalTasks = process.tasks.filter(t => t.isRequired).length;
    const completedTasks = process.tasks.filter(
      t => t.isRequired && t.status === TaskStatus.COMPLETED
    ).length;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    await this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: { progress },
    });
  }

  // ==================== ASSET RETURNS ====================

  async addAssetReturn(processId: string, data: {
    assetType: string;
    assetName: string;
    assetId?: string;
    assignedDate?: Date;
  }) {
    const assetReturn = await this.prisma.assetReturn.create({
      data: {
        processId,
        assetType: data.assetType as any,
        assetName: data.assetName,
        assetId: data.assetId,
        assignedDate: data.assignedDate,
      },
    });

    return assetReturn;
  }

  async processAssetReturn(assetReturnId: string, data: {
    returnedTo: string;
    condition: string;
    notes?: string;
  }) {
    const assetReturn = await this.prisma.assetReturn.update({
      where: { id: assetReturnId },
      data: {
        returnedDate: new Date(),
        returnedTo: data.returnedTo,
        condition: data.condition as any,
        notes: data.notes,
        status: ReturnStatus.RETURNED,
      },
    });

    this.eventEmitter.emit('asset.returned', assetReturn);
    return assetReturn;
  }

  async markAssetLost(assetReturnId: string, notes: string) {
    return this.prisma.assetReturn.update({
      where: { id: assetReturnId },
      data: {
        status: ReturnStatus.LOST,
        notes,
      },
    });
  }

  // ==================== EXIT INTERVIEW ====================

  async scheduleExitInterview(processId: string, date: Date) {
    return this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: { exitInterviewDate: date },
    });
  }

  async recordExitInterview(processId: string, notes: string) {
    const process = await this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: { exitInterviewNotes: notes },
    });

    this.eventEmitter.emit('exit.interview.recorded', process);
    return process;
  }

  // ==================== CLEARANCE ====================

  async updateClearanceStatus(processId: string, status: ClearanceStatus) {
    const process = await this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: {
        clearanceStatus: status,
        status: status === ClearanceStatus.ALL_CLEARED
          ? OffboardingStatus.SETTLEMENT_PENDING
          : OffboardingStatus.CLEARANCE_PENDING,
      },
    });

    if (status === ClearanceStatus.ALL_CLEARED) {
      this.eventEmitter.emit('clearance.completed', process);
    }

    return process;
  }

  // ==================== FINAL SETTLEMENT ====================

  async calculateFinalSettlement(processId: string, amount: number) {
    return this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: {
        fullAndFinalAmount: amount,
        fullAndFinalStatus: 'PENDING_APPROVAL',
      },
    });
  }

  async approveFinalSettlement(processId: string) {
    return this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: {
        fullAndFinalStatus: 'APPROVED',
      },
    });
  }

  async markSettlementPaid(processId: string) {
    const process = await this.prisma.offboardingProcess.update({
      where: { id: processId },
      data: {
        fullAndFinalStatus: 'PAID',
        status: OffboardingStatus.COMPLETED,
      },
    });

    this.eventEmitter.emit('offboarding.completed', process);
    return process;
  }

  // ==================== DASHBOARD ====================

  async getOnboardingDashboard() {
    const [activeOnboardings, pendingTasks, completedThisMonth] = await Promise.all([
      this.prisma.onboardingProcess.count({
        where: { status: OnboardingStatus.IN_PROGRESS },
      }),
      this.prisma.onboardingTask.count({
        where: {
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          process: { status: OnboardingStatus.IN_PROGRESS },
        },
      }),
      this.prisma.onboardingProcess.count({
        where: {
          status: OnboardingStatus.COMPLETED,
          actualEndDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      activeOnboardings,
      pendingTasks,
      completedThisMonth,
    };
  }

  async getOffboardingDashboard() {
    const [activeOffboardings, pendingClearances, exitingThisMonth] = await Promise.all([
      this.prisma.offboardingProcess.count({
        where: {
          status: { in: [OffboardingStatus.IN_PROGRESS, OffboardingStatus.CLEARANCE_PENDING, OffboardingStatus.SETTLEMENT_PENDING] },
        },
      }),
      this.prisma.offboardingProcess.count({
        where: { clearanceStatus: { not: ClearanceStatus.ALL_CLEARED } },
      }),
      this.prisma.offboardingProcess.count({
        where: {
          lastWorkingDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lte: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
          },
        },
      }),
    ]);

    return {
      activeOffboardings,
      pendingClearances,
      exitingThisMonth,
    };
  }
}
