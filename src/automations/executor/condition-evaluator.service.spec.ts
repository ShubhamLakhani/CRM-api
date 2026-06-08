import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { ConditionOperator } from '../dto/conditions.validator';

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionEvaluatorService],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    const context = {
      contact: {
        name: 'Sarah Connor',
        email: 'sarah@connor.com',
        status: 'LEAD',
      },
      deal: {
        title: 'Solar Deal',
        value: 1500,
        stage: 'PROPOSAL',
      },
      task: {
        title: 'Follow Up',
        status: 'TODO',
      },
    };

    it('should pass if conditions are empty, null, or undefined', () => {
      expect(service.evaluate(null, context).passed).toBe(true);
      expect(service.evaluate(undefined, context).passed).toBe(true);
      expect(service.evaluate([], context).passed).toBe(true);
    });

    it('should evaluate EQUALS operator correctly', () => {
      const passedRule = [
        { field: 'contact.name', operator: ConditionOperator.EQUALS, value: 'Sarah Connor' },
      ];
      const failedRule = [
        { field: 'contact.name', operator: ConditionOperator.EQUALS, value: 'John Connor' },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate EQUALS operator case-insensitively for strings', () => {
      const passedRule = [
        { field: 'contact.email', operator: ConditionOperator.EQUALS, value: 'SARAH@CONNOR.com' },
      ];
      expect(service.evaluate(passedRule, context).passed).toBe(true);
    });

    it('should evaluate NOT_EQUALS operator correctly', () => {
      const passedRule = [
        { field: 'contact.status', operator: ConditionOperator.NOT_EQUALS, value: 'CUSTOMER' },
      ];
      const failedRule = [
        { field: 'contact.status', operator: ConditionOperator.NOT_EQUALS, value: 'LEAD' },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate CONTAINS operator correctly', () => {
      const passedRule = [
        { field: 'contact.name', operator: ConditionOperator.CONTAINS, value: 'Sarah' },
      ];
      const failedRule = [
        { field: 'contact.name', operator: ConditionOperator.CONTAINS, value: 'John' },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate GREATER_THAN operator correctly for numbers', () => {
      const passedRule = [
        { field: 'deal.value', operator: ConditionOperator.GREATER_THAN, value: 1000 },
      ];
      const failedRule = [
        { field: 'deal.value', operator: ConditionOperator.GREATER_THAN, value: 2000 },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate LESS_THAN operator correctly for numbers', () => {
      const passedRule = [
        { field: 'deal.value', operator: ConditionOperator.LESS_THAN, value: 2000 },
      ];
      const failedRule = [
        { field: 'deal.value', operator: ConditionOperator.LESS_THAN, value: 1000 },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate IS_EMPTY operator correctly', () => {
      const emptyContext = { contact: { name: '' } };
      const passedRule = [
        { field: 'contact.name', operator: ConditionOperator.IS_EMPTY },
      ];
      const failedRule = [
        { field: 'contact.name', operator: ConditionOperator.IS_EMPTY },
      ];

      expect(service.evaluate(passedRule, emptyContext).passed).toBe(true);
      expect(service.evaluate(failedRule, context).passed).toBe(false);
    });

    it('should evaluate IS_NOT_EMPTY operator correctly', () => {
      const emptyContext = { contact: { name: null } };
      const passedRule = [
        { field: 'contact.name', operator: ConditionOperator.IS_NOT_EMPTY },
      ];
      const failedRule = [
        { field: 'contact.name', operator: ConditionOperator.IS_NOT_EMPTY },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      expect(service.evaluate(failedRule, emptyContext).passed).toBe(false);
    });

    it('should enforce logical AND across multiple conditions', () => {
      const passedRule = [
        { field: 'contact.name', operator: ConditionOperator.EQUALS, value: 'Sarah Connor' },
        { field: 'deal.value', operator: ConditionOperator.GREATER_THAN, value: 1000 },
        { field: 'task.status', operator: ConditionOperator.EQUALS, value: 'TODO' },
      ];

      const failedRule = [
        { field: 'contact.name', operator: ConditionOperator.EQUALS, value: 'Sarah Connor' },
        { field: 'deal.value', operator: ConditionOperator.GREATER_THAN, value: 2000 }, // Fails
        { field: 'task.status', operator: ConditionOperator.EQUALS, value: 'TODO' },
      ];

      expect(service.evaluate(passedRule, context).passed).toBe(true);
      const res = service.evaluate(failedRule, context);
      expect(res.passed).toBe(false);
      expect(res.reason).toContain('Condition failed: [deal.value]');
    });
  });
});
