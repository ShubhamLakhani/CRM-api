import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY',
}

export const ALLOWED_CONDITION_FIELDS = [
  'contact.name',
  'contact.email',
  'contact.status',
  'deal.title',
  'deal.value',
  'deal.stage',
  'task.title',
  'task.status',
] as const;

export type AllowedConditionField = typeof ALLOWED_CONDITION_FIELDS[number];

export function IsAutomationConditions(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAutomationConditions',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          // Accept empty object as empty conditions
          if (typeof value === 'object' && Object.keys(value).length === 0 && !Array.isArray(value)) return true;
          if (!Array.isArray(value)) return false;

          for (const item of value) {
            if (typeof item !== 'object' || item === null) return false;
            const { field, operator, value: val } = item;

            if (!ALLOWED_CONDITION_FIELDS.includes(field)) return false;
            if (!Object.values(ConditionOperator).includes(operator)) return false;

            // Value is optional only for IS_EMPTY and IS_NOT_EMPTY
            if (operator !== ConditionOperator.IS_EMPTY && operator !== ConditionOperator.IS_NOT_EMPTY) {
              if (val === undefined || val === null) return false;
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `conditionsJson must be null, empty object, or an array of valid conditions with fields: ${ALLOWED_CONDITION_FIELDS.join(', ')} and operators: ${Object.values(ConditionOperator).join(', ')}`;
        },
      },
    });
  };
}
