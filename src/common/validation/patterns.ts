/**
 * Règles de validation partagées (inscription, mise à jour de profil, changement de mot de passe).
 */

// Un nom / prénom : commence par une lettre, puis lettres, espaces, tirets, apostrophes ou points.
// Interdit explicitement les chiffres et les caractères spéciaux (@, !, #, /, ...).
export const NAME_REGEX = /^\p{L}[\p{L} .'’-]*$/u;
export const NAME_REGEX_MESSAGE =
  'Ce champ ne doit pas contenir de chiffres ni de caractères spéciaux';

// Mot de passe robuste : au moins une minuscule, une majuscule, un chiffre et un caractère spécial.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_REGEX_MESSAGE =
  'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial';

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt ne prend en compte que les 72 premiers octets : on bloque au-delà pour éviter la confusion.
export const PASSWORD_MAX_LENGTH = 72;

// Téléphone : chiffres, espaces, tirets, parenthèses et un éventuel préfixe "+". 6 à 20 caractères utiles.
export const PHONE_REGEX = /^\+?[0-9 ()-]{6,20}$/;
export const PHONE_REGEX_MESSAGE = 'Le numéro de téléphone n’est pas valide';

export const BANNED_WORDS = [
  'sexe', 'drogue', 'arme', 'tueur', 'prostituee', 'escort', 'vol', 'arnaque',
  'hack', 'piratage', 'drogues', 'armes', 'murder', 'sex', 'porn', 'porno',
  'assassin', 'viagra', 'drog',
];

export const containsBannedWord = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return BANNED_WORDS.some((word) => normalized.includes(word));
};

export const BANNED_WORD_MESSAGE =
  "Le contenu proposé est invalide et ne respecte pas nos conditions d'utilisation et nos normes d'excellence.";

/**
 * Trim d'une valeur reçue via class-transformer (@Transform).
 */
export const trimTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
