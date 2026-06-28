// Copy is written for a crisis context — people are scared and need to act fast.
// Keep sentences short, verbs first, no bureaucratic language.

const es = {
  slide1: {
    label: 'Paso 1 de 4',
    heading: 'Aquí coordinamos la ayuda',
    body: 'Ayuda Terremoto conecta a personas afectadas con voluntarios and brigadas. Puedes reportar emergencias, buscar personas desaparecidas y ver qué está pasando en tu zona, incluso sin conexión.',
  },
  slide2: {
    label: 'Paso 2 de 4',
    heading: '¿Qué puedes hacer?',
    tabs: {
      map: { title: 'Mapa', desc: 'Ve todos los incidentes activos en tu área ordenados por gravedad.' },
      report: { title: 'Reportar', desc: 'Reporta una emergencia para ti o para otra persona. Requiere verificación.' },
      alerts: { title: 'Alertas', desc: 'Avisos oficiales del equipo de respuesta. Léelos primero.' },
      guides: { title: 'Guías', desc: 'Instrucciones de seguridad para sismos, fugas de gas y primeros auxilios. Funcionan sin internet.' },
      people: { title: 'Consultas', desc: 'Busca desaparecidos, ingresados a hospitales o solicita revisión de edificios.' },
    },
  },
  slide3_hubs: {
    label: 'Paso 3 de 4',
    heading: 'Centros de Suministro',
    body: 'Hemos habilitado un mapa y listado de centros donde se distribuye agua, comida, herramientas y refugio. Cualquiera puede ver la disponibilidad y urgencia en tiempo real para donar o solicitar ayuda.',
    coordTitle: 'Ayuda con la coordinación',
    coordBody: '¿Quieres coordinar o gestionar el inventario de un centro? Solicita acceso para unirte a nuestros grupos de trabajo de WhatsApp.',
    coordCta: 'Contactar Coordinación en WhatsApp',
  },
  slide3: {
    label: 'Paso 4 de 4',
    heading: 'Niveles de acceso',
    intro: 'Cuanto más verificado estés, más puedes ayudar. La verificación protege la integridad de los reportes.',
    roles: {
      unverified: {
        name: 'Sin verificar',
        desc: 'Puedes ver el mapa, leer alertas y consultar guías. No puedes reportar.',
      },
      colaborador: {
        name: 'Colaborador',
        desc: 'Iniciaste sesión con Google. Puedes reportar emergencias y buscar personas.',
      },
      coordinador: {
        name: 'Coordinador',
        desc: 'Te dieron un código de aval. Puedes actualizar estados y gestionar tu centro.',
      },
      organizador: {
        name: 'Organizador',
        desc: 'Coordinas la operación: creas centros, asignas coordinadores, transmites avisos y revisas reportes.',
      },
      fundador: {
        name: 'Fundador',
        desc: 'Administrador raíz. Gestiona el equipo y toda la operación.',
      },
    },
    ctaPrimary: 'Verificar identidad',
    ctaSecondary: 'Explorar primero',
  },
  next: 'Siguiente',
  back: 'Atrás',
  skip: 'Omitir',
  dotAria: 'Ir al paso {n}',
}

const en: typeof es = {
  slide1: {
    label: 'Step 1 of 4',
    heading: 'This is where we coordinate aid',
    body: 'Ayuda Terremoto connects affected people with volunteers and response teams. You can report emergencies, search for missing people, and see what\'s happening in your area — even offline.',
  },
  slide2: {
    label: 'Step 2 of 4',
    heading: 'What can you do?',
    tabs: {
      map: { title: 'Map', desc: 'See all active incidents in your area, sorted by severity.' },
      report: { title: 'Report', desc: 'Report an emergency for yourself or someone else. Requires verification.' },
      alerts: { title: 'Alerts', desc: 'Official response-team broadcasts. Read these first.' },
      guides: { title: 'Guides', desc: 'Safety instructions for earthquakes, gas leaks, and first aid. Work without internet.' },
      people: { title: 'Search', desc: 'Look up missing persons, hospital admissions, or request a building check.' },
    },
  },
  slide3_hubs: {
    label: 'Step 3 of 4',
    heading: 'Supply Centers',
    body: 'We have enabled a map layer and directory of supply centers distributing water, food, tools, and shelter. Anyone can see real-time availability and urgency to donate or request aid.',
    coordTitle: 'Help with coordination',
    coordBody: 'Do you want to coordinate or manage a center\'s inventory? Request access to join our WhatsApp working groups.',
    coordCta: 'Contact Coordination on WhatsApp',
  },
  slide3: {
    label: 'Step 4 of 4',
    heading: 'Access levels',
    intro: 'The more verified you are, the more you can do. Verification protects the integrity of all reports.',
    roles: {
      unverified: {
        name: 'Unverified',
        desc: 'You can view the map, read alerts, and check guides. You cannot file reports.',
      },
      colaborador: {
        name: 'Collaborator',
        desc: 'Signed in with Google. You can report emergencies and search for people.',
      },
      coordinador: {
        name: 'Coordinator',
        desc: 'You were given a vouch code. You can update statuses and manage your center.',
      },
      organizador: {
        name: 'Organizer',
        desc: 'You run the operation: create centers, assign coordinators, broadcast notices, and review reports.',
      },
      fundador: {
        name: 'Founder',
        desc: 'Root administrator. Manages the full team and all operations.',
      },
    },
    ctaPrimary: 'Verify identity',
    ctaSecondary: 'Explore first',
  },
  next: 'Next',
  back: 'Back',
  skip: 'Skip',
  dotAria: 'Go to step {n}',
}

export default { es, en }
