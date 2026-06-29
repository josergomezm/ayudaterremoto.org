const es = {
  title: 'Mapa de incidentes',
  legend: 'Leyenda',
  cleared: 'Sitios despejados',
  active: 'Incidentes activos',
  empty: 'Aún no hay incidentes reportados.',
  emptyReportCta: 'Reportar un incidente',
  emptyVerifyCta: 'Verifica tu identidad para poder reportar',
  shuffle: 'Reordenar',
  loadError: 'No se pudieron cargar los incidentes.',
  filters: {
    categoryLabel: 'Categoría',
    priorityLabel: 'Prioridad',
    sortByLabel: 'Ordenar por',
    viewLabel: 'Vista',
    assignmentLabel: 'Asignación',
    ageLabel: 'Antigüedad',
    noResults: 'Sin resultados para los filtros seleccionados.',
    categories: {
      all: 'Todas',
      medical: 'Médico',
      structural: 'Estructural',
      obstruction: 'Obstrucción',
      resource: 'Recursos',
    },
    priorities: {
      all: 'Todas',
      red: 'Crítica (Rojo)',
      yellow: 'Media (Amarillo)',
      green: 'Baja (Verde)',
    },
    sortOptions: {
      newest: 'Más recientes',
      oldest: 'Más antiguos',
      severityDesc: 'Gravedad (Mayor a menor)',
      severityAsc: 'Gravedad (Menor a mayor)',
    },
    assignments: {
      all: 'Todos',
      mine: 'Asignados a mí',
      unassigned: 'Sin asignar',
    },
    ages: {
      all: 'Cualquier antigüedad',
      stale: 'Críticos (>72 horas)',
    },
  },
}

const en: typeof es = {
  title: 'Incident map',
  legend: 'Legend',
  cleared: 'Cleared sites',
  active: 'Active incidents',
  empty: 'No incidents reported yet.',
  emptyReportCta: 'Report an incident',
  emptyVerifyCta: 'Verify your identity to start reporting',
  shuffle: 'Reorder',
  loadError: 'Could not load incidents.',
  filters: {
    categoryLabel: 'Category',
    priorityLabel: 'Priority',
    sortByLabel: 'Sort by',
    viewLabel: 'View',
    assignmentLabel: 'Assignment',
    ageLabel: 'Age',
    noResults: 'No results found matching the selected filters.',
    categories: {
      all: 'All',
      medical: 'Medical',
      structural: 'Structural',
      obstruction: 'Obstruction',
      resource: 'Resource',
    },
    priorities: {
      all: 'All',
      red: 'Critical (Red)',
      yellow: 'Medium (Yellow)',
      green: 'Low (Green)',
    },
    sortOptions: {
      newest: 'Newest first',
      oldest: 'Oldest first',
      severityDesc: 'Severity (High to Low)',
      severityAsc: 'Severity (Low to High)',
    },
    assignments: {
      all: 'All',
      mine: 'Assigned to me',
      unassigned: 'Unassigned',
    },
    ages: {
      all: 'Any age',
      stale: 'Critical (>72 hours)',
    },
  },
}

export default { es, en }
