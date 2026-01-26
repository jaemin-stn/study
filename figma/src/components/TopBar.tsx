interface TopBarProps {
    title: string;
}

export default function TopBar({ title }: TopBarProps) {
    return (
        <div className="absolute top-0 left-0 w-full h-[104px] bg-white z-10">
            {/* Status Bar */}
            <div className="h-[56px] w-full flex justify-between items-end px-8 pb-3">
                {/* Time */}
                <div className="text-[15px] font-semibold text-black">
                    08:08
                </div>

                {/* Right Icons - Signal, WiFi, Battery */}
                <div className="flex items-center gap-1.5">
                    {/* Signal Icon */}
                    <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
                        <rect x="0" y="9" width="4" height="5" rx="1" fill="black" />
                        <rect x="6" y="6" width="4" height="8" rx="1" fill="black" />
                        <rect x="12" y="3" width="4" height="11" rx="1" fill="black" />
                        <rect x="18" y="0" width="4" height="14" rx="1" fill="black" />
                    </svg>

                    {/* WiFi Icon */}
                    <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
                        <path d="M8.5 13C9.328 13 10 12.328 10 11.5C10 10.672 9.328 10 8.5 10C7.672 10 7 10.672 7 11.5C7 12.328 7.672 13 8.5 13Z" fill="black" />
                        <path d="M8.5 8C10.433 8 12.131 8.895 13.242 10.242L14.657 8.828C13.145 7.316 11.007 6.5 8.5 6.5C5.993 6.5 3.855 7.316 2.343 8.828L3.757 10.242C4.869 8.895 6.567 8 8.5 8Z" fill="black" />
                        <path d="M8.5 3C11.815 3 14.844 4.369 17 6.636L15.586 8.05C13.813 6.159 11.293 5 8.5 5C5.707 5 3.187 6.159 1.414 8.05L0 6.636C2.156 4.369 5.185 3 8.5 3Z" fill="black" />
                    </svg>

                    {/* Battery Icon */}
                    <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
                        <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="black" fill="white" />
                        <path d="M23 4V9C24.5 8.5 24.5 4.5 23 4Z" fill="black" />
                        <rect x="2" y="2" width="18" height="8" rx="1" fill="black" />
                    </svg>
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="h-[48px] w-full flex items-center justify-center">
                <h1 className="text-[17px] font-semibold text-black">
                    {title}
                </h1>
            </div>
        </div>
    );
}
