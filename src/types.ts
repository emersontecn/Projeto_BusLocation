export type UserRole = 'student' | 'driver' | 'admin';
export type ServiceType = 'urbano' | 'escolar' | 'outros';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  password?: string;
}

export interface Stop {
  id: string;
  name: string;
  streetName?: string;
  referencePoint?: string;
  estimatedTime?: string;
  zipCode?: string;
  lat: number;
  lng: number;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  driverId: string;
  stops: Stop[];
  serviceType: ServiceType;
  entityName?: string; // Company name for Urbano, School name for Escolar
}

export interface Trip {
  id: string;
  routeId: string;
  driverId: string;
  driverName?: string;
  status: 'active' | 'completed';
  currentLat: number;
  currentLng: number;
  lastUpdated: string;
  alert?: string;
}

export interface DriverLog {
  id: string;
  driverId: string;
  driverName: string;
  routeId?: string;
  routeName?: string;
  startTime: any; // Firestore Timestamp
  endTime?: any; // Firestore Timestamp
  date: string; // YYYY-MM-DD
}
