import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './auth.dto';

const base = {
  email: 'a@b.com',
  motDePasse: 'MonMdp2026#',
  nom: 'Kouassi',
  telephone: '+228 90 00 00 00',
  role: 'CLIENT',
  region: 'Lomé',
};

const isValid = (payload: any) => {
  const dto = plainToInstance(RegisterDto, payload);
  return validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length === 0;
};

describe('RegisterDto - contraintes de champs', () => {
  it('accepte une inscription valide', () => {
    expect(isValid(base)).toBe(true);
  });

  it('refuse un nom contenant des chiffres', () => {
    expect(isValid({ ...base, nom: 'Kouassi123' })).toBe(false);
  });

  it('refuse un nom contenant des caractères spéciaux', () => {
    expect(isValid({ ...base, nom: 'Kou@ssi!' })).toBe(false);
  });

  it('refuse un prénom contenant des chiffres', () => {
    expect(isValid({ ...base, prenom: 'Jean2' })).toBe(false);
  });

  it('accepte les noms composés avec espace, tiret et apostrophe', () => {
    expect(isValid({ ...base, nom: 'N’Diaye-Koffi', prenom: 'Marie Claire' })).toBe(true);
  });

  it.each([
    ['trop court', 'Abc1!'],
    ['sans majuscule', 'monmdp2026#'],
    ['sans minuscule', 'MONMDP2026#'],
    ['sans chiffre', 'MonMotDePasse#'],
    ['sans caractère spécial', 'MonMdp2026'],
  ])('refuse un mot de passe %s', (_label, motDePasse) => {
    expect(isValid({ ...base, motDePasse })).toBe(false);
  });

  it('refuse un rôle ADMIN', () => {
    expect(isValid({ ...base, role: 'ADMIN' })).toBe(false);
  });

  it('refuse un prestataire sans spécialité', () => {
    expect(isValid({ ...base, role: 'PRESTATAIRE' })).toBe(false);
  });

  it('refuse une région vide', () => {
    expect(isValid({ ...base, region: '' })).toBe(false);
  });

  it('refuse un téléphone manquant', () => {
    const { telephone, ...withoutPhone } = base;
    expect(isValid(withoutPhone)).toBe(false);
  });

  it('refuse un téléphone au mauvais format', () => {
    expect(isValid({ ...base, telephone: 'abcde' })).toBe(false);
  });

  it('refuse un champ non prévu (forbidNonWhitelisted)', () => {
    expect(isValid({ ...base, isAdmin: true })).toBe(false);
  });
});
