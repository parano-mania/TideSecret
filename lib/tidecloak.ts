import rawConfig from '../tidecloak.json'

// Validate the existing exported adapter without inventing configuration.
export const tidecloakConfig: Record<string, unknown> = rawConfig
export const isTidecloakConfigured = ['realm', 'auth-server-url', 'resource'].every(
  (key) => typeof tidecloakConfig[key] === 'string' && Boolean((tidecloakConfig[key] as string).trim())
)
