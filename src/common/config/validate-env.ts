/**
 * Vérifie la présence des variables d'environnement critiques au démarrage.
 * On refuse de démarrer sans secrets JWT forts : plus aucun secret par défaut codé en dur.
 */
const MIN_SECRET_LENGTH = 32;

export function validateEnv(): void {
  // ConfigModule charge .env pendant la création du module Nest, donc APRÈS cet appel.
  // On charge dotenv ici pour valider la config avant même le démarrage de l'app.
  try {
    require('dotenv').config();
  } catch {
    /* dotenv absent (variables déjà injectées par l'hébergeur) : on continue */
  }

  const errors: string[] = [];

  const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of requiredSecrets) {
    const value = process.env[key];
    if (!value) {
      errors.push(`${key} est manquant`);
    } else if (value.length < MIN_SECRET_LENGTH) {
      errors.push(
        `${key} est trop court (min ${MIN_SECRET_LENGTH} caractères)`,
      );
    } else if (
      /super_secret_luxe_togo|super_refresh_secret_togo|changeme|secret/i.test(
        value,
      )
    ) {
      errors.push(`${key} utilise une valeur par défaut non sécurisée`);
    }
  }

  if (
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    errors.push('JWT_SECRET et JWT_REFRESH_SECRET doivent être différents');
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL est manquant');
  }

  for (const key of ['BREVO_API_KEY', 'MAIL_FROM_NAME', 'MAIL_FROM_EMAIL']) {
    if (!process.env[key]) {
      errors.push(`${key} est manquant (emails via API HTTPS Brevo)`);
    }
  }

  for (const key of [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]) {
    if (!process.env[key]) {
      errors.push(`${key} est manquant (stockage des fichiers Cloudinary)`);
    }
  }

  if (
    process.env.MAIL_FROM_EMAIL &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.MAIL_FROM_EMAIL)
  ) {
    errors.push('MAIL_FROM_EMAIL est invalide');
  }

  if (errors.length > 0) {
    console.error(
      '\n❌ Configuration invalide :\n' +
        errors.map((e) => `   - ${e}`).join('\n') +
        '\n',
    );
    console.error(
      "   Générez des secrets : node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n",
    );
    process.exit(1);
  }
}
