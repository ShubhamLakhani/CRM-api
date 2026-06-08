import { Injectable, Logger } from '@nestjs/common';
import { ConditionOperator } from '../dto/conditions.validator';

@Injectable()
export class ConditionEvaluatorService {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  evaluate(conditions: any[] | null | undefined, context: any): { passed: boolean; reason?: string } {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return { passed: true };
    }

    for (const condition of conditions) {
      if (typeof condition !== 'object' || condition === null) continue;
      const { field, operator, value } = condition;
      
      const contextValue = this.getValueByPath(context, field);
      const passed = this.compareValues(contextValue, operator, value);

      if (!passed) {
        return {
          passed: false,
          reason: `Condition failed: [${field}] ${operator} ${value !== undefined && value !== null ? value : ''} (actual: "${contextValue !== undefined && contextValue !== null ? contextValue : 'null'}")`,
        };
      }
    }

    return { passed: true };
  }

  private getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private compareValues(contextValue: any, operator: string, conditionValue: any): boolean {
    if (operator === ConditionOperator.IS_EMPTY) {
      return contextValue === undefined || contextValue === null || contextValue === '';
    }
    if (operator === ConditionOperator.IS_NOT_EMPTY) {
      return contextValue !== undefined && contextValue !== null && contextValue !== '';
    }

    // If we require comparison but context value is missing, it fails
    if (contextValue === undefined || contextValue === null) {
      return false;
    }

    let val1 = contextValue;
    let val2 = conditionValue;

    if (typeof contextValue === 'number') {
      val2 = Number(conditionValue);
    } else if (typeof contextValue === 'boolean') {
      val2 = conditionValue === 'true' || conditionValue === true;
    } else {
      val1 = String(contextValue).toLowerCase();
      val2 = String(conditionValue).toLowerCase();
    }

    switch (operator) {
      case ConditionOperator.EQUALS:
        return val1 === val2;
      case ConditionOperator.NOT_EQUALS:
        return val1 !== val2;
      case ConditionOperator.CONTAINS:
        return String(val1).includes(String(val2));
      case ConditionOperator.GREATER_THAN:
        return val1 > val2;
      case ConditionOperator.LESS_THAN:
        return val1 < val2;
      default:
        return false;
    }
  }
}
