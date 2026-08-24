import { buildWelcomeNotificationContent, isProfileComplete } from './auth.service';

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

describe('isProfileComplete', () => {
  it('blocks access until mandatory profile details are filled', () => {
    expect(isProfileComplete({ role: 'CLIENT', telephone: '', localisation: '' })).toBe(false);
    expect(isProfileComplete({ role: 'CLIENT', telephone: '+228 90 00 00 00', localisation: 'Lomé' })).toBe(true);
    expect(isProfileComplete({ role: 'PRESTATAIRE', telephone: '+228 90 00 00 00', localisation: 'Lomé', titreProfessionnel: '' })).toBe(false);
    expect(isProfileComplete({ role: 'PRESTATAIRE', telephone: '+228 90 00 00 00', localisation: 'Lomé', titreProfessionnel: 'Plomberie' })).toBe(true);
  });
});
