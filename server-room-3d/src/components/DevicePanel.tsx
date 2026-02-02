import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { DeviceType, ErrorLevel } from '../types';
import { DEVICE_TEMPLATES } from '../utils/deviceTemplates';
import type { DeviceTemplate } from '../utils/deviceTemplates';

export const DevicePanel = () => {
    const { racks, selectedRackId, selectRack, addDevice, removeDevice, selectDevice, deleteRack } = useStore();
    const rack = racks.find(r => r.id === selectedRackId);

    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<DeviceType>('Server');
    const [newUSize, setNewUSize] = useState(1);
    const [newUPos, setNewUPos] = useState<number | ''>('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [simError, setSimError] = useState<ErrorLevel | 'none'>('none');

    const handleTemplateSelect = (template: DeviceTemplate | '') => {
        if (template === '') {
            setNewName('');
            setNewType('Server');
            setNewUSize(1);
            setNewImageUrl('');
        } else {
            setNewName(template.name);
            setNewType(template.type);
            setNewUSize(template.uSize);
            setNewImageUrl(template.imageUrl);
        }
    };

    if (!rack) return null;

    const handleAdd = () => {
        if (!newUPos) {
            alert('Please select a position (U)');
            return;
        }

        const start = Number(newUPos);
        const end = start + newUSize - 1;

        // Validation
        if (start < 1 || end > rack.uHeight) {
            alert(`Error: Device (${newUSize}U) exceeds rack height.`);
            return;
        }

        const collision = rack.devices.find(d => {
            const dStart = d.uPosition;
            const dEnd = d.uPosition + d.uSize - 1;
            return (start <= dEnd && end >= dStart);
        });

        if (collision) {
            alert(`Error: Collision with "${collision.name}"`);
            return;
        }

        const device = {
            type: newType,
            name: newName || `${newType} ${newUPos}`,
            uSize: newUSize,
            uPosition: start,
            imageUrl: newImageUrl || undefined,
            portStates: [] as any[]
        };

        if (simError !== 'none') {
            device.portStates.push({
                portId: 'p1',
                status: 'error',
                errorLevel: simError as ErrorLevel,
                errorMessage: 'Simulated Error'
            });
        }

        const success = addDevice(rack.id, device); // Should succeed given checks
        if (success) {
            setNewName('');
            setNewUPos('');
            setNewImageUrl('');
        } else {
            alert('Failed to add device: Unknown error');
        }
    };

    // Styles
    const panelStyle: React.CSSProperties = {
        position: 'absolute', top: 0, right: 0,
        width: '400px', height: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
        zIndex: 20
    };

    const headerStyle: React.CSSProperties = {
        padding: '20px',
        borderBottom: '1px solid #eaeaea',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fff'
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '24px'
    };

    const sectionStyle: React.CSSProperties = {
        display: 'flex', flexDirection: 'column', gap: '12px'
    };

    const inputGroupStyle: React.CSSProperties = {
        display: 'flex', flexDirection: 'column', gap: '6px'
    };

    const inputStyle: React.CSSProperties = {
        padding: '10px 12px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        background: '#f9f9f9'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '12px', fontWeight: 600, color: '#666'
    };

    const buttonStyle: React.CSSProperties = {
        padding: '12px',
        background: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.2s'
    };

    // Helper to render rack slots
    const renderSlots = () => {
        const usedSlots = new Set<number>();
        rack.devices.forEach(d => {
            for (let i = 0; i < d.uSize; i++) {
                usedSlots.add(d.uPosition + i);
            }
        });

        const rendered = [];
        for (let u = 1; u <= rack.uHeight; u++) {
            const device = rack.devices.find(d => d.uPosition === u);
            const occupied = usedSlots.has(u);

            if (device) {
                const heightPx = device.uSize * 28; // Slightly compact
                // Device Colors
                const typeColors: Record<string, string> = {
                    'Switch': '#34d399', // Green
                    'Router': '#fbbf24', // Amber
                    'Server': '#818cf8', // Indigo
                };
                const bg = typeColors[device.type] || '#ccc';

                const hasError = device.portStates.some(p => p.status === 'error');

                rendered.push(
                    <div key={`dev-${u}`} style={{
                        height: `${heightPx}px`,
                        backgroundColor: bg,
                        borderRadius: '4px',
                        border: hasError ? '2px solid red' : '1px solid rgba(0,0,0,0.1)',
                        marginBottom: '2px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px',
                        color: '#fff', fontWeight: 500, fontSize: '12px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        position: 'relative',
                        cursor: 'pointer'
                    }}
                        onClick={() => selectDevice(device.id)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{device.name}</span>
                            <span style={{ opacity: 0.8, fontSize: '10px' }}>({device.uSize}U)</span>
                        </div>
                        <button
                            onClick={() => removeDevice(rack.id, device.id)}
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: 'none', color: 'white',
                                width: '20px', height: '20px', borderRadius: '50%',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>
                );
            } else if (!occupied) {
                const isSelected = newUPos === u;

                // 가용성 체크: u 위치에서 newUSize 만큼의 공간이 있는지 확인
                let canFit = true;
                if (u + newUSize - 1 > rack.uHeight) {
                    canFit = false; // 랙 높이 초과
                } else {
                    for (let i = 0; i < newUSize; i++) {
                        if (usedSlots.has(u + i)) {
                            canFit = false; // 다른 장비와 겹침
                            break;
                        }
                    }
                }

                rendered.push(
                    <div
                        key={`empty-${u}`}
                        onClick={() => canFit && setNewUPos(u)}
                        style={{
                            height: '28px',
                            borderBottom: '1px solid #eee',
                            display: 'flex', alignItems: 'center',
                            cursor: canFit ? 'pointer' : 'not-allowed',
                            backgroundColor: isSelected
                                ? '#eff6ff'
                                : !canFit
                                    ? '#fee2e2' // 불가능 (연한 빨강)
                                    : '#f0fdf4', // 가능 (연한 초록)
                            transition: 'background 0.1s',
                            marginBottom: '2px',
                            opacity: canFit ? 1 : 0.6
                        }}
                        title={!canFit ? '이 위치에는 해당 높이의 장비를 설치할 수 없습니다.' : ''}
                    >
                        {/* Rail Number Left */}
                        <div style={{
                            width: '30px',
                            textAlign: 'center',
                            fontSize: '10px',
                            color: isSelected ? '#2563eb' : (canFit ? '#666' : '#ef4444'),
                            borderRight: '1px solid #eee',
                            fontWeight: isSelected ? 700 : 400
                        }}>
                            {u}
                        </div>
                        {/* Slot Content */}
                        <div style={{
                            flex: 1,
                            paddingLeft: '10px',
                            fontSize: '11px',
                            color: isSelected ? '#1e40af' : (canFit ? '#166534' : '#991b1b'),
                            fontWeight: isSelected ? 600 : 400
                        }}>
                            {isSelected ? 'Selected' : canFit ? 'Available' : 'Unavailable'}
                        </div>
                        {/* Rail Number Right */}
                        <div style={{
                            width: '30px',
                            textAlign: 'center',
                            fontSize: '10px',
                            color: isSelected ? '#2563eb' : (canFit ? '#666' : '#ef4444'),
                            borderLeft: '1px solid #eee',
                            fontWeight: isSelected ? 700 : 400
                        }}>
                            {u}
                        </div>
                    </div>
                );
            }
        }
        // Flex column-reverse to put U=1 at bottom
        return (
            <div style={{
                display: 'flex', flexDirection: 'column-reverse',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
                padding: '4px', marginTop: '10px'
            }}>
                {rendered}
            </div>
        );
    };

    return (
        <div style={panelStyle}>
            <div style={headerStyle}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#111' }}>Rack {rack.id.substring(0, 4)}</h2>
                    <span style={{ fontSize: '12px', color: '#666' }}>{rack.uHeight}U Configuration</span>
                </div>
                <button
                    onClick={() => selectRack(null)}
                    style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                >
                    ×
                </button>
            </div>

            <div style={contentStyle}>
                {/* Form Section */}
                <div style={{ ...sectionStyle, padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#334155' }}>Add New Device</h3>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Quick Template</label>
                        <select
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") handleTemplateSelect("");
                                else {
                                    const template = DEVICE_TEMPLATES.find(t => t.name === val);
                                    if (template) handleTemplateSelect(template);
                                }
                            }}
                            style={inputStyle}
                        >
                            <option value="">-- Select Template --</option>
                            {DEVICE_TEMPLATES.map(t => (
                                <option key={t.name} value={t.name}>{t.name} ({t.uSize}U)</option>
                            ))}
                        </select>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Device Name</label>
                        <input
                            placeholder="e.g. Core Switch 01"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Type</label>
                            <select
                                value={newType}
                                onChange={e => setNewType(e.target.value as any)}
                                style={inputStyle}
                            >
                                <option value="Switch">Switch</option>
                                <option value="Router">Router</option>
                                <option value="Server">Server</option>
                            </select>
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Status Sim.</label>
                            <select
                                value={simError}
                                onChange={e => setSimError(e.target.value as any)}
                                style={inputStyle}
                            >
                                <option value="none">Normal</option>
                                <option value="warning">Warning</option>
                                <option value="minor">Minor</option>
                                <option value="major">Major</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Faceplate Image URL</label>
                        <input
                            placeholder="https://... or Data URL"
                            value={newImageUrl}
                            onChange={e => setNewImageUrl(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Height (U)</label>
                            <input
                                type="number" min="1" max="8"
                                value={newUSize}
                                onChange={e => setNewUSize(Number(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Postion (U)</label>
                            <input
                                type="number" min="1" max={rack.uHeight}
                                value={newUPos}
                                onChange={e => setNewUPos(Number(e.target.value))}
                                placeholder="Select/Type"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <button onClick={handleAdd} style={buttonStyle}>
                        Add Device
                    </button>
                </div>

                {/* Rack View */}
                <div style={sectionStyle}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#334155' }}>Rack Layout</h3>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Click a slot number below to set position.
                    </div>
                    {renderSlots()}
                </div>

                {/* Delete Rack Section */}
                <div style={{ ...sectionStyle, marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #ef444433' }}>
                    <button
                        onClick={() => {
                            if (window.confirm('이 랙을 삭제하시겠습니까? 내부의 모든 장비도 함께 삭제됩니다.')) {
                                deleteRack(rack.id);
                            }
                        }}
                        style={{ ...buttonStyle, background: '#ef4444', transition: 'filter 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(0.9)'}
                        onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                    >
                        Rack 삭제
                    </button>
                </div>
            </div>
        </div>
    );
};
