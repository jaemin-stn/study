import type { Rack } from '../types';

export const saveToJSON = (racks: Rack[]) => {
    const json = JSON.stringify(racks, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server-room-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const loadFromJSON = (file: File): Promise<Rack[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (Array.isArray(json)) {
                    resolve(json as Rack[]);
                } else {
                    reject(new Error("Invalid JSON format"));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
};

export const sampleRacks: Rack[] = [
    {
        id: crypto.randomUUID(),
        uHeight: 48,
        position: [0, 0],
        devices: [
            {
                id: crypto.randomUUID(),
                type: 'Switch',
                name: 'OTN_JIJAKSA',
                uSize: 14,
                uPosition: 30,
                imageUrl: '/assets/OTN_JIJAKSA.png',
                portStates: [
                    { portId: 'p1', status: 'error', errorLevel: 'critical', errorMessage: 'Link Down' }
                ]
            },
            {
                id: crypto.randomUUID(),
                type: 'Server',
                name: '120YD',
                uSize: 9,
                uPosition: 1,
                imageUrl: '/assets/120YD.png',
                portStates: []
            }
        ]
    },
    {
        id: crypto.randomUUID(),
        uHeight: 48,
        position: [2, 1],
        devices: [
            {
                id: crypto.randomUUID(),
                type: 'Router',
                name: 'ER_1',
                uSize: 4,
                uPosition: 20,
                imageUrl: '/assets/ER_1.png',
                portStates: [
                    { portId: 'p1', status: 'error', errorLevel: 'minor', errorMessage: 'High Latency' }
                ]
            },
            {
                id: crypto.randomUUID(),
                type: 'Router',
                name: 'AR_1',
                uSize: 1,
                uPosition: 1,
                imageUrl: '/assets/AR_1.png',
                portStates: []
            }
        ]
    }
];
