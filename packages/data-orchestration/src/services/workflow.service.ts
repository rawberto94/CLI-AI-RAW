import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus } from "../events/event-bus";
import pino from "pino";
import type { ServiceResponse } from "./contract.service";

const logger = pino({ name: "workflow-service" });

export interface WorkflowStep {
  id: string;
  name: string;
  type: "worker" | "service" | "condition" | "parallel" | "sequential";
  config: {
    worker?: string;
    service?: string;
    method?: string;
    timeout?: number;
    retries?: number;
    condition?: string;
    steps?: WorkflowStep[];
  };
  dependsOn?: string[];
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface Workflow {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  context: Record<string, any>;
  metadata: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    progress: number;
    estimatedDuration?: number;
    actualDuration?: number;
  };
}

export class WorkflowService {
  private static instance: WorkflowService;
  private activeWorkflows = new Map<string, Workflow>();
  private workflowTemplates = new Map<string, Partial<Workflow>>();

  private constructor() {
    this.initializeTemplates();
  }

  static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  private initializeTemplates(): void {
    // Contract Processing Workflow Template
    this.workflowTemplates.set("contract_processing", {
      name: "Contract Processing Pipeline",
      description: "Complete contract analysis and intelligence generation",
      steps: [
        {
          id: "ingestion",
          name: "Document Ingestion",
          type: "worker",
          config: {
            worker: "ingestion",
            timeout: 30000,
            retries: 3,
          },
          status: "pending",
        },
        {
          id: "parallel_analysis",
          name: "Parallel Analysis",
          type: "parallel",
          config: {
            steps: [
              {
                id: "financial",
                name: "Financial Analysis",
                type: "worker",
                config: { worker: "financial", timeout: 60000, retries: 2 },
                status: "pending",
              },
              {
                id: "risk",
                name: "Risk Analysis",
                type: "worker",
                config: { worker: "risk", timeout: 45000, retries: 2 },
                status: "pending",
              },
              {
                id: "compliance",
                name: "Compliance Check",
                type: "worker",
                config: { worker: "compliance", timeout: 45000, retries: 2 },
                status: "pending",
              },
              {
                id: "clauses",
                name: "Clause Extraction",
                type: "worker",
                config: { worker: "clauses", timeout: 60000, retries: 2 },
                status: "pending",
              },
            ],
          },
          dependsOn: ["ingestion"],
          status: "pending",
        },
        {
          id: "intelligence",
          name: "Intelligence Generation",
          type: "service",
          config: {
            service: "intelligence",
            method: "generateInsights",
            timeout: 30000,
            retries: 1,
          },
          dependsOn: ["parallel_analysis"],
          status: "pending",
        },
        {
          id: "notification",
          name: "Completion Notification",
          type: "service",
          config: {
            service: "notification",
            method: "notifyCompletion",
            timeout: 10000,
            retries: 2,
          },
          dependsOn: ["intelligence"],
          status: "pending",
        },
      ],
    });
  }

  /**
   * Create and start a new workflow
   */
  async createWorkflow(
    tenantId: string,
    type: string,
    context: Record<string, any>,
    priority: number = 5
  ): Promise<ServiceResponse<Workflow>> {
    try {
      const template = this.workflowTemplates.get(type);
      if (!template) {
        return {
          success: false,
          error: {
            code: "TEMPLATE_NOT_FOUND",
            message: `Workflow template '${type}' not found`,
          },
        };
      }

      const workflow: Workflow = {
        id: `workflow_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenantId,
        type,
        name: template.name || type,
        description: template.description,
        steps: JSON.parse(JSON.stringify(template.steps || [])), // Deep clone
        status: "pending",
        priority,
        createdAt: new Date(),
        context,
        metadata: {
          totalSteps: this.countTotalSteps(template.steps || []),
          completedSteps: 0,
          failedSteps: 0,
          progress: 0,
        },
      };

      // Store workflow
      this.activeWorkflows.set(workflow.id, workflow);
      await cacheAdaptor.set(`workflow:${workflow.id}`, workflow, 3600);

      // Start execution
      await this.executeWorkflow(workflow.id);

      logger.info(
        { workflowId: workflow.id, type, tenantId },
        "Workflow created and started"
      );

      return {
        success: true,
        data: workflow,
      };
    } catch (error) {
      logger.error({ error, tenantId, type }, "Failed to create workflow");
      return {
        success: false,
        error: {
          code: "WORKFLOW_CREATION_FAILED",
          message: "Failed to create workflow",
          details: error,
        },
      };
    }
  }

  /**
   * Get workflow status and progress
   */
  async getWorkflow(workflowId: string): Promise<ServiceResponse<Workflow>> {
    try {
      let workflow = this.activeWorkflows.get(workflowId);

      if (!workflow) {
        workflow =
          (await cacheAdaptor.get<Workflow>(`workflow:${workflowId}`)) ||
          undefined;
      }

      if (!workflow) {
        return {
          success: false,
          error: {
            code: "WORKFLOW_NOT_FOUND",
            message: "Workflow not found",
          },
        };
      }

      return {
        success: true,
        data: workflow,
      };
    } catch (error) {
      logger.error({ error, workflowId }, "Failed to get workflow");
      return {
        success: false,
        error: {
          code: "WORKFLOW_GET_FAILED",
          message: "Failed to get workflow",
          details: error,
        },
      };
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<ServiceResponse<void>> {
    try {
      const workflow = this.activeWorkflows.get(workflowId);
      if (!workflow) {
        return {
          success: false,
          error: {
            code: "WORKFLOW_NOT_FOUND",
            message: "Workflow not found",
          },
        };
      }

      workflow.status = "cancelled";
      workflow.completedAt = new Date();

      // Update cache
      await cacheAdaptor.set(`workflow:${workflowId}`, workflow, 3600);

      // Emit cancellation event
      await eventBus.publish("workflow.cancelled", {
        workflowId,
        tenantId: workflow.tenantId,
      });

      logger.info({ workflowId }, "Workflow cancelled");

      return { success: true };
    } catch (error) {
      logger.error({ error, workflowId }, "Failed to cancel workflow");
      return {
        success: false,
        error: {
          code: "WORKFLOW_CANCEL_FAILED",
          message: "Failed to cancel workflow",
          details: error,
        },
      };
    }
  }

  /**
   * Execute workflow steps
   */
  private async executeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    try {
      workflow.status = "running";
      workflow.startedAt = new Date();

      // Emit workflow started event
      await eventBus.publish("workflow.started", {
        workflowId,
        tenantId: workflow.tenantId,
        type: workflow.type,
      });

      // Execute steps in dependency order
      await this.executeSteps(workflow, workflow.steps);

      // Check final status
      const allCompleted = workflow.steps.every(
        (step) => step.status === "completed" || step.status === "skipped"
      );
      const anyFailed = workflow.steps.some((step) => step.status === "failed");

      workflow.status = anyFailed
        ? "failed"
        : allCompleted
        ? "completed"
        : "running";
      workflow.completedAt = new Date();
      workflow.metadata.actualDuration =
        workflow.completedAt.getTime() - workflow.startedAt!.getTime();

      // Update progress
      this.updateWorkflowProgress(workflow);

      // Emit completion event
      await eventBus.publish(
        workflow.status === "completed"
          ? "workflow.completed"
          : "workflow.failed",
        {
          workflowId,
          tenantId: workflow.tenantId,
          status: workflow.status,
          duration: workflow.metadata.actualDuration,
        }
      );

      logger.info(
        {
          workflowId,
          status: workflow.status,
          duration: workflow.metadata.actualDuration,
        },
        "Workflow execution completed"
      );
    } catch (error) {
      workflow.status = "failed";
      workflow.completedAt = new Date();

      logger.error({ error, workflowId }, "Workflow execution failed");

      await eventBus.publish("workflow.failed", {
        workflowId,
        tenantId: workflow.tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      // Update cache
      await cacheAdaptor.set(`workflow:${workflowId}`, workflow, 3600);
    }
  }

  /**
   * Execute workflow steps respecting dependencies
   */
  private async executeSteps(
    workflow: Workflow,
    steps: WorkflowStep[]
  ): Promise<void> {
    const executedSteps = new Set<string>();
    const maxIterations = steps.length * 2; // Prevent infinite loops
    let iterations = 0;

    while (executedSteps.size < steps.length && iterations < maxIterations) {
      iterations++;
      let progressMade = false;

      for (const step of steps) {
        if (executedSteps.has(step.id) || step.status !== "pending") {
          continue;
        }

        // Check if dependencies are satisfied
        const dependenciesMet =
          !step.dependsOn ||
          step.dependsOn.every((depId) => {
            const depStep = this.findStepById(steps, depId);
            return (
              depStep &&
              (depStep.status === "completed" || depStep.status === "skipped")
            );
          });

        if (dependenciesMet) {
          await this.executeStep(workflow, step);
          executedSteps.add(step.id);
          progressMade = true;

          // Update workflow progress
          this.updateWorkflowProgress(workflow);
        }
      }

      if (!progressMade) {
        // No progress made, check for circular dependencies or failed dependencies
        const pendingSteps = steps.filter((s) => s.status === "pending");
        if (pendingSteps.length > 0) {
          logger.warn(
            {
              workflowId: workflow.id,
              pendingSteps: pendingSteps.map((s) => s.id),
            },
            "Workflow stuck - possible circular dependencies"
          );
          break;
        }
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    step.status = "running";
    step.startedAt = new Date();

    try {
      logger.debug(
        { workflowId: workflow.id, stepId: step.id, type: step.type },
        "Executing step"
      );

      switch (step.type) {
        case "worker":
          await this.executeWorkerStep(workflow, step);
          break;
        case "service":
          await this.executeServiceStep(workflow, step);
          break;
        case "parallel":
          await this.executeParallelStep(workflow, step);
          break;
        case "sequential":
          await this.executeSequentialStep(workflow, step);
          break;
        case "condition":
          await this.executeConditionStep(workflow, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      step.status = "completed";
      step.completedAt = new Date();
      workflow.metadata.completedSteps++;

      logger.debug(
        {
          workflowId: workflow.id,
          stepId: step.id,
          duration: step.completedAt.getTime() - step.startedAt!.getTime(),
        },
        "Step completed"
      );
    } catch (error) {
      step.status = "failed";
      step.completedAt = new Date();
      step.error = error instanceof Error ? error.message : "Unknown error";
      workflow.metadata.failedSteps++;

      logger.error(
        {
          error,
          workflowId: workflow.id,
          stepId: step.id,
        },
        "Step failed"
      );

      // Retry logic
      const retries = step.config.retries || 0;
      if (retries > 0) {
        step.config.retries = retries - 1;
        step.status = "pending";
        workflow.metadata.failedSteps--;

        logger.info(
          {
            workflowId: workflow.id,
            stepId: step.id,
            retriesLeft: step.config.retries,
          },
          "Retrying step"
        );
      }
    }
  }

  private async executeWorkerStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    // Simulate worker execution - in real implementation, this would:
    // 1. Queue the job in BullMQ
    // 2. Wait for completion or timeout
    // 3. Return the result

    const workerName = step.config.worker;
    const timeout = step.config.timeout || 60000;

    // Emit worker job event
    await eventBus.publish("workflow.worker.started", {
      workflowId: workflow.id,
      stepId: step.id,
      worker: workerName,
      context: workflow.context,
    });

    // Simulate processing time
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 1000 + 500)
    );

    // Simulate success/failure (90% success rate)
    if (Math.random() < 0.9) {
      step.result = { success: true, data: `${workerName} completed` };
    } else {
      throw new Error(`${workerName} worker failed`);
    }
  }

  private async executeServiceStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    const serviceName = step.config.service;
    const methodName = step.config.method;

    // In real implementation, this would call the actual service method
    logger.debug({ serviceName, methodName }, "Executing service step");

    // Simulate service call
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 500 + 200)
    );

    step.result = {
      success: true,
      data: `${serviceName}.${methodName} completed`,
    };
  }

  private async executeParallelStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    const subSteps = step.config.steps || [];

    // Execute all sub-steps in parallel
    const promises = subSteps.map((subStep) =>
      this.executeStep(workflow, subStep)
    );
    await Promise.allSettled(promises);

    // Check if all sub-steps completed successfully
    const allSuccessful = subSteps.every((s) => s.status === "completed");
    if (!allSuccessful) {
      const failedSteps = subSteps.filter((s) => s.status === "failed");
      throw new Error(
        `Parallel execution failed: ${failedSteps.map((s) => s.id).join(", ")}`
      );
    }

    step.result = {
      success: true,
      subResults: subSteps.map((s) => ({ id: s.id, result: s.result })),
    };
  }

  private async executeSequentialStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    const subSteps = step.config.steps || [];

    // Execute sub-steps sequentially
    for (const subStep of subSteps) {
      await this.executeStep(workflow, subStep);
      if (subStep.status === "failed") {
        throw new Error(`Sequential step failed: ${subStep.id}`);
      }
    }

    step.result = {
      success: true,
      subResults: subSteps.map((s) => ({ id: s.id, result: s.result })),
    };
  }

  private async executeConditionStep(
    workflow: Workflow,
    step: WorkflowStep
  ): Promise<void> {
    const condition = step.config.condition;

    // Simple condition evaluation - in real implementation, this would be more sophisticated
    const conditionMet = this.evaluateCondition(condition, workflow.context);

    if (conditionMet) {
      step.result = { success: true, conditionMet: true };
    } else {
      step.status = "skipped";
      step.result = { success: true, conditionMet: false, skipped: true };
    }
  }

  private evaluateCondition(
    condition: string | undefined,
    context: Record<string, any>
  ): boolean {
    if (!condition) return true;

    // Simple condition evaluation - could be enhanced with a proper expression parser
    try {
      // Replace context variables in condition
      let evaluatedCondition = condition;
      Object.entries(context).forEach(([key, value]) => {
        evaluatedCondition = evaluatedCondition.replace(
          new RegExp(`\\$\\{${key}\\}`, "g"),
          JSON.stringify(value)
        );
      });

      // Evaluate simple conditions like "${status} === 'COMPLETED'"
      return eval(evaluatedCondition);
    } catch (error) {
      logger.warn(
        { condition, error },
        "Failed to evaluate condition, defaulting to true"
      );
      return true;
    }
  }

  private findStepById(
    steps: WorkflowStep[],
    stepId: string
  ): WorkflowStep | undefined {
    for (const step of steps) {
      if (step.id === stepId) return step;
      if (step.config.steps) {
        const found = this.findStepById(step.config.steps, stepId);
        if (found) return found;
      }
    }
    return undefined;
  }

  private countTotalSteps(steps: WorkflowStep[]): number {
    return steps.reduce((count, step) => {
      if (step.config.steps) {
        return count + 1 + this.countTotalSteps(step.config.steps);
      }
      return count + 1;
    }, 0);
  }

  private updateWorkflowProgress(workflow: Workflow): void {
    const totalSteps = workflow.metadata.totalSteps;
    const completedSteps = workflow.metadata.completedSteps;
    workflow.metadata.progress =
      totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  /**
   * Get workflows for a tenant
   */
  async getTenantWorkflows(
    tenantId: string,
    status?: string
  ): Promise<ServiceResponse<Workflow[]>> {
    try {
      const workflows = Array.from(this.activeWorkflows.values())
        .filter((w) => w.tenantId === tenantId)
        .filter((w) => !status || w.status === status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        success: true,
        data: workflows,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get tenant workflows");
      return {
        success: false,
        error: {
          code: "GET_WORKFLOWS_FAILED",
          message: "Failed to get workflows",
          details: error,
        },
      };
    }
  }

  /**
   * Create a contract processing workflow
   */
  async createContractProcessingWorkflow(
    contractId: string,
    tenantId: string
  ): Promise<ServiceResponse<Workflow>> {
    return this.createWorkflow(
      tenantId,
      "contract_processing",
      {
        contractId,
        tenantId,
      },
      5
    );
  }
}

export const workflowService = WorkflowService.getInstance();
