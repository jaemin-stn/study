import type { DeviceType } from '../types';

export interface DeviceTemplate {
    name: string;
    type: DeviceType;
    uSize: number;
    imageUrl: string;
    portCount: number;
}

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
    {
        name: '120YD',
        type: 'Server',
        uSize: 9,
        imageUrl: '/assets/120YD.png',
        portCount: 24
    },
    {
        name: 'AR_1',
        type: 'Router',
        uSize: 1,
        imageUrl: '/assets/AR_1.png',
        portCount: 8
    },
    {
        name: 'AR_2',
        type: 'Router',
        uSize: 1,
        imageUrl: '/assets/AR_2.png',
        portCount: 8
    },
    {
        name: 'CR',
        type: 'Router',
        uSize: 17,
        imageUrl: '/assets/CR.png',
        portCount: 48
    },
    {
        name: 'ER_1',
        type: 'Router',
        uSize: 4,
        imageUrl: '/assets/ER_1.png',
        portCount: 16
    },
    {
        name: 'OTN_B1',
        type: 'Switch',
        uSize: 14,
        imageUrl: '/assets/OTN_B1.png',
        portCount: 48
    },
    {
        name: 'OTN_JIJAKSA',
        type: 'Switch',
        uSize: 14,
        imageUrl: '/assets/OTN_JIJAKSA.png',
        portCount: 48
    }
];
