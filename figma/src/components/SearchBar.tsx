export default function SearchBar() {
    return (
        <div className="w-full px-6 py-4">
            <div className="relative w-full">
                {/* Search Input */}
                <div className="flex items-center gap-3 w-full h-[48px] bg-[#f5f5f7] rounded-[12px] px-4">
                    {/* Search Icon */}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                        <path d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 19L14.65 14.65" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    {/* Placeholder Text */}
                    <span className="flex-1 text-[15px] text-[#8E8E93] font-normal">
                        Search for locations or devices
                    </span>

                    {/* Microphone Icon */}
                    <svg width="18" height="24" viewBox="0 0 18 24" fill="none" className="flex-shrink-0">
                        <path d="M9 1C7.34315 1 6 2.34315 6 4V12C6 13.6569 7.34315 15 9 15C10.6569 15 12 13.6569 12 12V4C12 2.34315 10.6569 1 9 1Z" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 10V12C15 15.3137 12.3137 18 9 18C5.68629 18 3 15.3137 3 12V10" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9 18V23M9 23H5M9 23H13" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
