import { ServiceType } from './types';

export const PREDEFINED_ENTITIES: Record<ServiceType, string[]> = {
  escolar: [
    'IFPE',
    'ETE',
    'UFRPE/UABJ'
  ],
  urbano: [],
  outros: [
    'Táxi',
    'Moto Táxi',
    'Belo Tour'
  ]
};
