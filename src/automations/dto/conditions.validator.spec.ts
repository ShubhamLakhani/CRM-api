import { validate } from 'class-validator';
import { CreateAutomationRuleDto, CreateAutomationActionDto, ActionConfigDto } from './create-automation-rule.dto';
import { AutomationTrigger, AutomationActionType } from '@prisma/client';
import { ConditionOperator } from './conditions.validator';

describe('IsAutomationConditions Validator', () => {
  let dto: CreateAutomationRuleDto;

  beforeEach(() => {
    dto = new CreateAutomationRuleDto();
    dto.name = 'Test Rule';
    dto.triggerEvent = AutomationTrigger.CONTACT_CREATED;
    dto.isEnabled = true;

    const action = new CreateAutomationActionDto();
    action.actionType = AutomationActionType.SEND_NOTIFICATION;
    
    const config = new ActionConfigDto();
    config.message = 'hello';
    action.configurationJson = config;

    dto.actions = [action];
  });

  it('should pass validation with valid conditions', async () => {
    dto.conditionsJson = [
      { field: 'contact.name', operator: ConditionOperator.EQUALS, value: 'Sarah' },
      { field: 'deal.value', operator: ConditionOperator.GREATER_THAN, value: 5000 },
      { field: 'task.status', operator: ConditionOperator.IS_EMPTY },
    ];

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass validation with null, undefined, or empty object conditions', async () => {
    dto.conditionsJson = null;
    let errors = await validate(dto);
    expect(errors.length).toBe(0);

    dto.conditionsJson = undefined;
    errors = await validate(dto);
    expect(errors.length).toBe(0);

    dto.conditionsJson = {};
    errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid condition fields', async () => {
    dto.conditionsJson = [
      { field: 'invalid.field', operator: ConditionOperator.EQUALS, value: 'Sarah' },
    ];

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('conditionsJson');
  });

  it('should fail validation with invalid operators', async () => {
    dto.conditionsJson = [
      { field: 'contact.name', operator: 'INVALID_OP', value: 'Sarah' },
    ];

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('conditionsJson');
  });

  it('should fail validation when value is missing for comparison operators', async () => {
    dto.conditionsJson = [
      { field: 'contact.name', operator: ConditionOperator.EQUALS },
    ];

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('conditionsJson');
  });
});
