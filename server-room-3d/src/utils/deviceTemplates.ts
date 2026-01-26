import type { DeviceType } from '../types';

export interface DeviceTemplate {
    name: string;
    type: DeviceType;
    uSize: number;
    imageUrl: string;
}

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
    {
        name: '120YD',
        type: 'Server',
        uSize: 9,
        imageUrl: '/assets/120YD.png'
    },
    {
        name: 'AR_1',
        type: 'Router',
        uSize: 1,
        imageUrl: '/assets/AR_1.png'
    },
    {
        name: 'AR_2',
        type: 'Router',
        uSize: 1,
        imageUrl: '/assets/AR_2.png'
    },
    {
        name: 'CR',
        type: 'Router',
        uSize: 17,
        imageUrl: '/assets/CR.png'
    },
    {
        name: 'ER_1',
        type: 'Router',
        uSize: 4,
        imageUrl: '/assets/ER_1.png'
    },
    {
        name: 'OTN_B1',
        type: 'Switch',
        uSize: 14,
        imageUrl: '/assets/OTN_B1.png'
    },
    {
        name: 'OTN_JIJAKSA',
        type: 'Switch',
        uSize: 14,
        imageUrl: '/assets/OTN_JIJAKSA.png'
    }
];
