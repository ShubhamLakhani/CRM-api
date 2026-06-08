import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
});

jest.mock('nodemailer', () => ({
  createTransport: (...args: any[]) => mockCreateTransport(...args),
}));

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'smtpHost') return 'smtp.gmail.com';
        if (key === 'smtpPort') return 587;
        if (key === 'smtpUser') return 'test@gmail.com';
        if (key === 'smtpPassword') return 'password';
        if (key === 'mailFrom') return 'Apex CRM <noreply@apex.com>';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@gmail.com',
        pass: 'password',
      },
    });
  });

  it('should successfully send an email', async () => {
    mockSendMail.mockResolvedValue({ messageId: '123' });

    await expect(
      service.sendEmail({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        automationExecutionId: 'exec-123',
      }),
    ).resolves.not.toThrow();

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Apex CRM <noreply@apex.com>',
      to: 'recipient@test.com',
      subject: 'Test Subject',
      html: '<p>Test Body</p>',
    });
  });

  it('should propagate nodemailer transport failures', async () => {
    const error = new Error('SMTP connection timed out');
    mockSendMail.mockRejectedValue(error);

    await expect(
      service.sendEmail({
        to: 'recipient@test.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        automationExecutionId: 'exec-123',
      }),
    ).rejects.toThrow('SMTP connection timed out');
  });
});
