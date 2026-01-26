interface BottomTabBarProps {
    activeTab: 'map' | 'list' | 'settings';
    onTabChange: (tab: 'map' | 'list' | 'settings') => void;
    onAddClick: () => void;
}

export default function BottomTabBar({ activeTab, onTabChange, onAddClick }: BottomTabBarProps) {
    return (
        <div className="absolute bottom-0 left-0 w-full h-[116px] bg-white z-10 border-t border-gray-100">

            {/* Bottom Tabs Container */}
            <div className="relative h-full w-full pt-8">

                {/* Tab Items Row */}
                <div className="flex justify-between items-start px-6 relative">

                    {/* Map Tab */}
                    <button
                        onClick={() => onTabChange('map')}
                        className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity w-[70px]"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M20.5 3L20.34 3.03L15 5.1L9 3L3.36 4.9C3.15 4.97 3 5.15 3 5.38V20.5C3 20.78 3.22 21 3.5 21L3.66 20.97L9 18.9L15 21L20.64 19.1C20.85 19.03 21 18.85 21 18.62V3.5C21 3.22 20.78 3 20.5 3ZM15 19L9 16.89V5L15 7.11V19Z"
                                fill={activeTab === 'map' ? '#007AFF' : '#9797a0'}
                            />
                        </svg>
                        <span className={`text-[10px] font-medium ${activeTab === 'map' ? 'text-[#007AFF]' : 'text-[#9797a0]'}`}>
                            Map
                        </span>
                    </button>

                    {/* List Tab */}
                    <button
                        onClick={() => onTabChange('list')}
                        className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity w-[70px]"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M3 13H11C11.55 13 12 12.55 12 12C12 11.45 11.55 11 11 11H3C2.45 11 2 11.45 2 12C2 12.55 2.45 13 3 13ZM3 18H11C11.55 18 12 17.55 12 17C12 16.45 11.55 16 11 16H3C2.45 16 2 16.45 2 17C2 17.55 2.45 18 3 18ZM3 8H11C11.55 8 12 7.55 12 7C12 6.45 11.55 6 11 6H3C2.45 6 2 6.45 2 7C2 7.55 2.45 8 3 8ZM16 11C14.9 11 14 11.9 14 13C14 14.1 14.9 15 16 15C17.1 15 18 14.1 18 13C18 11.9 17.1 11 16 11ZM16 6C14.9 6 14 6.9 14 8C14 9.1 14.9 10 16 10C17.1 10 18 9.1 18 8C18 6.9 17.1 6 16 6ZM16 16C14.9 16 14 16.9 14 18C14 19.1 14.9 20 16 20C17.1 20 18 19.1 18 18C18 16.9 17.1 16 16 16Z"
                                fill={activeTab === 'list' ? '#007AFF' : '#9797a0'}
                            />
                        </svg>
                        <span className={`text-[10px] font-medium ${activeTab === 'list' ? 'text-[#007AFF]' : 'text-[#9797a0]'}`}>
                            List
                        </span>
                    </button>

                    {/* Settings Tab */}
                    <button
                        onClick={() => onTabChange('settings')}
                        className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity w-[70px]"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.68 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.02 5.25 4.77 5.33 4.65 5.55L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48L4.89 11.06C4.84 11.36 4.8 11.69 4.8 12C4.8 12.31 4.82 12.64 4.87 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.23 18.67L7.62 17.71C8.12 18.09 8.65 18.41 9.24 18.65L9.6 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.09 16.37 17.71L18.76 18.67C18.98 18.75 19.23 18.67 19.35 18.45L21.27 15.13C21.39 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z"
                                fill={activeTab === 'settings' ? '#007AFF' : '#9797a0'}
                            />
                        </svg>
                        <span className={`text-[10px] font-medium ${activeTab === 'settings' ? 'text-[#007AFF]' : 'text-[#9797a0]'}`}>
                            Settings
                        </span>
                    </button>
                </div>

                {/* Center Big Button (Add Device) */}
                <button
                    onClick={onAddClick}
                    className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 w-[72px] h-[72px] bg-[#030213] rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
                >
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </button>

                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] bg-[#ececf0] rounded-full"></div>
            </div>
        </div>
    );
}
