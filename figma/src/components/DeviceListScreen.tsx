interface Device {
    id: number;
    name: string;
    type: string;
    ip: string;
    status: 'online' | 'warning' | 'offline';
    statusText: string;
}

interface DeviceListScreenProps {
    devices: Device[];
}

export default function DeviceListScreen({ devices }: DeviceListScreenProps) {
    return (
        <div className="w-full h-full bg-white overflow-y-auto px-6 pt-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-semibold text-black">디바이스 목록</h2>
                <span className="text-[13px] text-[#86868b]">총 {devices.length}개</span>
            </div>

            {/* Device Cards */}
            <div className="flex flex-col gap-3">
                {devices.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-[15px]">등록된 디바이스가 없습니다</p>
                        <p className="text-[13px] mt-1">+ 버튼을 눌러 디바이스를 추가하세요</p>
                    </div>
                ) : (
                    devices.map((device) => (
                        <div
                            key={device.id}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center justify-between">
                                {/* Left: Device Info */}
                                <div className="flex items-center gap-3 flex-1">
                                    {/* Status Indicator */}
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-green-500' :
                                            device.status === 'warning' ? 'bg-yellow-500' :
                                                'bg-red-500'
                                        }`} />

                                    {/* Device Details */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[15px] font-medium text-black truncate">
                                            {device.name}
                                        </h3>
                                        <p className="text-[13px] text-[#86868b] mt-0.5">
                                            {device.type} • {device.ip}
                                        </p>
                                    </div>
                                </div>

                                {/* Right: Status Badge & Arrow */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className={`px-3 py-1 rounded-full ${device.status === 'online' ? 'bg-green-50' :
                                            device.status === 'warning' ? 'bg-yellow-50' :
                                                'bg-red-50'
                                        }`}>
                                        <span className={`text-[12px] font-medium ${device.status === 'online' ? 'text-green-700' :
                                                device.status === 'warning' ? 'text-yellow-700' :
                                                    'text-red-700'
                                            }`}>
                                            {device.statusText}
                                        </span>
                                    </div>
                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                        <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
