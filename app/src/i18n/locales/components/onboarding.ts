const es = {
  unverified: {
    heading: 'Para reportar, verifica tu identidad',
    body: 'El mapa es visible para todos. Para enviar reportes, inicia sesión con Google. Solo toma un minuto.',
    cta: 'Verificar identidad',
  },
  civilian: {
    heading: 'Tienes acceso de Colaborador',
    body: 'Puedes reportar emergencias. Para coordinar un centro, solicita acceso desde el portal.',
    cta: 'Solicitar acceso',
  },
  dismiss: 'Entendido',
}

const en: typeof es = {
  unverified: {
    heading: 'To file reports, verify your identity',
    body: 'The map is visible to everyone. To submit reports, sign in with Google. It only takes a minute.',
    cta: 'Verify identity',
  },
  civilian: {
    heading: 'You have Collaborator access',
    body: 'You can file emergency reports. To coordinate a center, request access from the portal.',
    cta: 'Request access',
  },
  dismiss: 'Got it',
}

export default { es, en }
