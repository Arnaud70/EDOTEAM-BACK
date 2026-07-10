import { buildWelcomeNotificationContent } from './auth.service';

describe('buildWelcomeNotificationContent', () => {
  it('returns a detailed welcome message for clients', () => {
    const content = buildWelcomeNotificationContent('CLIENT');

    expect(content.title).toContain('Bienvenue');
    expect(content.message).toContain('Découvrez');
    expect(content.message).toContain('Étapes rapides');
    expect(content.message).toContain('Complétez votre profil');
  });

  it('returns role-specific steps for prestataires', () => {
    const content = buildWelcomeNotificationContent('PRESTATAIRE');

    expect(content.title).toContain('Expert');
    expect(content.message).toContain('services');
    expect(content.message).toContain('disponibilités');
    expect(content.message).toContain('documents');
  });
});
