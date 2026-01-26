import { useState } from 'react';

interface AddDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (device: DeviceFormData) => void;
}

export interface DeviceFormData {
    name: string;
    type: string;
    status: string;
    ip: string;
    latitude: string;
    longitude: string;
}

export default function AddDeviceModal({ isOpen, onClose, onAdd }: AddDeviceModalProps) {
    const [formData, setFormData] = useState<DeviceFormData>({
        name: '',
        type: '',
        status: '',
        ip: '',
        latitude: '',
        longitude: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
        // Reset form
        setFormData({
            name: '',
            type: '',
            status: '',
            ip: '',
            latitude: '',
            longitude: ''
        });
        onClose();
    };

    const handleCancel = () => {
        // Reset form on cancel
        setFormData({
            name: '',
            type: '',
            status: '',
            ip: '',
            latitude: '',
            longitude: ''
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={handleCancel}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-[361px] max-h-[90vh] overflow-y-auto mx-4">
                {/* Header */}
                <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
                    <h2 className="text-[20px] font-bold text-black">새 디바이스 추가</h2>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Device Name */}
                    <div>
                        <label className="block text-[13px] font-medium text-black mb-2">
                            디바이스 이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="예: 서울 본사 라우터"
                            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Device Type */}
                    <div>
                        <label className="block text-[13px] font-medium text-black mb-2">
                            디바이스 유형 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            placeholder="예: Router, Switch, Firewall"
                            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Initial Status */}
                    <div>
                        <label className="block text-[13px] font-medium text-black mb-2">
                            초기 상태 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            placeholder="예: 온라인, 경고, 오프라인"
                            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* IP Address */}
                    <div>
                        <label className="block text-[13px] font-medium text-black mb-2">
                            IP 주소 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.ip}
                            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                            placeholder="예: 192.168.1.1"
                            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Coordinates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[13px] font-medium text-black mb-2">
                                위도 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.latitude}
                                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                placeholder="37.5665"
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-[13px] font-medium text-black mb-2">
                                경도 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.longitude}
                                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                placeholder="126.9780"
                                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <p className="text-[11px] text-gray-500">
                        * 위도와 경도는 지도 상의 백분율 위치로 사용됩니다 (0-100)
                    </p>

                    {/* Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="py-3 px-6 bg-gray-100 text-gray-700 rounded-xl font-medium text-[15px] hover:bg-gray-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="py-3 px-6 bg-[#030213] text-white rounded-xl font-medium text-[15px] hover:bg-[#1a1a2e] transition-colors"
                        >
                            추가
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
