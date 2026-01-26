import SearchBar from './SearchBar';
import networkMapImg from '../assets/network_map.png';

export default function MapScreen() {
    return (
        <div className="w-full h-full bg-[#f9f9f9] overflow-y-auto">
            <img src={networkMapImg} alt="Network Map" className="w-full" />
            <SearchBar />
        </div>
    );
}
