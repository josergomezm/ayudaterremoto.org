const es = {
  slide1: {
    label: 'Paso 1 de 4',
    heading: 'Aquí coordinamos la ayuda',
    body: 'Ayuda Terremoto conecta a personas afectadas con voluntarios y equipos de rescate. Puedes reportar emergencias, buscar desaparecidos y ver qué se necesita en tu zona, incluso sin internet.',
  },
  slide2: {
    label: 'Paso 2 de 4',
    heading: '¿Qué puedes hacer?',
    tabs: {
      map: { title: 'Mapa', desc: 'Ver todos los reportes de emergencias activos en tu zona, ordenados por gravedad.' },
      report: { title: 'Reportar', desc: 'Enviar un reporte de emergencia propio o de otra persona. Requiere verificación.' },
      alerts: { title: 'Alertas', desc: 'Canal oficial de avisos y correcciones de los equipos de rescate. Léelo primero.' },
      guides: { title: 'Guías', desc: 'Protocolos de seguridad ante sismos, fugas de gas y primeros auxilios. Funcionan offline.' },
      people: { title: 'Búsquedas', desc: 'Consultar personas desaparecidas, ingresos a hospitales o solicitar la inspección de un edificio.' },
    },
  },
  slide3_hubs: {
    label: 'Paso 3 de 4',
    heading: 'Centros de Suministro',
    body: 'Hemos habilitado una capa de mapa y directorio de centros que distribuyen agua, comida, herramientas y refugio. Cualquiera puede ver la disponibilidad en tiempo real para donar o solicitar apoyo.',
    coordTitle: 'Ayuda con la coordinación',
    coordBody: '¿Deseas coordinar un centro o registrar insumos? Solicita acceso para unirte a nuestros grupos de trabajo en WhatsApp.',
    coordCta: 'Contactar a Coordinación en WhatsApp',
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
      civilian: {
        name: 'Colaborador',
        desc: 'Iniciaste sesión con Google. Puedes reportar emergencias y buscar personas.',
      },
      coordinator: {
        name: 'Coordinador',
        desc: 'Tu solicitud fue aprobada. Puedes actualizar estados y gestionar tu centro.',
      },
      admin: {
        name: 'Organizador',
        desc: 'Coordinas la operación: creas centros, asignas coordinadores, transmites avisos y revisas reportes.',
      },
      sudo: {
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
      civilian: {
        name: 'Collaborator',
        desc: 'Signed in with Google. You can report emergencies and search for people.',
      },
      coordinator: {
        name: 'Coordinator',
        desc: 'Your request was approved. You can update statuses and manage your center.',
      },
      admin: {
        name: 'Organizer',
        desc: 'You run the operation: create centers, assign coordinators, broadcast notices, and review reports.',
      },
      sudo: {
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
