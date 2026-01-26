import { useState } from 'react'
import BottomTabBar from './components/BottomTabBar'
import TopBar from './components/TopBar'
import MapScreen from './components/MapScreen'
import DeviceListScreen from './components/DeviceListScreen'
import SettingsScreen from './components/SettingsScreen'
import AddDeviceModal, { type DeviceFormData } from './components/AddDeviceModal'

interface Device {
  id: number;
  name: string;
  type: string;
  ip: string;
  status: 'online' | 'warning' | 'offline';
  statusText: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'settings'>('map');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([
    {
      id: 1,
      name: '서울 본사 라우터',
      type: 'Router',
      ip: '192.168.1.1',
      status: 'online',
      statusText: '온라인'
    },
    {
      id: 2,
      name: '강남 지점 스위치',
      type: 'Switch',
      ip: '192.168.1.2',
      status: 'online',
      statusText: '온라인'
    },
    {
      id: 3,
      name: '여의도 방화벽',
      type: 'Firewall',
      ip: '192.168.1.3',
      status: 'warning',
      statusText: '경고'
    }
  ]);

  const getTitle = () => {
    switch (activeTab) {
      case 'map':
        return 'Network Monitoring';
      case 'list':
        return 'Device List';
      case 'settings':
        return 'Settings';
      default:
        return 'Network Monitoring';
    }
  };

  const handleAddDevice = (deviceData: DeviceFormData) => {
    const newDevice: Device = {
      id: devices.length + 1,
      name: deviceData.name,
      type: deviceData.type,
      ip: deviceData.ip,
      status: deviceData.status.includes('온라인') || deviceData.status.toLowerCase().includes('online') ? 'online' :
        deviceData.status.includes('경고') || deviceData.status.toLowerCase().includes('warning') ? 'warning' : 'offline',
      statusText: deviceData.status
    };

    setDevices([...devices, newDevice]);
    // Switch to list tab to show the new device
    setActiveTab('list');
  };

  return (
    <div className="w-screen h-screen bg-gray-100 flex justify-center items-center">
      {/* Mobile Frame - exact dimensions from Figma */}
      <div className="relative w-[393px] h-[852px] bg-white overflow-hidden">

        {/* Top Bar (Status + Navigation) */}
        <TopBar title={getTitle()} />

        {/* Main Content - Conditional rendering based on active tab */}
        <div className="absolute top-[104px] left-0 right-0 bottom-[116px]">
          {activeTab === 'map' && <MapScreen />}
          {activeTab === 'list' && <DeviceListScreen devices={devices} />}
          {activeTab === 'settings' && <SettingsScreen />}
        </div>

        {/* Bottom Tab Bar */}
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onAddClick={() => setIsModalOpen(true)}
        />

        {/* Add Device Modal */}
        <AddDeviceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAddDevice}
        />

      </div>
    </div>
  )
}

export default App
