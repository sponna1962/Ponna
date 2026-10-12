jest.mock('../../lib/prisma', () => ({ prisma: {} }));
jest.mock('../notifications/push-notification.service', () => ({ pushNotificationService: { isConfigured: () => false } }));
import { AdminAlertService } from './admin-alert.service';

describe('notifyJobFailure', () => {
  it('alerts once per job within the throttle window, but separate jobs separately', () => {
    const svc = new AdminAlertService();
    const spy = jest.spyOn(svc, 'notify').mockImplementation(() => {});
    svc.notifyJobFailure('Job A', new Error('boom'));
    svc.notifyJobFailure('Job A', new Error('boom again'));
    svc.notifyJobFailure('Job B', 'x');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('Job A');
    expect(spy.mock.calls[0][1]).toContain('boom');
  });
});
