import { ServiceType } from './types';

export const PREDEFINED_ENTITIES: Record<ServiceType, string[]> = {
  escolar: [
    'Colégio Águia',
    'IFPE Belo Jardim',
    'UABJ',
    'Fabeja',
    'ETE'
  ],
  urbano: [],
  outros: [
    'Táxi',
    'Moto Táxi',
    'Belo Tour'
  ]
};
