export default function SettingsScreen() {
    return (
        <div className="w-full h-full bg-white px-6 py-6">
            {/* Settings List */}
            <div className="flex flex-col gap-1">

                {/* General Section */}
                <div className="py-2">
                    <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wide mb-2">
                        General
                    </h2>

                    {/* Notifications */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M9 2C9.55 2 10 2.45 10 3V9H16C16.55 9 17 9.45 17 10C17 10.55 16.55 11 16 11H10V17C10 17.55 9.55 18 9 18C8.45 18 8 17.55 8 17V11H2C1.45 11 1 10.55 1 10C1 9.45 1.45 9 2 9H8V3C8 2.45 8.45 2 9 2Z" fill="white" transform="rotate(-45 9 9)" />
                                </svg>
                            </div>
                            <span className="text-[17px] text-black">Notifications</span>
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {/* Wi-Fi */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                                <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                                    <path d="M8 13C8.828 13 9.5 12.328 9.5 11.5C9.5 10.672 8.828 10 8 10C7.172 10 6.5 10.672 6.5 11.5C6.5 12.328 7.172 13 8 13Z" fill="white" />
                                    <path d="M8 8C9.933 8 11.631 8.895 12.742 10.242L14.157 8.828C12.645 7.316 10.507 6.5 8 6.5C5.493 6.5 3.355 7.316 1.843 8.828L3.257 10.242C4.369 8.895 6.067 8 8 8Z" fill="white" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-[17px] text-black">Wi-Fi</div>
                                <div className="text-[13px] text-[#86868b]">Connected Network</div>
                            </div>
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {/* Bluetooth */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                                <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                                    <path d="M9 12L5 8V0L9 4L5 8L9 12ZM5 8V16L1 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="white" />
                                </svg>
                            </div>
                            <span className="text-[17px] text-black">Bluetooth</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[17px] text-[#86868b]">Off</span>
                            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Privacy Section */}
                <div className="py-2 mt-4">
                    <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wide mb-2">
                        Privacy
                    </h2>

                    {/* Location Services */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                                <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                                    <path d="M6 0C2.69 0 0 2.69 0 6C0 10.5 6 16 6 16C6 16 12 10.5 12 6C12 2.69 9.31 0 6 0ZM6 8C4.9 8 4 7.1 4 6C4 4.9 4.9 4 6 4C7.1 4 8 4.9 8 6C8 7.1 7.1 8 6 8Z" fill="white" />
                                </svg>
                            </div>
                            <span className="text-[17px] text-black">Location Services</span>
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {/* Analytics */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="1" y="8" width="3" height="6" rx="1" fill="white" />
                                    <rect x="5.5" y="4" width="3" height="10" rx="1" fill="white" />
                                    <rect x="10" y="0" width="3" height="14" rx="1" fill="white" />
                                </svg>
                            </div>
                            <span className="text-[17px] text-black">Analytics</span>
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                {/* Account Section */}
                <div className="py-2 mt-4">
                    <h2 className="text-[13px] font-semibold text-[#6e6e73] uppercase tracking-wide mb-2">
                        Account
                    </h2>

                    {/* Profile */}
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-gray-400 flex items-center justify-center">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <circle cx="7" cy="4" r="3" fill="white" />
                                    <path d="M2 14C2 11 4 9 7 9C10 9 12 11 12 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                            <span className="text-[17px] text-black">Profile</span>
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                            <path d="M1 1L7 7L1 13" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    {/* Sign Out */}
                    <div className="flex items-center justify-center py-4 mt-4">
                        <button className="text-[17px] text-red-500 font-semibold">
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
