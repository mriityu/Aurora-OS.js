import { Wifi, Bluetooth, ChevronRight, RefreshCw, Lock } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { useI18n } from '../i18n/index';
import { cn } from '@/components/ui/utils';

interface NetworkSettingsProps {
  accentColor: string;
  wifiEnabled: boolean;
  setWifiEnabled: (enabled: boolean) => void;
  bluetoothEnabled: boolean;
  setBluetoothEnabled: (enabled: boolean) => void;
  wifiNetwork: string;
  setWifiNetwork: (network: string) => void;
  bluetoothDevice: string;
}

export function NetworkSettings({
  accentColor,
  wifiEnabled,
  setWifiEnabled,
  bluetoothEnabled,
  setBluetoothEnabled,
  wifiNetwork,
  setWifiNetwork,
  bluetoothDevice,
}: NetworkSettingsProps) {
  const { t } = useI18n();

  // Wi-Fi Network List State
  const [showWifiList, setShowWifiList] = useState(false);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(false);
  const [wifiNetworks, setWifiNetworks] = useState<Array<{name: string, signal: number, secured: boolean}>>([]);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [networkPassword, setNetworkPassword] = useState('');

  // Generate random Wi-Fi networks
  const generateWifiNetworks = () => {
    const networkNames = [
      'FreeWifi-Secure', 'HomeNetwork_5G', 'CoffeeShop_Guest', 'Office_Network',
      'Linksys-2.4GHz', 'NETGEAR42', 'TP-Link_Wireless', 'MyHomeWiFi',
      'Apartment_204', 'Xfinity_Public', 'ATT-WiFi-9876', 'Verizon_XY23'
    ];

    const count = Math.floor(Math.random() * 2) + 4; // 4 or 5
    const shuffled = [...networkNames].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    const networks = selected.map(name => ({
      name,
      signal: Math.floor(Math.random() * 4) + 1,
      secured: Math.random() > 0.3
    }));

    networks.sort((a, b) => b.signal - a.signal);

    return networks;
  };

  const loadWifiNetworks = () => {
    setIsLoadingNetworks(true);
    setWifiNetworks([]);

    const allNetworks = generateWifiNetworks();

    const networksWithDelay = allNetworks.map(network => {
      const signalDelayBase = {
        4: 300,
        3: 500,
        2: 800,
        1: 1200
      }[network.signal] || 500;

      const randomVariation = Math.random() * 400;
      const detectionTime = signalDelayBase + randomVariation;

      return { ...network, detectionTime };
    });

    networksWithDelay.sort((a, b) => a.detectionTime - b.detectionTime);

    let maxDelay = 0;
    networksWithDelay.forEach((networkData) => {
      setTimeout(() => {
        setWifiNetworks(prev => {
          if (prev.find(n => n.name === networkData.name)) return prev;
          return [...prev, { name: networkData.name, signal: networkData.signal, secured: networkData.secured }];
        });
      }, networkData.detectionTime);

      maxDelay = Math.max(maxDelay, networkData.detectionTime);
    });

    setTimeout(() => setIsLoadingNetworks(false), maxDelay + 200);
  };

  const handleWifiBlockClick = () => {
    setShowWifiList(true);
    loadWifiNetworks();
  };

  const handleBackToMain = () => {
    setShowWifiList(false);
    setWifiNetworks([]);
  };

  const handleNetworkClick = (network: {name: string, signal: number, secured: boolean}) => {
    if (network.secured) {
      setSelectedNetwork(network.name);
      setShowPasswordDialog(true);
    } else {
      setWifiNetwork(network.name);
      setWifiEnabled(true);
      handleBackToMain();
    }
  };

  const handlePasswordSubmit = () => {
    if (networkPassword) {
      setWifiNetwork(selectedNetwork);
      setWifiEnabled(true);
      setShowPasswordDialog(false);
      setNetworkPassword('');
      setSelectedNetwork('');
      handleBackToMain();
    }
  };

  const getWifiSignalIcon = (signal: number) => {
    const opacity = signal / 4;
    return <Wifi className="w-5 h-5" style={{ opacity: 0.3 + (opacity * 0.7) }} />;
  };

  return (
    <div>
      <h2 className="text-2xl text-white mb-6">{t('settings.sections.network')}</h2>

      {!showWifiList ? (
        <>
          {/* Wi-Fi Section */}
          <button
            onClick={handleWifiBlockClick}
            className="w-full bg-black/20 rounded-xl p-4 mb-1 border border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                  <Wifi className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium text-white">{t('settings.network.wifiTitle')}</h3>
                  <p className="text-xs text-white/50">
                    {wifiEnabled
                      ? t('settings.network.wifiConnected', { network: wifiNetwork })
                      : t('settings.network.wifiDisabled')
                    }
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </div>
          </button>

          {/* Bluetooth Section */}
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                  <Bluetooth className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{t('settings.network.bluetoothTitle')}</h3>
                  <p className="text-xs text-white/50">
                    {bluetoothEnabled
                      ? t('settings.network.bluetoothConnected', { device: bluetoothDevice })
                      : t('settings.network.bluetoothDisabled')
                    }
                  </p>
                </div>
              </div>
              <Checkbox
                checked={bluetoothEnabled}
                onCheckedChange={(checked) => setBluetoothEnabled(checked === true)}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Wi-Fi Networks List */}
          <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToMain}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white rotate-180" />
                </button>
                <h3 className="text-sm font-medium text-white">{t('settings.network.wifiNetworks')}</h3>
              </div>
              <button
                onClick={loadWifiNetworks}
                disabled={isLoadingNetworks}
                className="p-1.5 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                style={{ color: accentColor }}
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingNetworks && "animate-spin")} />
              </button>
            </div>

            {/* Network List with Loader */}
            <div className="p-2">
              {/* Loader - shown while scanning */}
              {isLoadingNetworks && (
                <div className="flex items-center gap-3 py-4 px-3">
                  <RefreshCw className="w-5 h-5 text-white/40 animate-spin" />
                  <p className="text-sm text-white/60">{t('settings.network.scanning')}</p>
                </div>
              )}

              {/* Network List - appears progressively */}
              <div className="space-y-1">
                {wifiNetworks.map((network, index) => (
                  <button
                    key={`${network.name}-${index}`}
                    onClick={() => handleNetworkClick(network)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors animate-in fade-in slide-in-from-left-2 duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60">
                        {getWifiSignalIcon(network.signal)}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{network.name}</span>
                          {network.secured && (
                            <Lock className="w-3 h-3 text-white/40" />
                          )}
                        </div>
                      </div>
                    </div>
                    {wifiNetwork === network.name && wifiEnabled && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Password Dialog */}
          {showPasswordDialog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
                <h3 className="text-lg font-medium text-white mb-4">
                  {t('settings.network.enterPassword')}
                </h3>
                <p className="text-sm text-white/60 mb-4">{selectedNetwork}</p>
                <GlassInput
                  type="password"
                  value={networkPassword}
                  onChange={(e) => setNetworkPassword(e.target.value)}
                  placeholder={t('settings.network.passwordPlaceholder')}
                  className="mb-4"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && networkPassword) {
                      handlePasswordSubmit();
                    }
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <GlassButton
                    onClick={() => {
                      setShowPasswordDialog(false);
                      setNetworkPassword('');
                      setSelectedNetwork('');
                    }}
                    variant="ghost"
                  >
                    {t('settings.users.cancel')}
                  </GlassButton>
                  <GlassButton
                    onClick={handlePasswordSubmit}
                    disabled={!networkPassword}
                    style={{ backgroundColor: accentColor }}
                  >
                    {t('settings.network.connect')}
                  </GlassButton>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
